/**
 * The AI-painted ground around the diorama: a sunlit meadow with a lotus pond and a stream, a seamless picture
 * repeated under the plinth. It is what the camera sees beyond the plinth, tinted by the time of day so the same picture reads as
 * noon, evening or night.
 */
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import type { Scene } from '@babylonjs/core/scene';
import type { Rgb } from './lighting-presets';

const MEADOW_URL = '/art/backdrop/meadow.webp';
/** World size of one repeat of the (seamless) picture. */
const MEADOW_TILE = 28;
const MEADOW_SIZE = 120;
/** A little above the plinth's underside so the plinth looks set into the grass. */
const MEADOW_Y = -0.9;

export interface PaintedBackdrop {
  /** Tints the picture (white shows it as drawn). */
  tint(colour: Rgb): void;
  dispose(): void;
}

export function createPaintedBackdrop(scene: Scene): PaintedBackdrop {
  const meadowTexture = new Texture(MEADOW_URL, scene);
  meadowTexture.wrapU = Texture.WRAP_ADDRESSMODE;
  meadowTexture.wrapV = Texture.WRAP_ADDRESSMODE;
  meadowTexture.uScale = MEADOW_SIZE / MEADOW_TILE;
  meadowTexture.vScale = MEADOW_SIZE / MEADOW_TILE;
  const material = new StandardMaterial('painted-meadow', scene);
  material.diffuseTexture = meadowTexture;
  material.specularColor = Color3.Black();
  const meadow = CreateGround('painted-meadow', { width: MEADOW_SIZE, height: MEADOW_SIZE }, scene);
  meadow.position.y = MEADOW_Y;
  meadow.material = material;
  meadow.isPickable = false;
  meadow.receiveShadows = true;

  return {
    tint(colour) {
      material.diffuseColor = new Color3(colour[0], colour[1], colour[2]);
    },
    dispose() {
      meadow.dispose();
      material.dispose();
      meadowTexture.dispose();
    },
  };
}
