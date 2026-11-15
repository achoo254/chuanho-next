/** URL switches for the 3D game (test and comparison aids). */

/** The render backend to try first; `?renderer=webgl2` forces WebGL2 for comparing the two on one device. */
export type RendererPreference = 'auto' | 'webgl2';

export function rendererPreference(search: string): RendererPreference {
  return new URLSearchParams(search).get('renderer') === 'webgl2' ? 'webgl2' : 'auto';
}

/** `?quality=low|medium|high|ultra` pins the quality rung and turns the automatic scaler off (for testing). */
export function pinnedQuality(search: string): string | null {
  return new URLSearchParams(search).get('quality');
}
