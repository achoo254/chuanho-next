/**
 * Which experience the page shows. The 3D game is opt-in while it is being built: production keeps the 2D yard
 * unless the address asks for 3D with `?v=3d` (or the hash `#3d`, handy where a query string gets stripped).
 */

/** True when the address opts into the 3D game. */
export function isGame3dRequested(search: string, hash: string): boolean {
  if (new URLSearchParams(search).get('v') === '3d') return true;
  return hash.replace(/^#/, '').toLowerCase() === '3d';
}

/** The render backend to try first; `?renderer=webgl2` forces WebGL2 for comparing the two on one device. */
export type RendererPreference = 'auto' | 'webgl2';

export function rendererPreference(search: string): RendererPreference {
  return new URLSearchParams(search).get('renderer') === 'webgl2' ? 'webgl2' : 'auto';
}

/** `?quality=low|medium|high|ultra` pins the quality rung and turns the automatic scaler off (for testing). */
export function pinnedQuality(search: string): string | null {
  return new URLSearchParams(search).get('quality');
}
