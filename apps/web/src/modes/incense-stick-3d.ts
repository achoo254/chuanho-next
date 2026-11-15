/**
 * The incense stick the player lights in the censer: a thin stick standing in the bowl, burning down from the top
 * while held, with a glowing ember at its tip and smoke curling up from it. Part of the censer (a child of its node),
 * so pressing the stick counts as pressing the censer.
 */
import type { Material } from '@babylonjs/core/Materials/material';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { tokenColor3 } from '../scene/token-colours';
import { type PuffPool, createPuffPool } from './puff-particles';

const STICK_LENGTH = 0.9;
/** Share of the stick that burns away by the end. */
const BURN_AWAY = 0.55;
const SMOKE_EVERY_MS = 140;

export interface IncenseStick3d {
  /** 0 = fresh, 1 = lit through; null puts the stick away. */
  setBurn(fraction: number | null): void;
  /** Whether smoke is pouring (while the player holds). */
  setSmoking(on: boolean): void;
  update(deltaMs: number): void;
  dispose(): void;
}

export function createIncenseStick(scene: Scene, censer: TransformNode, stickMaterial: Material, reducedMotion: boolean): IncenseStick3d {
  censer.computeWorldMatrix(true);
  const { min, max } = censer.getHierarchyBoundingVectors(true);
  // Stands in the bowl, a little above the middle of the censer's height (the bowl's rim on the kit's censer).
  const base = new TransformNode('incense-stick', scene);
  base.parent = censer;
  base.position.set(0.08, (max.y - min.y) * 0.62, -0.05);
  base.rotation.z = -0.08;

  const stick = CreateCylinder('incense-body', { diameter: 0.045, height: STICK_LENGTH, tessellation: 8 }, scene);
  stick.setPivotPoint(new Vector3(0, -STICK_LENGTH / 2, 0));
  stick.position.y = STICK_LENGTH / 2;
  stick.material = stickMaterial;
  stick.parent = base;

  const emberMaterial = new StandardMaterial('incense-ember', scene);
  emberMaterial.disableLighting = true;
  emberMaterial.emissiveColor = tokenColor3('--c-ember').scale(1.6);
  const ember = CreateSphere('incense-ember', { diameter: 0.07, segments: 8 }, scene);
  ember.material = emberMaterial;
  ember.parent = base;
  for (const mesh of [stick, ember]) mesh.isPickable = true;

  const smoke: PuffPool = createPuffPool(scene, 'incense-smoke', '--c-scene-smoke', 0.35, 26, {
    lifeMs: 2600,
    spread: 0.04,
    rise: 0.42,
    size: 0.2,
    curl: reducedMotion ? 0 : 0.12,
  });
  let burn: number | null = null;
  let smoking = false;
  let sinceSmoke = 0;
  const tip = new Vector3();

  const place = (): void => {
    base.setEnabled(burn !== null);
    if (burn === null) return;
    const length = 1 - BURN_AWAY * burn;
    stick.scaling.y = length;
    ember.position.y = STICK_LENGTH * length;
    ember.setEnabled(burn > 0);
  };
  place();

  return {
    setBurn(fraction) {
      burn = fraction === null ? null : Math.max(0, Math.min(1, fraction));
      place();
    },
    setSmoking(on) {
      smoking = on;
    },
    update(deltaMs) {
      sinceSmoke += deltaMs;
      // Lit incense keeps a thin wisp; holding it pours more.
      const every = smoking ? SMOKE_EVERY_MS : SMOKE_EVERY_MS * 4;
      if (burn !== null && burn > 0 && sinceSmoke >= every) {
        sinceSmoke = 0;
        ember.computeWorldMatrix(true);
        tip.copyFrom(ember.getAbsolutePosition());
        smoke.emit(tip);
      }
      smoke.update(deltaMs);
    },
    dispose() {
      smoke.dispose();
      base.dispose(false, false);
      emberMaterial.dispose();
    },
  };
}
