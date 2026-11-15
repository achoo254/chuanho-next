/**
 * ffmpeg arguments for a calm 9:16 video: one scene picture with a slow Ken Burns zoom, gentle fades, a library
 * track (optionally under a verse voice-over, the music ducking while the voice speaks), the verse burned in with
 * Be Vietnam Pro inside the Reels/TikTok safe zone, loudness-normalised for the short-video apps. Pure: the caller
 * runs ffmpeg in a work directory holding `font.ttf` and `verse.txt`, so no Windows drive colon ever reaches the
 * filter parser.
 */

export interface RenderSpec {
  readonly scene: string;
  readonly track: string;
  /** Where to start inside the track (skips the library fade-in). */
  readonly trackStartSeconds: number;
  readonly voice?: string;
  readonly seconds: number;
  /** Name of the text file in the work directory; omitted means no caption. */
  readonly textFile?: string;
  readonly fontFile: string;
  readonly output: string;
}

export const WIDTH = 1080;
export const HEIGHT = 1920;
export const FPS = 30;
const ZOOM_END = 1.08;
const FADE_IN = 1.5;
const FADE_OUT = 2;
const VOICE_DELAY = 2.5;
const TARGET_LUFS = -16;
/** Safe zone: clear of the top bar, the bottom fifth (caption, music bar) and the right button column. */
const SAFE_LEFT = 0.08;
const SAFE_RIGHT = 0.16;
const TEXT_TOP = 0.2;
const FONT_SIZE = 62;

const fixed = (n: number, digits = 3): string => n.toFixed(digits);

/** Splits a verse into short centred lines: at commas when the parts fit, otherwise greedily by words. */
export function wrapVerse(text: string, maxChars = 22): string[] {
  const clean = text.normalize('NFC').replace(/\s+/g, ' ').trim();
  const parts = clean.split(/(?<=,)\s+/);
  if (parts.length > 1 && parts.every((p) => p.length <= maxChars)) return parts;
  const lines: string[] = [];
  let line = '';
  for (const word of clean.split(' ')) {
    if (line && `${line} ${word}`.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Caption opacity: appears after the picture fades in, leaves before the picture fades out. */
export function captionAlpha(seconds: number): string {
  const inStart = 2;
  const outEnd = seconds - FADE_OUT - 0.5;
  return `if(lt(t,${inStart}),0,if(lt(t,${inStart + 1.5}),(t-${inStart})/1.5,if(gt(t,${fixed(outEnd - 1.5)}),max(0,(${fixed(outEnd)}-t)/1.5),1)))`;
}

export function videoFilter(spec: RenderSpec): string {
  const frames = Math.round(spec.seconds * FPS);
  const rate = (ZOOM_END - 1) / frames;
  const chain = [
    // Upscale 2x first so zoompan's integer crop steps are invisible (no jitter), then zoom towards the centre.
    `scale=${WIDTH * 2}:${HEIGHT * 2}:force_original_aspect_ratio=increase:flags=lanczos`,
    `crop=${WIDTH * 2}:${HEIGHT * 2}`,
    `zoompan=z='min(1+${rate.toExponential(4)}*on,${ZOOM_END})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${WIDTH}x${HEIGHT}:fps=${FPS}`,
  ];
  if (spec.textFile) {
    const centre = SAFE_LEFT + (1 - SAFE_LEFT - SAFE_RIGHT) / 2;
    chain.push(
      `drawtext=fontfile=${spec.fontFile}:textfile=${spec.textFile}:expansion=none:text_align=C:fontsize=${FONT_SIZE}:line_spacing=22:fontcolor=white` +
        `:shadowcolor=black@0.45:shadowx=0:shadowy=3:x=w*${centre}-text_w/2:y=h*${TEXT_TOP}:alpha='${captionAlpha(spec.seconds)}'`,
    );
  }
  chain.push(`fade=t=in:st=0:d=${FADE_IN}`, `fade=t=out:st=${fixed(spec.seconds - FADE_OUT)}:d=${FADE_OUT}`, 'format=yuv420p');
  return `[0:v]${chain.join(',')}[v]`;
}

export function audioFilter(spec: RenderSpec): string {
  const s = spec.seconds;
  const music = `[1:a]atrim=0:${fixed(s)},asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:d=2,afade=t=out:st=${fixed(s - 3)}:d=3`;
  const finish = `loudnorm=I=${TARGET_LUFS}:TP=-1.5:LRA=11,aresample=48000`;
  if (!spec.voice) return `${music},${finish}[a]`;
  const delayMs = Math.round(VOICE_DELAY * 1000);
  return [
    `${music}[m]`,
    `[2:a]aresample=48000,adelay=${delayMs}:all=1,apad,atrim=0:${fixed(s)}[vo]`,
    '[vo]asplit=2[vkey][vmix]',
    '[m][vkey]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=500[duck]',
    `[duck][vmix]amix=inputs=2:normalize=0:duration=first,${finish}[a]`,
  ].join(';');
}

export function renderArgs(spec: RenderSpec): string[] {
  if (spec.seconds < 15 || spec.seconds > 60) throw new Error(`video length ${spec.seconds} s is outside 15-60 s`);
  const inputs = ['-i', spec.scene, '-ss', fixed(spec.trackStartSeconds), '-i', spec.track, ...(spec.voice ? ['-i', spec.voice] : [])];
  return [
    '-hide_banner', '-v', 'error', '-y',
    ...inputs,
    '-filter_complex', `${videoFilter(spec)};${audioFilter(spec)}`,
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
    '-movflags', '+faststart', '-t', fixed(spec.seconds),
    spec.output,
  ];
}

/** Longest voice-over that still fits: it starts after the fade-in and must end before the fade-out. */
export function maxVoiceSeconds(videoSeconds: number): number {
  return videoSeconds - VOICE_DELAY - FADE_OUT - 1;
}
