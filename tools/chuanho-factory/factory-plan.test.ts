import { describe, expect, it } from 'vitest';
import { enqueueParams, parseArgs } from './cli-args';
import { resolveConfig, lookupArtgenEnv, type ConfigInput } from './factory-config';
import { createJob, markFinished, markRunning } from './job-queue';
import type { QueueState } from './job-store';
import { planBundle, planRemoval, removeApiCommand, uploadCommand } from './library-bundle';
import { planNight } from './night-plan';
import { loadVerses, validateVerses, versesFor } from './verses';

describe('verses.json', () => {
  it('ships about twelve valid, calm verses', async () => {
    const verses = await loadVerses();
    expect(verses.length).toBeGreaterThanOrEqual(12);
    expect(versesFor(verses, 'night').length).toBeGreaterThan(1);
  });

  it('reports every problem of a bad bank', () => {
    const { verses, problems } = validateVerses({
      verses: [
        { id: 'ok', time: 'any', text: 'Ngồi yên một chút, để lòng nghỉ ngơi.' },
        { id: 'ok', time: 'any', text: 'Một câu khác hẳn, vẫn hiền lành.' },
        { id: 'Bad Id', time: 'dawn', text: 'Ngắn' },
        { id: 'luck', time: 'night', text: 'Nghe xong sẽ gặp may mắn cả năm.' },
        { id: 'digits', time: 'noon', text: 'Ngày 20 tháng 11 thật là đẹp trời' },
      ],
    });
    expect(verses.map((v) => v.id)).toEqual(['ok']);
    expect(problems.join('\n')).toMatch(/ok: duplicate id/);
    expect(problems.join('\n')).toMatch(/Bad Id: id must match/);
    expect(problems.join('\n')).toMatch(/time must be/);
    expect(problems.join('\n')).toMatch(/luck: "may mắn"/);
    expect(problems.join('\n')).toMatch(/digits: write numbers as words/);
    expect(problems.join('\n')).toMatch(/digits: end with a full stop/);
    expect(validateVerses({}).problems).toEqual(['verses.json has no "verses" list']);
  });
});

describe('publish bundle', () => {
  const manifest = {
    version: 1,
    totalSeconds: 999,
    tracks: [
      { id: 'm001', file: 'm001-aa.mp3', duration: 150 },
      { id: 'm002', file: 'm002-bb.mp3', duration: 160 },
      { id: 'm003', file: 'm003-cc.mp3', duration: 170 },
      { id: 'm004', file: 'm004-dd.mp3', duration: 180 },
      { id: '../evil', file: '../../etc.mp3', duration: 1 },
    ],
  };
  const index = { version: 1, tracks: [{ trackId: 'm001', playable: true }, { trackId: 'm002', playable: false }, { trackId: 'm003', playable: true }] };

  it('keeps only QC-kept, not removed, present tracks and their beatmaps', () => {
    const plan = planBundle({
      manifest,
      beatmapIndex: index,
      qcKept: new Set(['m001', 'm002', 'm003']),
      removed: new Map([['m002', 'harsh hiss']]),
      existingFiles: new Set(['m001-aa.mp3', 'm002-bb.mp3', 'm004-dd.mp3']),
    });
    expect(plan.trackFiles).toEqual(['m001-aa.mp3']);
    expect(plan.manifest).toMatchObject({ version: 1, totalSeconds: 150, tracks: [{ id: 'm001' }] });
    expect(plan.beatmapFiles).toEqual(['m001.json']);
    expect(plan.beatmapIndex).toEqual({ version: 1, tracks: [{ trackId: 'm001', playable: true }] });
    expect(plan.dropped).toEqual([
      'manifest entry 4: bad id or file name',
      'm002: removed by the operator (harsh hiss)',
      'm003: m003-cc.mp3 is missing',
      'm004: not kept by qc_music',
    ]);
  });

  it('works without beatmaps or a QC report', () => {
    const plan = planBundle({ manifest, beatmapIndex: undefined, qcKept: undefined, removed: new Map(), existingFiles: new Set(['m004-dd.mp3']) });
    expect(plan.trackFiles).toEqual(['m004-dd.mp3']);
    expect(plan.beatmapIndex).toBeUndefined();
  });

  it('plans a removal and prints operator commands without secrets', () => {
    const plan = planRemoval('m001', manifest, index, [{ id: 'cn-1', trackId: 'm001' }, { id: 'cn-2', trackId: 'm003' }]);
    expect(plan).toEqual({ trackId: 'm001', libraryFiles: ['m001-aa.mp3', 'beatmaps/m001.json'], inManifest: true, inBeatmapIndex: true, videos: ['cn-1.mp4'] });
    expect(planRemoval('m999', manifest, index, [])).toMatchObject({ libraryFiles: [], inManifest: false });
    expect(uploadCommand('D:/media/publish/library', true)).toBe('SSH_TARGET=<alias> SSH_OPTS="-F <ssh_config>" PRUNE=1 bash infra/upload-music.sh D:/media/publish/library');
    expect(uploadCommand('C:/My Media/library', false)).toContain("'C:/My Media/library'");
    const api = removeApiCommand('https://chuanho.hoandat.com', 'C:/env/production.env', 'm001', "it's harsh");
    expect(api).toContain('-H "Origin: https://chuanho.hoandat.com"');
    expect(api).toContain('Authorization: Bearer $TOKEN');
    expect(api).toContain('https://chuanho.hoandat.com/api/library/tracks/m001/remove');
    expect(api).toContain(`'{"reason":"it'\\''s harsh"}'`);
    expect(api).toMatch(/unset TOKEN$/);
  });
});

describe('config', () => {
  const input = (extra: Partial<ConfigInput> = {}): ConfigInput => ({ env: {}, home: '/home/u', platform: 'linux', repoRoot: '/w/chuanho-next', file: undefined, artgenEnv: '', ...extra });

  it('defaults to the user config dir and the workspace tools', () => {
    const config = resolveConfig(input());
    expect(config.stateDir).toBe('/home/u/.config/chuanho-factory'.replace(/\//g, config.stateDir.includes('\\') ? '\\' : '/'));
    expect(config).toMatchObject({ gpuBusyPercent: 30, maxAttempts: 3, comfyUrl: 'http://127.0.0.1:8188', asrPython: undefined, publicUrl: 'https://chuanho.hoandat.com' });
    expect(config.musicToolDir.replace(/\\/g, '/')).toMatch(/\/w\/tools\/chuanho-music$/);
    expect(resolveConfig(input({ platform: 'win32', env: { APPDATA: 'C:/Users/u/AppData/Roaming' } })).stateDir.replace(/\\/g, '/')).toBe('C:/Users/u/AppData/Roaming/chuanho-factory');
    expect(resolveConfig(input({ env: { CHUANHO_FACTORY_HOME: '/srv/f', CHUANHO_FACTORY_MEDIA: '/m' } }))).toMatchObject({ stateDir: '/srv/f', mediaDir: '/m' });
  });

  it('reads config.json keys and the artgen address lookup', () => {
    const config = resolveConfig(input({ file: { window: '22:00-06:00', gpuBusyPercent: 50, asrPython: '/venv/python' }, artgenEnv: '# pc\nARTGEN_URL=http://pc.example:8188/\n' }));
    expect(config.window).toEqual({ startMinute: 22 * 60, endMinute: 6 * 60 });
    expect(config).toMatchObject({ gpuBusyPercent: 50, asrPython: '/venv/python', comfyUrl: 'http://pc.example:8188' });
    expect(lookupArtgenEnv('ARTGEN_URL', { ARTGEN_URL: 'http://env' }, 'ARTGEN_URL=http://file')).toBe('http://env');
  });

  it('rejects bad values with every reason', () => {
    expect(() => resolveConfig(input({ file: { gpuBusyPercent: 500, window: 'night', python: '' } }))).toThrow(/gpuBusyPercent.*python|python.*gpuBusyPercent/s);
  });
});

describe('cli arguments', () => {
  it('parses flags and validates enqueue params', () => {
    const args = parseArgs(['enqueue', 'video', '--seconds', '45', '--time=night', '--no-voice']);
    expect(args.command).toBe('enqueue');
    expect(enqueueParams(args)).toEqual({ kind: 'video', seconds: 45, time: 'night', withVoice: false });
    expect(enqueueParams(parseArgs(['enqueue', 'scene', '--times', 'morning, night']))).toEqual({ kind: 'scene', times: ['morning', 'night'] });
    expect(enqueueParams(parseArgs(['enqueue', 'music']))).toEqual({ kind: 'music', count: 8 });
    expect(() => enqueueParams(parseArgs(['enqueue', 'music', '--count', '1000']))).toThrow(/1-60/);
    expect(() => parseArgs(['enqueue', 'music', '--count'])).toThrow(/needs a value/);
    expect(() => enqueueParams(parseArgs(['enqueue', 'tweet']))).toThrow(/unknown job kind/);
  });
});

describe('plan-night', () => {
  const now = new Date(2026, 10, 15, 22, 0);
  const options = { musicCount: 8, videos: 2, videoSeconds: 30, verseIds: ['a', 'b'], voicedVerseIds: new Set<string>(), now };
  const empty: QueueState = { jobs: [], removals: [], skippedLines: 0 };

  it('queues the whole pipeline on a fresh queue', () => {
    const plan = planNight(empty, options);
    expect(plan.map((p) => p.kind)).toEqual(['music', 'beatmap', 'scene', 'verse-voice', 'video', 'video', 'publish-library']);
    expect(plan[2]).toEqual({ kind: 'scene', times: ['morning', 'noon', 'evening', 'night'] });
    const videos = plan.filter((p) => p.kind === 'video');
    expect(new Set(videos.map((v) => (v.kind === 'video' ? v.time : '')))).toHaveProperty('size', 2);
  });

  it('skips kinds already pending, voiced verses, and refreshes one scene when all have enough', () => {
    const pendingMusic = createJob('m', { kind: 'music', count: 4 }, now, 3);
    const sceneDone = markFinished(markRunning(createJob('s', { kind: 'scene', times: ['morning', 'noon', 'evening', 'night'] }, now, 3), now), now, {
      outputs: [],
      qc: ['morning', 'noon', 'evening', 'night'].flatMap((t) => [1, 2].map((n) => ({ item: `scenes/${t}-x-${n}.png`, passed: true, checks: [] }))),
      summary: {},
    }, 'passed');
    const plan = planNight({ jobs: [pendingMusic, sceneDone], removals: [], skippedLines: 0 }, { ...options, voicedVerseIds: new Set(['a', 'b']) });
    expect(plan.map((p) => p.kind)).toEqual(['beatmap', 'scene', 'video', 'video', 'publish-library']);
    expect(plan[1]).toMatchObject({ kind: 'scene', times: [expect.any(String)] });
  });
});
