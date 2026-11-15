/**
 * Chùa Nhỏ production factory on the PC: `pnpm exec tsx tools/chuanho-factory/cli.ts <command>`. See README.md.
 */
import { enqueueParams, parseArgs, type ParsedArgs } from './cli-args';
import { enqueue, listJobs, planNightCommand, rejectTrack, requeueJob, showStatus } from './cli-commands';
import { runBeatmapJob } from './executors/beatmap-job';
import { runMusicJob } from './executors/music-job';
import { runPublishJob } from './executors/publish-library-job';
import { runSceneJob } from './executors/scene-job';
import { runVerseVoiceJob } from './executors/verse-voice-job';
import { runVideoJob } from './executors/video-job';
import { loadConfig, type FactoryConfig } from './factory-config';
import { FactoryRunner, realClock } from './factory-runner';
import { probeComfyQueue, probeGpu, probeHealth } from './gpu-probes';
import { decideGate, initialGateState, type GateSettings } from './idle-gate';
import { nextRunnable } from './job-queue';
import { JobStore } from './job-store';
import { mediaLayout } from './media-layout';
import { runCommand } from './process-runner';
import { acquireRunnerLock } from './runner-lock';
import { formatWindow, msUntilWindowOpens } from './schedule-window';
import { loadVerses } from './verses';

const USAGE = `usage: tsx tools/chuanho-factory/cli.ts <command>
  enqueue music [--count 8] | scene [--times morning,noon,evening,night] | verse-voice [--verses id,id]
          video [--seconds 30] [--time night] [--no-voice] | beatmap | publish-library
  plan-night [--music 8] [--videos 2] [--seconds 30]
  run [--once] [--ignore-window] [--dry-run]
  list [--status pending|running|passed|rejected|failed] [--all]
  status
  reject <trackId> [--reason "why"]      gỡ bản: take a track out of the library
  requeue <jobId>
  verses                                 validate verses.json`;

function gateSettings(config: FactoryConfig): GateSettings {
  return {
    busyPercent: config.gpuBusyPercent,
    busySamples: config.gpuBusySamples,
    minFreeMiB: config.gpuMinFreeMiB,
    sampleMs: config.sampleSeconds * 1000,
    minPauseMs: config.minPauseSeconds * 1000,
    maxPauseMs: config.maxPauseSeconds * 1000,
    healthTtlMs: 5 * 60_000,
  };
}

function log(message: string): void {
  console.log(`[${new Date().toLocaleString('sv-SE')}] ${message}`);
}

const probesFor = (config: FactoryConfig): ConstructorParameters<typeof FactoryRunner>[0]['probes'] => ({
  gpu: () => probeGpu(runCommand),
  comfyQueue: () => probeComfyQueue(config.comfyUrl),
  health: () => probeHealth(runCommand, config.python, config.artgenDir),
});

/** One look at the gate and the next job; changes nothing. */
async function dryRun(config: FactoryConfig, store: JobStore, args: ParsedArgs): Promise<void> {
  const probes = probesFor(config);
  const now = new Date();
  const msUntilWindow = args.flags.has('ignore-window') ? 0 : msUntilWindowOpens(config.window, now);
  const obs = { nowMs: now.getTime(), msUntilWindow, gpu: await probes.gpu(), comfyQueue: await probes.comfyQueue(), health: await probes.health() };
  const { decision } = decideGate(initialGateState(gateSettings(config)), gateSettings(config), obs);
  const job = nextRunnable((await store.load()).jobs, now);
  console.log(`window ${formatWindow(config.window)}: ${msUntilWindow === 0 ? 'open' : `opens in ${Math.round(msUntilWindow / 60_000)} min`}`);
  console.log(`gpu ${obs.gpu ? `${obs.gpu.utilPercent}% busy, ${obs.gpu.freeMiB} MiB free` : 'nvidia-smi unavailable'}; comfy queue ${obs.comfyQueue ?? 'unreachable'}; ${obs.health.detail}`);
  console.log(`gate: ${decision.kind === 'wait' ? `wait (${decision.reason})` : decision.kind}`);
  console.log(`next job: ${job ? `${job.id} ${JSON.stringify(job.params)}` : 'none'}`);
}

async function run(config: FactoryConfig, store: JobStore, args: ParsedArgs): Promise<void> {
  if (args.flags.has('dry-run')) return dryRun(config, store, args);
  const lock = await acquireRunnerLock(config.stateDir);
  const runner = new FactoryRunner({
    store,
    executors: { music: runMusicJob, beatmap: runBeatmapJob, scene: runSceneJob, 'verse-voice': runVerseVoiceJob, video: runVideoJob, 'publish-library': runPublishJob },
    probes: probesFor(config),
    clock: realClock,
    settings: gateSettings(config),
    window: config.window,
    ignoreWindow: args.flags.has('ignore-window'),
    once: args.flags.has('once'),
    log,
    context: { config, layout: mediaLayout(config.mediaDir), run: runCommand },
  });
  let interrupts = 0;
  const onSignal = (): void => {
    interrupts += 1;
    if (interrupts === 1) {
      log('stopping after the current step (Ctrl+C again to stop now)');
      runner.requestStop();
    } else {
      log('stopping now');
      runner.hardStop();
    }
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  try {
    log(`runner started (window ${formatWindow(config.window)}${args.flags.has('ignore-window') ? ', ignored' : ''})`);
    const summary = await runner.run();
    log(`runner done: ${JSON.stringify(summary)}`);
  } finally {
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    await lock.release();
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.command || args.flags.has('help')) {
    console.log(USAGE);
    return;
  }
  if (args.command === 'verses') {
    console.log(`${(await loadVerses()).length} verses ok`);
    return;
  }
  const config = await loadConfig();
  const store = new JobStore(config.stateDir);
  const now = new Date();
  switch (args.command) {
    case 'enqueue':
      for (const job of await enqueue(config, store, [enqueueParams(args)], now)) console.log(`queued ${job.id}`);
      return;
    case 'plan-night':
      return planNightCommand(config, store, args, now);
    case 'run':
      return run(config, store, args);
    case 'list':
      return listJobs(store, args);
    case 'status':
      return showStatus(config, store);
    case 'reject':
      return rejectTrack(config, store, args, now);
    case 'requeue':
      return requeueJob(store, args, now);
    default:
      throw new Error(`unknown command ${args.command}\n${USAGE}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
