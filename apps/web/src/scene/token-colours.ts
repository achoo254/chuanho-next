/**
 * The scene's colours come from tokens.css like the rest of the app: read once from the document's computed style,
 * cached, and handed to Babylon as Color3 (sRGB) or linear Color3 (what PBR materials and lights expect).
 */
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { type Rgb, parseHexColour } from './lighting-presets';

const NEUTRAL: Rgb = [0.5, 0.5, 0.5];
const cache = new Map<string, Rgb>();

/** A token's colour; a missing or non-hex token logs once and draws neutral grey rather than breaking the scene. */
export function tokenRgb(token: string): Rgb {
  const cached = cache.get(token);
  if (cached) return cached;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token);
  const parsed = parseHexColour(raw);
  if (!parsed) console.warn(`Colour token ${token} is missing or not hex; using grey`);
  const colour = parsed ?? NEUTRAL;
  cache.set(token, colour);
  return colour;
}

export function rgbToColor3(rgb: Rgb): Color3 {
  return new Color3(rgb[0], rgb[1], rgb[2]);
}

/** For PBR albedo and light colours, which Babylon treats as linear. */
export function rgbToLinearColor3(rgb: Rgb): Color3 {
  return rgbToColor3(rgb).toLinearSpace();
}

export function tokenColor3(token: string): Color3 {
  return rgbToColor3(tokenRgb(token));
}

export function tokenLinearColor3(token: string): Color3 {
  return rgbToLinearColor3(tokenRgb(token));
}
