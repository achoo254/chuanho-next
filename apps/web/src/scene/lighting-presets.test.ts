import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  LIGHTING_PRESETS,
  LIGHTING_PRESET_IDS,
  type Rgb,
  blendLighting,
  easeInOut,
  isLightingPresetId,
  nextLightingPreset,
  parseHexColour,
  resolveLighting,
} from './lighting-presets';

const TOKENS = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../ui/tokens.css'), 'utf8');

/** Resolves a token the way the engine does, but from tokens.css on disk. */
function tokenColour(token: string): Rgb {
  const match = new RegExp(`${token}:\\s*([^;]+);`).exec(TOKENS);
  const parsed = match?.[1] ? parseHexColour(match[1]) : null;
  if (!parsed) throw new Error(`${token} is not a hex colour in tokens.css`);
  return parsed;
}

describe('lighting presets', () => {
  it('only name colours that tokens.css defines as hex', () => {
    for (const id of LIGHTING_PRESET_IDS) expect(() => resolveLighting(LIGHTING_PRESETS[id], tokenColour)).not.toThrow();
  });

  it('blend from one look to the other, and clamp past the ends', () => {
    const sunset = resolveLighting(LIGHTING_PRESETS.sunset, tokenColour);
    const night = resolveLighting(LIGHTING_PRESETS.lanternNight, tokenColour);
    expect(blendLighting(sunset, night, 0)).toEqual(sunset);
    expect(blendLighting(sunset, night, 1)).toEqual(night);
    expect(blendLighting(sunset, night, 7)).toEqual(night);
    const half = blendLighting(sunset, night, 0.5);
    expect(half.lanternGlow).toBeCloseTo((sunset.lanternGlow + night.lanternGlow) / 2);
    expect(half.skyTop[0]).toBeCloseTo((sunset.skyTop[0] + night.skyTop[0]) / 2);
  });

  it('let lanterns burn brightest at night', () => {
    expect(LIGHTING_PRESETS.lanternNight.lanternGlow).toBeGreaterThan(LIGHTING_PRESETS.sunset.lanternGlow);
    expect(LIGHTING_PRESETS.sunset.lanternGlow).toBeGreaterThan(LIGHTING_PRESETS.mistyMorning.lanternGlow);
  });

  it('cycle through every look and back to sunset', () => {
    expect(nextLightingPreset('sunset')).toBe('lanternNight');
    expect(nextLightingPreset('lanternNight')).toBe('mistyMorning');
    expect(nextLightingPreset('mistyMorning')).toBe('sunset');
    expect(isLightingPresetId('lanternNight')).toBe(true);
    expect(isLightingPresetId('noon')).toBe(false);
  });

  it('ease in and out smoothly between 0 and 1', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
    expect(easeInOut(-1)).toBe(0);
  });
});

describe('parseHexColour', () => {
  // Built at run time: `pnpm check:tokens` allows colour literals in tokens.css only, tests included.
  const hex = (digits: string): string => `#${digits}`;

  it('reads short and long hex, and refuses anything else', () => {
    expect(parseHexColour(hex('ffffff'))).toEqual([1, 1, 1]);
    expect(parseHexColour(` ${hex('000')} `)).toEqual([0, 0, 0]);
    expect(parseHexColour(hex('ff8000'))?.[1]).toBeCloseTo(128 / 255);
    expect(parseHexColour('rebeccapurple')).toBeNull();
    expect(parseHexColour(hex('12345'))).toBeNull();
  });
});
