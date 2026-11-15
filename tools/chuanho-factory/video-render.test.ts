import { describe, expect, it } from 'vitest';
import { calmTextProblems } from './calm-text-guard';
import { chooseVideoInputs, libraryEntries, type PastVideo } from './video-inputs';
import { audioFilter, captionAlpha, maxVoiceSeconds, renderArgs, videoFilter, wrapVerse, type RenderSpec } from './video-render-args';
import { buildSidecar, readSidecar, sidecarTextProblems } from './video-sidecar';
import type { Verse } from './verses';

const spec: RenderSpec = { scene: 'D:/media/scenes/night-1.png', track: 'D:/media/library/m001-ab.mp3', trackStartSeconds: 4, seconds: 30, textFile: 'verse.txt', fontFile: 'font.ttf', output: 'cn-1.mp4' };

describe('ffmpeg arguments', () => {
  it('builds a 1080x1920 Ken Burns video with fades and a safe-zone caption', () => {
    const filter = videoFilter(spec);
    expect(filter).toMatch(/^\[0:v\]scale=2160:3840/);
    expect(filter).toContain('d=900:s=1080x1920:fps=30');
    expect(filter).toContain("z='min(1+");
    expect(filter).toContain('drawtext=fontfile=font.ttf:textfile=verse.txt:expansion=none:text_align=C');
    // Caption centred in the zone clear of the right-hand buttons, in the upper part of the frame.
    expect(filter).toContain('x=w*0.46-text_w/2:y=h*0.2');
    expect(filter).toContain('fade=t=in:st=0:d=1.5,fade=t=out:st=28.000:d=2');
    // Paths with drive colons stay out of the filter graph.
    expect(filter).not.toContain('D:/');
  });

  it('omits the caption when there is no verse', () => {
    const { textFile: _textFile, ...noText } = spec;
    expect(videoFilter(noText)).not.toContain('drawtext');
  });

  it('fades and normalises the music; ducks it under a delayed voice', () => {
    expect(audioFilter(spec)).toBe('[1:a]atrim=0:30.000,asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:d=2,afade=t=out:st=27.000:d=3,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]');
    const voiced = audioFilter({ ...spec, voice: 'v.mp3' });
    expect(voiced).toContain('[2:a]aresample=48000,adelay=2500:all=1,apad,atrim=0:30.000[vo]');
    expect(voiced).toContain('sidechaincompress');
    expect(voiced).toMatch(/amix=inputs=2:normalize=0:duration=first,loudnorm=I=-16/);
  });

  it('assembles inputs, maps and encoder settings; refuses lengths outside 15-60 s', () => {
    const args = renderArgs({ ...spec, voice: 'v.mp3' });
    expect(args.slice(4, 12)).toEqual(['-i', spec.scene, '-ss', '4.000', '-i', spec.track, '-i', 'v.mp3']);
    expect(args).toEqual(expect.arrayContaining(['-map', '[v]', '[a]', 'libx264', 'yuv420p', '+faststart']));
    expect(args.slice(-3)).toEqual(['-t', '30.000', 'cn-1.mp4']);
    expect(() => renderArgs({ ...spec, seconds: 10 })).toThrow();
    expect(() => renderArgs({ ...spec, seconds: 61 })).toThrow();
    expect(maxVoiceSeconds(30)).toBe(24.5);
  });

  it('wraps verses at the comma when both halves fit, otherwise by words', () => {
    expect(wrapVerse('Thở vào thật chậm, thở ra thật nhẹ.')).toEqual(['Thở vào thật chậm,', 'thở ra thật nhẹ.']);
    // "mình làm từng việc một." is over 22 characters, so the line breaks by words instead.
    expect(wrapVerse('Việc hôm nay, mình làm từng việc một.')).toEqual(['Việc hôm nay, mình làm', 'từng việc một.']);
    expect(wrapVerse('một hai ba bốn năm sáu bảy tám chín mười', 12)).toEqual(['một hai ba', 'bốn năm sáu', 'bảy tám chín', 'mười']);
  });

  it('fades the caption in after the picture and out before it', () => {
    expect(captionAlpha(30)).toBe('if(lt(t,2),0,if(lt(t,3.5),(t-2)/1.5,if(gt(t,26.000),max(0,(27.500-t)/1.5),1)))');
  });
});

describe('sidecar and text guard', () => {
  const sidecar = buildSidecar({
    id: 'cn-202611152330-night',
    durationSeconds: 30.0133,
    width: 1080,
    height: 1920,
    trackId: 'm012',
    scene: { time: 'night', file: 'scenes/night-1.png' },
    verse: { id: 'trang-len', text: 'Trăng lên đầu ngõ, ta nói khẽ thôi.', voiced: true },
    created: new Date('2026-11-15T16:30:00Z'),
  });

  it('describes the video calmly, with provenance and no call to action', () => {
    expect(sidecar).toMatchObject({ version: 1, title: 'Trăng đêm sân chùa · nhạc thiền không lời', durationSeconds: 30.01, trackId: 'm012', musicAndPictureOnly: true });
    expect(sidecar.tags).toContain('ban đêm');
    expect(sidecarTextProblems(sidecar)).toEqual([]);
    expect(sidecarTextProblems({ ...sidecar, title: 'Ủng hộ chùa qua link bio' })).toHaveLength(2);
    expect(readSidecar(JSON.parse(JSON.stringify(sidecar)))).toEqual({ id: sidecar.id, trackId: 'm012', scene: sidecar.scene, verseId: 'trang-len' });
    expect(readSidecar({ id: 'x' })).toBeUndefined();
  });

  it('catches donation asks, calls to action, links and luck promises, whole words only', () => {
    expect(calmTextProblems('Hãy ủng hộ để nuôi đại ca')).toHaveLength(1);
    expect(calmTextProblems('Nhớ theo dõi kênh và bấm vào link')).toHaveLength(3);
    expect(calmTextProblems('Nghe là gặp may mắn')).toHaveLength(1);
    expect(calmTextProblems('xem tại chuanho.hoandat.com')).toEqual(['looks like a link or handle']);
    expect(calmTextProblems('Unlikely likeable words')).toEqual([]);
    expect(calmTextProblems('Gió qua sân chùa, lòng cũng lặng theo.')).toEqual([]);
  });
});

describe('video inputs', () => {
  const verses: Verse[] = [
    { id: 'tho', time: 'any', text: 'Thở vào thật chậm, thở ra thật nhẹ.' },
    { id: 'trang', time: 'night', text: 'Trăng lên đầu ngõ, ta nói khẽ thôi.' },
    { id: 'suong', time: 'morning', text: 'Sương sớm trên lá, nhẹ như hơi thở.' },
  ];
  const tracks = libraryEntries({ tracks: [{ id: 'm001', file: 'm001-a.mp3', duration: 150 }, { id: 'm002', file: 'm002-b.mp3', duration: 20 }, { id: 'm003', file: 'm003-c.mp3', duration: 170 }, { bad: true }] });
  const base = { scenes: ['scenes/night-1.png', 'scenes/morning-1.png', 'scenes/night-2.png'], time: undefined, tracks, removed: new Set<string>(), verses, past: [] as PastVideo[], seconds: 30 };

  it('picks the least-used scene, a long enough track and a verse for that scene', () => {
    const past: PastVideo[] = [{ trackId: 'm001', sceneFile: 'scenes/night-2.png', verseId: 'trang' }];
    const picked = chooseVideoInputs({ ...base, time: 'night', past });
    expect(picked).toEqual({ scene: { file: 'scenes/night-1.png', time: 'night' }, track: tracks[2], verse: verses[0] });
  });

  it('never uses a removed track and reports what is missing', () => {
    expect(chooseVideoInputs({ ...base, removed: new Set(['m001', 'm003']) })).toEqual({ missing: 'no library track of at least 35 s' });
    expect(chooseVideoInputs({ ...base, time: 'noon' })).toEqual({ missing: 'no passed noon scene picture' });
    expect(chooseVideoInputs({ ...base, scenes: ['elsewhere/foo.png'] })).toEqual({ missing: 'no passed scene picture' });
  });
});
