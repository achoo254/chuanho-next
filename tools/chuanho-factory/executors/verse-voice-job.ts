/**
 * `verse-voice`: reads verses from verses.json aloud with VieNeu-TTS through the artgen skill's voice.py (built-in
 * voice only), shapes each take like tools/chuanho-voice/generate-sutra-voice.py does for the sutra (slow, warm,
 * light hall echo, -18 LUFS), scores the takes with tools/chuanho-voice/asr-check.py and keeps the best one as
 * `<media>/voices/<verseId>.mp3` only when it passes ASR and the audio checks.
 */
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { bestTake, MIN_ASR_ACCURACY, parseAsrOutput } from '../asr-verdict';
import type { Job, QcItem, VerseVoiceParams } from '../job-types';
import { allPassed, evaluateAudio, measureAudio, VOICE_LIMITS } from '../media-qc';
import { lastJsonLine, runChecked } from '../process-runner';
import { loadVerses, type Verse } from '../verses';
import { gpuStep, outcome, type ExecutorContext, type ExecutorOutcome } from './executor-context';

const TAKES = 2;
/** Same shaping chain as generate-sutra-voice.py, so verse and sutra voices sound alike. */
export const VOICE_SHAPE = [
  'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05',
  'areverse',
  'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05',
  'areverse',
  'atempo=0.82',
  'highpass=f=80',
  'lowpass=f=7500',
  'aecho=0.9:0.5:60|120:0.12|0.06',
  'loudnorm=I=-18:TP=-2:LRA=7',
].join(',');

/** Verses this job reads: the requested ids, or every verse without a passed voice yet. */
export function versesToVoice(all: readonly Verse[], requested: readonly string[], voiced: ReadonlySet<string>): Verse[] {
  if (requested.length > 0) {
    const unknown = requested.filter((id) => !all.some((v) => v.id === id));
    if (unknown.length > 0) throw new Error(`unknown verse ids: ${unknown.join(', ')}`);
    return all.filter((v) => requested.includes(v.id));
  }
  return all.filter((v) => !voiced.has(v.id));
}

/** Verse ids with a passed voice in earlier jobs (item `voices/<id>.mp3`). */
export function voicedVerseIds(ctx: Pick<ExecutorContext, 'state'>): Set<string> {
  const ids = new Set<string>();
  for (const job of ctx.state.jobs) {
    if (job.params.kind !== 'verse-voice' || job.status !== 'passed') continue;
    for (const item of job.result?.qc ?? []) {
      const match = /voices[\\/]([a-z0-9-]+)\.mp3$/.exec(item.item);
      if (item.passed && match?.[1]) ids.add(match[1]);
    }
  }
  return ids;
}

export async function runVerseVoiceJob(job: Job, ctx: ExecutorContext): Promise<ExecutorOutcome> {
  const params = job.params as VerseVoiceParams;
  const asrPython = ctx.config.asrPython;
  if (!asrPython) throw new Error('asrPython is not configured (config.json key asrPython or ASR_PYTHON): voices cannot ship without the ASR check');
  const verses = versesToVoice(await loadVerses(), params.verseIds, voicedVerseIds(ctx));
  if (verses.length === 0) return outcome({ outputs: [], qc: [], summary: { verses: 0, note: 'every verse already has a voice' } });
  const work = path.join(ctx.layout.work, job.id);
  await mkdir(work, { recursive: true });
  await mkdir(ctx.layout.voices, { recursive: true });

  const takes = new Map<string, string[]>();
  for (const verse of verses) {
    const files: string[] = [];
    for (let take = 0; take < TAKES; take += 1) {
      await gpuStep(ctx);
      const raw = path.join(work, `${verse.id}.${take}.raw.wav`);
      const shaped = path.join(work, `${verse.id}.${take}.wav`);
      ctx.log(`voice ${verse.id} take ${take + 1}/${TAKES}`);
      const voiceArgs = [path.join(ctx.config.artgenDir, 'voice.py'), verse.text, '-o', raw, '--voice', ctx.config.verseVoice];
      const reply = lastJsonLine((await ctx.run(ctx.config.python, voiceArgs, { timeoutMs: 10 * 60_000, signal: ctx.signal })).stdout);
      if (reply?.ok !== true) throw new Error(`voice.py failed for ${verse.id}: ${typeof reply?.error === 'string' ? reply.error : 'no reply'}`);
      await runChecked(ctx.run, 'ffmpeg', ['-y', '-v', 'error', '-i', raw, '-af', VOICE_SHAPE, '-ac', '1', '-ar', '44100', shaped], { signal: ctx.signal });
      files.push(shaped);
    }
    takes.set(verse.id, files);
  }

  // ASR runs on the CPU (see asr-check.py), so it needs no GPU slot.
  const asrJobs = path.join(work, 'asr-jobs.json');
  await writeFile(asrJobs, JSON.stringify(verses.flatMap((v) => (takes.get(v.id) ?? []).map((file) => [file, v.text]))), 'utf8');
  const asr = await ctx.run(asrPython, [path.join(ctx.config.voiceToolDir, 'asr-check.py'), asrJobs, '--min', '0'], { timeoutMs: 60 * 60_000, signal: ctx.signal });
  const scores = parseAsrOutput(asr.stdout);
  if (scores.length === 0) throw new Error(`asr-check.py produced no scores: ${asr.stderr.trim().slice(-600)}`);

  const qc: QcItem[] = [];
  const outputs: string[] = [];
  for (const verse of verses) {
    const best = bestTake(scores, takes.get(verse.id) ?? []);
    const item = `voices/${verse.id}.mp3`;
    if (!best) {
      qc.push({ item, passed: false, checks: [{ name: 'asr', ok: false, detail: 'no ASR score' }] });
      continue;
    }
    const mp3 = path.join(work, `${verse.id}.mp3`);
    await runChecked(ctx.run, 'ffmpeg', ['-y', '-v', 'error', '-i', best.file, '-af', 'apad=pad_dur=0.35', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '64k', mp3], { signal: ctx.signal });
    const checks = [
      { name: 'asr', ok: best.accuracy >= MIN_ASR_ACCURACY, detail: `${best.accuracy} (min ${MIN_ASR_ACCURACY}), heard "${best.heard}"` },
      ...evaluateAudio(await measureAudio(ctx.run, mp3, VOICE_LIMITS), VOICE_LIMITS),
    ];
    const passed = allPassed(checks);
    qc.push({ item, passed, checks });
    if (passed) {
      const target = path.join(ctx.config.mediaDir, item);
      await rename(mp3, target);
      outputs.push(target);
    }
  }
  return outcome({ outputs, qc, summary: { verses: verses.length, voiced: outputs.length } });
}
