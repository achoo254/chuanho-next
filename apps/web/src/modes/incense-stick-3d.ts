/**
 * The three incense sticks the player lights in the censer: three thin sticks standing in the bowl, burning down from the top
 * while held, with a glowing ember at its tip and smoke curling up from it. Part of the censer (a child of its node),
 * so pressing a stick counts as pressing the censer.
 */
import type { Material } from '@babylonjs/core/Materials/material';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { tokenColor3 } from '../scene/token-colours';
import { type PuffPool, createPuffPool } from './puff-particles';

const STICK_LENGTH = 0.9;
/** Share of the stick that burns away by the end. */
const BURN_AWAY = 0.55;
const SMOKE_EVERY_MS = 140;
/** The smallest ember a dimmed (not out) flame keeps, as a share of its full size. */
const MIN_EMBER_SIZE = 0.35;
/** Below this ember level no smoke rises at all. */
const SMOKE_MIN_EMBER = 0.05;

/** The three sticks: sideways offset, front-back offset, lean and relative height (the middle one stands tallest). */
const STICK_LAYOUT = [
  { x: -0.07, z: 0.0, tilt: 0.14, height: 0.94 },
  { x: 0, z: -0.02, tilt: 0, height: 1 },
  { x: 0.07, z: 0.0, tilt: -0.14, height: 0.94 },
] as const;

interface StickParts {
  readonly mesh: Mesh;
  readonly ember: Mesh;
  readonly layout: (typeof STICK_LAYOUT)[number];
}

export interface IncenseStick3d {
  /** 0 = fresh, 1 = lit through; null puts the stick away. */
  setBurn(fraction: number | null): void;
  /** Whether smoke is pouring (while the player holds). */
  setSmoking(on: boolean): void;
  /**
   * How bright the ember glows, 0 (dark, no smoke) to 1 (full, the default): scales the ember's size and glow and the
   * smoke rate. Never changes the stick's length (that is `setBurn`).
   */
  setEmberLevel(level: number): void;
  update(deltaMs: number): void;
  dispose(): void;
}

export function createIncenseStick(scene: Scene, censer: TransformNode, stickMaterial: Material, reducedMotion: boolean): IncenseStick3d {
  censer.computeWorldMatrix(true);
  const { min, max } = censer.getHierarchyBoundingVectors(true);
  // Stands in the bowl, a little above the middle of the censer's height (the bowl's rim on the kit's censer).
  const base = new TransformNode('incense-stick', scene);
  base.parent = censer;
  base.position.set(0.02, (max.y - min.y) * 0.62, -0.05);

  const emberMaterial = new StandardMaterial('incense-ember', scene);
  emberMaterial.disableLighting = true;
  const fullEmber = tokenColor3('--c-ember').scale(1.6);
  emberMaterial.emissiveColor = fullEmber.clone();
  // A lit offering is three sticks side by side, fanned a little, the middle one a touch taller.
  const sticks: StickParts[] = STICK_LAYOUT.map((layout, index) => {
    const mesh = CreateCylinder(`incense-body-${index}`, { diameter: 0.04, height: STICK_LENGTH, tessellation: 8 }, scene);
    mesh.setPivotPoint(new Vector3(0, -STICK_LENGTH / 2, 0));
    mesh.position.set(layout.x, STICK_LENGTH / 2, layout.z);
    mesh.rotation.z = layout.tilt;
    mesh.material = stickMaterial;
    mesh.parent = base;
    const tipBall = CreateSphere(`incense-ember-${index}`, { diameter: 0.06, segments: 8 }, scene);
    tipBall.material = emberMaterial;
    tipBall.parent = mesh;
    for (const part of [mesh, tipBall]) part.isPickable = true;
    return { mesh, ember: tipBall, layout };
  });

  const smoke: PuffPool = createPuffPool(scene, 'incense-smoke', '--c-scene-smoke', 0.35, 26, {
    lifeMs: 2600,
    spread: 0.04,
    rise: 0.42,
    size: 0.2,
    curl: reducedMotion ? 0 : 0.12,
  });
  let burn: number | null = null;
  let smoking = false;
  let emberLevel = 1;
  let sinceSmoke = 0;
  let nextSmoker = 0;
  const tip = new Vector3();

  const place = (): void => {
    base.setEnabled(burn !== null);
    if (burn === null) return;
    const length = 1 - BURN_AWAY * burn;
    for (const { mesh, ember, layout } of sticks) {
      mesh.scaling.y = length * layout.height;
      // The ember is a child of the stick, so it sits at the top of the (scaled) stick in the stick's own units.
      ember.position.y = STICK_LENGTH / 2;
      const size = MIN_EMBER_SIZE + (1 - MIN_EMBER_SIZE) * emberLevel;
      ember.scaling.set(size, size / Math.max(0.2, length * layout.height), size);
      ember.setEnabled(burn > 0 && emberLevel > 0);
    }
    fullEmber.scaleToRef(emberLevel, emberMaterial.emissiveColor);
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
    setEmberLevel(level) {
      const next = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 1;
      if (next === emberLevel) return;
      emberLevel = next;
      place();
    },
    update(deltaMs) {
      sinceSmoke += deltaMs;
      // Lit incense keeps a thin wisp; holding it pours more; a dimmed ember smokes less in step with its glow.
      const every = (smoking ? SMOKE_EVERY_MS : SMOKE_EVERY_MS * 4) / Math.max(SMOKE_MIN_EMBER, emberLevel);
      if (burn !== null && burn > 0 && emberLevel >= SMOKE_MIN_EMBER && sinceSmoke >= every) {
        sinceSmoke = 0;
        const lit = sticks[nextSmoker % sticks.length];
        nextSmoker += 1;
        if (lit) {
          lit.ember.computeWorldMatrix(true);
          tip.copyFrom(lit.ember.getAbsolutePosition());
          smoke.emit(tip);
        }
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
