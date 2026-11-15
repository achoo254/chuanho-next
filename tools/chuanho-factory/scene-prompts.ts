/**
 * Prompts for the time-of-day background pictures (artgen, workflow `qwen`, 9:16). One scene, four lights, the same
 * as the game's light variants. Text is never drawn by the model: captions are burned in later by ffmpeg.
 */
import type { TimeOfDay } from './job-types';

/** Qwen-Image's native 9:16 size; the video scales it to 1080x1920. */
export const SCENE_SIZE = { width: 928, height: 1664 } as const;

const BASE =
  'A small quiet Vietnamese pagoda courtyard on a green hillside, curved dark tiled roof, a stone lantern, a lotus pond, ' +
  'an old pine tree, soft painterly illustration with gentle colours, calm and peaceful, empty open sky in the upper third, ' +
  'vertical composition, no people, no text, no letters, no signs, no watermark';

const LIGHT: Record<TimeOfDay, string> = {
  morning: 'early morning, soft white mist drifting over the pond, pale blue and peach light',
  noon: 'bright noon sun, short soft shadows, clear blue sky, warm green leaves',
  evening: 'dusk, red paper lanterns glowing along the eaves, warm orange and violet sky',
  night: 'night, a full moon above the roof, silver moonlight on the water, deep blue sky, a few fireflies',
};

export const SCENE_NEGATIVE = 'text, letters, words, signature, watermark, logo, people, monk, statue, blurry, distorted';

export function scenePrompt(time: TimeOfDay): string {
  return `${BASE}, ${LIGHT[time]}`;
}

/** Deterministic seed per job and time, so a scene can be redrawn exactly. */
export function sceneSeed(jobId: string, time: TimeOfDay): number {
  let hash = 2166136261;
  for (const char of `${jobId}/${time}`) hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 16777619) >>> 0;
  return hash % 2_000_000_000;
}

/** `scenes/<time>-<stamp>-<seed>.png` -> time; undefined for files the factory did not name. */
export function sceneTimeOf(file: string): TimeOfDay | undefined {
  const match = /(?:^|[\\/])(morning|noon|evening|night)-[^\\/]+$/.exec(file);
  return match?.[1] as TimeOfDay | undefined;
}
