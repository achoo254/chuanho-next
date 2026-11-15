/**
 * The Mõ Beat sprites share one AI-drawn atlas (`/art/beat/beat-atlas.webp`, 4 × 2 cells of 256 px), so every note,
 * glow, trail sparkle and burst petal draws in a single batch. Sprites always face the camera; they keep the depth
 * test (the wooden fish and the character still hide what is behind them) but do not write depth, so the soft edges
 * of overlapping sprites blend instead of cutting holes in each other. Draw order is creation order: create the glows
 * first and the bursts last.
 */
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Sprite } from '@babylonjs/core/Sprites/sprite';
import { SpriteManager } from '@babylonjs/core/Sprites/spriteManager';
import '@babylonjs/core/Sprites/spriteSceneComponent';
import type { Scene } from '@babylonjs/core/scene';

export const BEAT_ATLAS_URL = '/art/beat/beat-atlas.webp';
const CELL_PX = 256;

/** Which cell of the atlas holds which picture. */
export const BEAT_CELL = { lotus: 0, lantern: 1, glow: 2, sparkle: 3, petal: 4 } as const;

export function createBeatSpriteManager(scene: Scene, capacity: number): SpriteManager {
  const manager = new SpriteManager('beat-sprites', BEAT_ATLAS_URL, capacity, CELL_PX, scene);
  manager.isPickable = false;
  manager.disableDepthWrite = true;
  manager.fogEnabled = false;
  return manager;
}

/** A hidden sprite of the given cell, ready for the pool. */
export function pooledSprite(manager: SpriteManager, name: string, cell: number): Sprite {
  const sprite = new Sprite(name, manager);
  sprite.cellIndex = cell;
  sprite.isVisible = false;
  sprite.isPickable = false;
  sprite.color = new Color4(1, 1, 1, 1);
  return sprite;
}
