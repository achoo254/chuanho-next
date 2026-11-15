/**
 * A tiny particle system for soft puffs: the dust that jumps off the wooden fish on a hit and the smoke curling up
 * from a burning incense stick. A fixed pool of small low-poly spheres (GPU instances of one mesh) that grow, drift,
 * rise and shrink away; nothing is created while playing. Its motion is a pure function of age (`puffOffset`).
 */
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import type { Scene } from '@babylonjs/core/scene';
import { tokenColor3 } from '../scene/token-colours';

export interface PuffStyle {
  /** Life of one puff, ms. */
  readonly lifeMs: number;
  /** Outward speed, units per second. */
  readonly spread: number;
  /** Upward speed, units per second. */
  readonly rise: number;
  /** Largest diameter. */
  readonly size: number;
  /** Sideways sway of rising smoke. */
  readonly curl: number;
}

/** Offset from the emitting point and diameter of a puff `ageMs` old, heading out at `angle`. Pure. */
export function puffOffset(style: PuffStyle, ageMs: number, angle: number): { x: number; y: number; z: number; size: number } {
  const t = Math.max(0, Math.min(1, ageMs / style.lifeMs));
  const seconds = ageMs / 1000;
  const out = style.spread * seconds * (1 - t * 0.5);
  const sway = Math.sin(seconds * 3 + angle * 2) * style.curl * t;
  // Grows quickly, then shrinks to nothing by the end of its life.
  const size = style.size * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (t < 1 ? 1 : 0);
  return { x: Math.cos(angle) * out + sway, y: style.rise * seconds, z: Math.sin(angle) * out, size: Math.max(0, size) };
}

interface Puff {
  readonly mesh: InstancedMesh;
  age: number;
  angle: number;
  readonly origin: Vector3;
}

export interface PuffPool {
  /** Releases `count` puffs at once from `at` (spread round in a ring). */
  burst(at: Vector3, count: number): void;
  /** Releases one puff from `at` (a steady stream calls this at its own pace). */
  emit(at: Vector3): void;
  update(deltaMs: number): void;
  dispose(): void;
}

export function createPuffPool(scene: Scene, name: string, colourToken: string, alpha: number, capacity: number, style: PuffStyle): PuffPool {
  const material = new StandardMaterial(`${name}-material`, scene);
  material.disableLighting = true;
  material.emissiveColor = tokenColor3(colourToken);
  material.alpha = alpha;
  const source = CreateSphere(name, { diameter: 1, segments: 5 }, scene);
  source.material = material;
  source.isPickable = false;
  // Hidden itself; its instances still draw (they render through the source mesh, which must stay enabled).
  source.isVisible = false;
  const puffs: Puff[] = [];
  for (let i = 0; i < capacity; i += 1) {
    const mesh = source.createInstance(`${name}-${i}`);
    mesh.isPickable = false;
    mesh.setEnabled(false);
    puffs.push({ mesh, age: style.lifeMs, angle: 0, origin: new Vector3() });
  }
  let cursor = 0;
  let spins = 0;

  const release = (at: Vector3, angle: number): void => {
    const puff = puffs[cursor];
    cursor = (cursor + 1) % puffs.length;
    if (!puff) return;
    puff.age = 0;
    puff.angle = angle;
    puff.origin.copyFrom(at);
    puff.mesh.setEnabled(true);
  };

  return {
    burst(at, count) {
      for (let i = 0; i < count; i += 1) release(at, (i / count) * Math.PI * 2 + spins * 0.7);
      spins += 1;
    },
    emit(at) {
      spins += 1;
      release(at, spins * 2.39996);
    },
    update(deltaMs) {
      for (const puff of puffs) {
        if (puff.age >= style.lifeMs) continue;
        puff.age += deltaMs;
        if (puff.age >= style.lifeMs) {
          puff.mesh.setEnabled(false);
          continue;
        }
        const p = puffOffset(style, puff.age, puff.angle);
        puff.mesh.position.set(puff.origin.x + p.x, puff.origin.y + p.y, puff.origin.z + p.z);
        puff.mesh.scaling.setAll(Math.max(0.001, p.size));
      }
    },
    dispose() {
      for (const puff of puffs) puff.mesh.dispose();
      source.dispose();
      material.dispose();
    },
  };
}
