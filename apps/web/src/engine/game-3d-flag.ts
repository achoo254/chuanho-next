/**
 * Which experience the page shows. The 3D game is the default; the old 2D yard stays reachable with `?v=2d`
 * (or the hash `#2d`) as an escape hatch until it is removed.
 */

/** True unless the address explicitly asks for the old 2D page. */
export function isGame3dRequested(search: string, hash: string): boolean {
  if (new URLSearchParams(search).get('v') === '2d') return false;
  return hash.replace(/^#/, '').toLowerCase() !== '2d';
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
