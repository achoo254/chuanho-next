import { describe, expect, it } from 'vitest';
import { bestTake, parseAsrOutput } from './asr-verdict';
import { beatmapQcItems, parseBeatmapSummary } from './executors/beatmap-job';
import { evaluateImage, parseImageSize, parseLumaStats } from './image-qc';
import { allPassed, evaluateAudio, measureAudio, parseEbur128, parseProbe, parseSilences, VOICE_LIMITS, type AudioMeasure } from './media-qc';
import { batchQcItems, nextTrackNumber, parseMusicQcReport, rawTrackIds } from './music-qc-report';
import type { RunCommand } from './process-runner';

// Captured from ffmpeg 8 (`ebur128=peak=true,silencedetect`), trimmed.
const EBUR128 = `[Parsed_ebur128_0 @ 0000] t: 5.9 TARGET:-23 LUFS M: -22.0 S: -22.0 I: -22.0 LUFS LRA: 9.9 LU
[Parsed_ebur128_0 @ 00000255d3f41f00] Summary:

  Integrated loudness:
    I:         -18.4 LUFS
    Threshold: -28.5 LUFS

  Loudness range:
    LRA:         6.1 LU

  True peak:
    Peak:       -2.3 dBFS
`;
const SILENCES = `[silencedetect @ 0001] silence_start: 1.25
[silencedetect @ 0001] silence_end: 1.9 | silence_duration: 0.65
[silencedetect @ 0001] silence_start: 3.5
`;
const PROBE = JSON.stringify({ streams: [{ codec_type: 'audio' }], format: { duration: '4.200000' } });

describe('audio QC parsers', () => {
  it('reads the ebur128 summary, not the running lines', () => {
    expect(parseEbur128(EBUR128)).toEqual({ integratedLufs: -18.4, truePeakDb: -2.3 });
    expect(parseEbur128('Summary:\n I: -inf LUFS\n')).toEqual({ integratedLufs: Number.NEGATIVE_INFINITY, truePeakDb: undefined });
    expect(() => parseEbur128('no summary here')).toThrow();
  });

  it('pairs silence starts and ends; an open silence runs to the end', () => {
    expect(parseSilences(SILENCES, 4.2)).toEqual([
      { start: 1.25, end: 1.9 },
      { start: 3.5, end: 4.2 },
    ]);
    expect(parseSilences('[silencedetect @ 1] silence_end: 2 | silence_duration: 2', 5)).toEqual([{ start: 0, end: 2 }]);
  });

  it('reads ffprobe json', () => {
    expect(parseProbe(PROBE)).toEqual({ seconds: 4.2, hasAudio: true });
    expect(parseProbe(JSON.stringify({ streams: [{ codec_type: 'video', width: 1080, height: 1920 }], format: { duration: '30' } }))).toEqual({ seconds: 30, hasAudio: false, video: { width: 1080, height: 1920 } });
    expect(() => parseProbe(JSON.stringify({ format: {} }))).toThrow(/duration/);
  });
});

describe('audio QC verdict', () => {
  const good: AudioMeasure = { seconds: 4.2, loudness: { integratedLufs: -18.4, truePeakDb: -2.3 }, silences: [{ start: 3.9, end: 4.2 }] };

  it('passes a clean voice clip', () => {
    expect(allPassed(evaluateAudio(good, VOICE_LIMITS))).toBe(true);
  });

  it('fails too long, too quiet, clipping and gappy clips, naming each check', () => {
    const failed = (m: AudioMeasure): string[] => evaluateAudio(m, VOICE_LIMITS).filter((c) => !c.ok).map((c) => c.name);
    expect(failed({ ...good, seconds: 25 })).toEqual(['duration']);
    expect(failed({ ...good, loudness: { integratedLufs: -30, truePeakDb: -9 } })).toEqual(['loudness']);
    expect(failed({ ...good, loudness: { integratedLufs: -15, truePeakDb: 0.2 } })).toEqual(['true-peak']);
    expect(failed({ ...good, silences: [{ start: 1, end: 2.5 }] })).toEqual(['silence']);
    expect(failed({ ...good, loudness: { integratedLufs: Number.NEGATIVE_INFINITY, truePeakDb: undefined } })).toEqual(['loudness', 'true-peak']);
  });

  it('measures through the injected runner', async () => {
    const calls: string[] = [];
    const run: RunCommand = (command, args) => {
      calls.push(`${command} ${args.join(' ')}`);
      return Promise.resolve(command === 'ffprobe' ? { code: 0, stdout: PROBE, stderr: '' } : { code: 0, stdout: '', stderr: `${SILENCES}${EBUR128}` });
    };
    const measured = await measureAudio(run, 'clip.mp3', VOICE_LIMITS);
    expect(measured).toMatchObject({ seconds: 4.2, loudness: { integratedLufs: -18.4 }, silences: [{ start: 1.25 }, { start: 3.5 }] });
    expect(calls[1]).toContain('silencedetect=n=-45dB:d=0.6');
    const failing: RunCommand = () => Promise.resolve({ code: 1, stdout: '', stderr: 'Invalid data found' });
    await expect(measureAudio(failing, 'x.mp3', VOICE_LIMITS)).rejects.toThrow(/Invalid data/);
  });
});

describe('music QC report (qc_music.py)', () => {
  const report = parseMusicQcReport({
    rejected: { m101: ['silence 9.2s', 'quiet 0.31'] },
    duplicates: { m102: 'm007' },
    kept: ['m001', 'm103'],
    unused: ['m104'],
    summary: { kept: 2, hours: 0.08 },
  });

  it('turns the report into per-track items for one batch', () => {
    const items = batchQcItems(report, ['m101', 'm102', 'm103', 'm104', 'm105', 'm106'], new Set(['m101', 'm102', 'm103', 'm104', 'm105']));
    expect(items.map((i) => [i.item, i.passed, i.checks.map((c) => c.name).join('+')])).toEqual([
      ['m101', false, 'silence+quiet'],
      ['m102', false, 'duplicate'],
      ['m103', true, 'qc_music'],
      ['m104', false, 'library-cap'],
      ['m105', false, 'qc_music'],
      ['m106', false, 'generated'],
    ]);
  });

  it('continues numbering after files and logged jobs', () => {
    const log = '{"id":"m001","seconds":20}\n{"id":"m002","error":"timeout"}\n{"id":"m0';
    expect(rawTrackIds(log)).toEqual({ ids: ['m001', 'm002'], failed: ['m002'] });
    expect(nextTrackNumber(['m001', 'm107.mp3', 'm002', 'x'])).toBe(108);
    expect(nextTrackNumber([])).toBe(1);
    expect(() => parseMusicQcReport({})).toThrow(/kept/);
  });
});

describe('ASR and beatmap output', () => {
  it('parses asr-check lines and picks the best take', () => {
    const out = '{"file": "a.0.wav", "expected": "x", "heard": "x", "syllable_accuracy": 0.7}\nwarning\n{"file": "a.1.wav", "heard": "y", "syllable_accuracy": 0.92}\n';
    const scores = parseAsrOutput(out);
    expect(scores).toHaveLength(2);
    expect(bestTake(scores, ['a.0.wav', 'a.1.wav'])).toMatchObject({ file: 'a.1.wav', accuracy: 0.92 });
    expect(bestTake(scores, ['b.wav'])).toBeUndefined();
  });

  it('reads the beatmap CLI summary and index', () => {
    expect(parseBeatmapSummary('m001 bpm 60\n107 analysed, 87 playable, 0 failed, 0 skipped -> x')).toEqual({ analysed: 107, playable: 87, failed: 0 });
    expect(parseBeatmapSummary('boom')).toBeUndefined();
    expect(beatmapQcItems({ tracks: [{ trackId: 'm001', bpm: 60, playable: true }, { trackId: 'm002', playable: false }] }).map((i) => i.checks[0]?.ok)).toEqual([true, false]);
  });
});

describe('scene picture QC', () => {
  it('checks size, file and tonal range', () => {
    expect(parseImageSize(JSON.stringify({ streams: [{ width: 928, height: 1664 }] }))).toEqual({ width: 928, height: 1664 });
    const stats = parseLumaStats('[Parsed_metadata_1 @ 1] lavfi.signalstats.YLOW=58\n... lavfi.signalstats.YAVG=79.78\n... lavfi.signalstats.YHIGH=134');
    expect(stats).toEqual({ min: 58, max: 134, avg: 79.78 });
    const want = { width: 928, height: 1664 };
    expect(evaluateImage(want, 900_000, stats, want).every((c) => c.ok)).toBe(true);
    const bad = evaluateImage({ width: 1328, height: 1328 }, 20_000, { min: 16, max: 18, avg: 17 }, want);
    expect(bad.filter((c) => !c.ok).map((c) => c.name)).toEqual(['size', 'file', 'tonal-range']);
  });
});
