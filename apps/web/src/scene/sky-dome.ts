/**
 * The sky behind the garden: an AI-painted picture (public/art/backdrop/sky.webp: deep blue at the top, pale near the
 * horizon, soft clouds) drawn as a full-window background layer, scaled like CSS `object-fit: cover` and pinned to
 * the top edge. It only shows when the player lowers the free camera and the horizon comes into view; the garden,
 * hills and fog hide it otherwise. The time of day tints it.
 */
import { Layer } from '@babylonjs/core/Layers/layer';
import '@babylonjs/core/Layers/layerSceneComponent';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector2 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { Rgb } from './lighting-presets';

const SKY_URL = '/art/backdrop/sky.webp';
/** The picture's shape (2048 x 832). */
const SKY_ASPECT = 2048 / 832;

/** Scale and offset that make a picture of `imageAspect` cover a window of `aspect`, pinned to the top edge. */
export function coverTopLayout(aspect: number, imageAspect: number): { readonly scale: readonly [number, number]; readonly offsetY: number } {
  if (!(aspect > 0)) return { scale: [1, 1], offsetY: 0 };
  const scale: readonly [number, number] = aspect > imageAspect ? [1, aspect / imageAspect] : [imageAspect / aspect, 1];
  return { scale, offsetY: 1 - scale[1] };
}

export interface SkyDome {
  /** Tints the painted sky (white shows it as drawn). */
  tint(colour: Rgb): void;
  /** Keeps the picture covering the window as its shape changes. */
  fit(aspect: number): void;
  dispose(): void;
}

export function createSkyDome(scene: Scene): SkyDome {
  const layer = new Layer('painted-sky', SKY_URL, scene, true);
  let lastAspect = 0;
  return {
    tint(colour) {
      layer.color = new Color4(colour[0], colour[1], colour[2], 1);
    },
    fit(aspect) {
      if (aspect === lastAspect) return;
      lastAspect = aspect;
      const { scale, offsetY } = coverTopLayout(aspect, SKY_ASPECT);
      layer.scale = new Vector2(scale[0], scale[1]);
      layer.offset = new Vector2(0, offsetY);
    },
    dispose() {
      layer.dispose();
    },
  };
}
