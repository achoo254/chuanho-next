/**
 * Time-of-day looks for the diorama as plain data: daylight (the default, bright and fresh), sunset, lantern night
 * and misty morning. Colours are token names from tokens.css; the engine resolves them to RGB once and then blends
 * between resolved looks, which keeps the blend pure and testable.
 */

export const LIGHTING_PRESET_IDS = ['daylight', 'sunset', 'lanternNight', 'mistyMorning'] as const;
export type LightingPresetId = (typeof LIGHTING_PRESET_IDS)[number];

/** An sRGB colour, each channel 0–1. */
export type Rgb = readonly [number, number, number];
export type Direction = readonly [number, number, number];

export interface LightingPreset {
  readonly skyTop: string;
  readonly skyHorizon: string;
  /** Multiplies the painted backdrop: white shows it as drawn, darker or warmer tints turn it to evening or night. */
  readonly backdropTint: string;
  readonly fog: string;
  /** Exponential fog density: the soft haze that sells the miniature. */
  readonly fogDensity: number;
  readonly hemiSky: string;
  readonly hemiGround: string;
  readonly hemiIntensity: number;
  readonly sun: string;
  readonly sunIntensity: number;
  /** Where the sun's light travels (towards the ground), not where the sun is. */
  readonly sunDirection: Direction;
  /** How brightly the lanterns burn (emissive strength); bloom picks up the bright ones. */
  readonly lanternGlow: number;
  readonly bloomWeight: number;
  readonly exposure: number;
  readonly contrast: number;
  readonly vignetteWeight: number;
}

export const LIGHTING_PRESETS: Readonly<Record<LightingPresetId, LightingPreset>> = {
  daylight: {
    skyTop: '--c-scene-day-sky-top',
    skyHorizon: '--c-scene-day-sky-horizon',
    backdropTint: '--c-scene-day-backdrop',
    fog: '--c-scene-day-fog',
    fogDensity: 0.004,
    hemiSky: '--c-scene-day-hemi-sky',
    hemiGround: '--c-scene-day-hemi-ground',
    hemiIntensity: 1.05,
    sun: '--c-scene-day-sun',
    sunIntensity: 2.6,
    sunDirection: [0.6, -0.8, 0.4],
    lanternGlow: 0.25,
    bloomWeight: 0.22,
    exposure: 1.2,
    contrast: 1.06,
    vignetteWeight: 0.5,
  },
  sunset: {
    skyTop: '--c-scene-sunset-sky-top',
    skyHorizon: '--c-scene-sunset-sky-horizon',
    backdropTint: '--c-scene-sunset-backdrop',
    fog: '--c-scene-sunset-fog',
    fogDensity: 0.006,
    hemiSky: '--c-scene-sunset-hemi-sky',
    hemiGround: '--c-scene-sunset-hemi-ground',
    hemiIntensity: 0.95,
    sun: '--c-scene-sunset-sun',
    sunIntensity: 2.4,
    sunDirection: [0.75, -0.55, 0.45],
    lanternGlow: 0.6,
    bloomWeight: 0.3,
    exposure: 1.12,
    contrast: 1.08,
    vignetteWeight: 0.9,
  },
  lanternNight: {
    skyTop: '--c-scene-night-sky-top',
    skyHorizon: '--c-scene-night-sky-horizon',
    backdropTint: '--c-scene-night-backdrop',
    fog: '--c-scene-night-fog',
    fogDensity: 0.008,
    hemiSky: '--c-scene-night-hemi-sky',
    hemiGround: '--c-scene-night-hemi-ground',
    hemiIntensity: 0.6,
    sun: '--c-scene-night-moon',
    sunIntensity: 1.1,
    sunDirection: [-0.5, -0.75, 0.4],
    lanternGlow: 3.2,
    bloomWeight: 0.85,
    exposure: 1.2,
    contrast: 1.1,
    vignetteWeight: 1.6,
  },
  mistyMorning: {
    skyTop: '--c-scene-morning-sky-top',
    skyHorizon: '--c-scene-morning-sky-horizon',
    backdropTint: '--c-scene-morning-backdrop',
    fog: '--c-scene-morning-fog',
    fogDensity: 0.012,
    hemiSky: '--c-scene-morning-hemi-sky',
    hemiGround: '--c-scene-morning-hemi-ground',
    hemiIntensity: 1.0,
    sun: '--c-scene-morning-sun',
    sunIntensity: 1.9,
    sunDirection: [-0.6, -0.7, 0.35],
    lanternGlow: 0.12,
    bloomWeight: 0.2,
    exposure: 1.08,
    contrast: 1.1,
    vignetteWeight: 0.7,
  },
};

/** A preset with its colours resolved: everything is a number or a tuple, so two looks can be blended. */
export interface ResolvedLighting {
  readonly skyTop: Rgb;
  readonly skyHorizon: Rgb;
  readonly backdropTint: Rgb;
  readonly fog: Rgb;
  readonly fogDensity: number;
  readonly hemiSky: Rgb;
  readonly hemiGround: Rgb;
  readonly hemiIntensity: number;
  readonly sun: Rgb;
  readonly sunIntensity: number;
  readonly sunDirection: Direction;
  readonly lanternGlow: number;
  readonly bloomWeight: number;
  readonly exposure: number;
  readonly contrast: number;
  readonly vignetteWeight: number;
}

export function resolveLighting(preset: LightingPreset, colourOf: (token: string) => Rgb): ResolvedLighting {
  return {
    ...preset,
    skyTop: colourOf(preset.skyTop),
    skyHorizon: colourOf(preset.skyHorizon),
    backdropTint: colourOf(preset.backdropTint),
    fog: colourOf(preset.fog),
    hemiSky: colourOf(preset.hemiSky),
    hemiGround: colourOf(preset.hemiGround),
    sun: colourOf(preset.sun),
  };
}

/** Written as a weighted sum so both ends land exactly on `a` and `b`. */
const mix = (a: number, b: number, t: number): number => a * (1 - t) + b * t;
const mix3 = (a: readonly [number, number, number], b: readonly [number, number, number], t: number): [number, number, number] => [
  mix(a[0], b[0], t),
  mix(a[1], b[1], t),
  mix(a[2], b[2], t),
];

/** The look `t` of the way from `from` to `to` (t is clamped to 0–1). */
export function blendLighting(from: ResolvedLighting, to: ResolvedLighting, t: number): ResolvedLighting {
  const k = Math.max(0, Math.min(1, t));
  return {
    skyTop: mix3(from.skyTop, to.skyTop, k),
    skyHorizon: mix3(from.skyHorizon, to.skyHorizon, k),
    backdropTint: mix3(from.backdropTint, to.backdropTint, k),
    fog: mix3(from.fog, to.fog, k),
    fogDensity: mix(from.fogDensity, to.fogDensity, k),
    hemiSky: mix3(from.hemiSky, to.hemiSky, k),
    hemiGround: mix3(from.hemiGround, to.hemiGround, k),
    hemiIntensity: mix(from.hemiIntensity, to.hemiIntensity, k),
    sun: mix3(from.sun, to.sun, k),
    sunIntensity: mix(from.sunIntensity, to.sunIntensity, k),
    sunDirection: mix3(from.sunDirection, to.sunDirection, k),
    lanternGlow: mix(from.lanternGlow, to.lanternGlow, k),
    bloomWeight: mix(from.bloomWeight, to.bloomWeight, k),
    exposure: mix(from.exposure, to.exposure, k),
    contrast: mix(from.contrast, to.contrast, k),
    vignetteWeight: mix(from.vignetteWeight, to.vignetteWeight, k),
  };
}

/** Smooth start and end for the transition between looks. */
export function easeInOut(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
}

/** The next look in the cycle (the HUD's time-of-day button). */
export function nextLightingPreset(current: LightingPresetId): LightingPresetId {
  const index = LIGHTING_PRESET_IDS.indexOf(current);
  return LIGHTING_PRESET_IDS[(index + 1) % LIGHTING_PRESET_IDS.length] ?? 'daylight';
}

export const isLightingPresetId = (value: unknown): value is LightingPresetId =>
  typeof value === 'string' && (LIGHTING_PRESET_IDS as readonly string[]).includes(value);

/** Parses `#rgb` or `#rrggbb` (what tokens.css holds) to channels 0–1; null for anything else. */
export function parseHexColour(value: string): Rgb | null {
  const hex = value.trim().replace(/^#/, '');
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  const channel = (offset: number): number => Number.parseInt(full.slice(offset, offset + 2), 16) / 255;
  return [channel(0), channel(2), channel(4)];
}
