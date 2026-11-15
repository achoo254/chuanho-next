/**
 * What a hit note turns into: a bright flash, a ring of lotus petals thrown out and drifting down round the wooden
 * fish, and a few twinkling sparkles (more of both for PERFECT). A few bursts can overlap; they reuse a fixed pool of
 * sprites from the shared atlas, so nothing is created while playing. Motion is the pure burst* functions.
 */
import type { Sprite } from '@babylonjs/core/Sprites/sprite';
import type { SpriteManager } from '@babylonjs/core/Sprites/spriteManager';
import { tokenColor3 } from '../scene/token-colours';
import { BEAT_CELL, pooledSprite } from './beat-sprite-atlas';
import { BURST_MS, BURST_PETALS, BURST_SPARKLES, type BurstGrade, type BurstPiece, burstFlash, burstPetal, burstSparkle } from './beat-note-motion';
import type { Point3 } from './note-orb-path';

const SLOTS = 3;

interface Burst {
  readonly flash: Sprite;
  readonly petals: readonly Sprite[];
  readonly sparkles: readonly Sprite[];
  startedAt: number;
  grade: BurstGrade;
  at: Point3;
}

export interface HitBursts {
  fire(at: Point3, grade: BurstGrade, nowMs: number): void;
  update(nowMs: number): void;
  /** Hides every burst at once (the song stopped). */
  clear(): void;
  /** Ms since the latest burst started, or null when none is playing (drives the ripple ring). */
  latestAge(nowMs: number): number | null;
}

function place(sprite: Sprite, at: Point3, piece: BurstPiece | null, visibleCount: boolean): void {
  if (!piece || !visibleCount || piece.size <= 0.001) {
    sprite.isVisible = false;
    return;
  }
  sprite.isVisible = true;
  sprite.position.set(at.x + piece.x, at.y + piece.y, at.z + piece.z);
  sprite.size = piece.size;
  sprite.angle = piece.angle;
  sprite.color.a = piece.alpha;
}

export function createHitBursts(manager: SpriteManager, reducedMotion: boolean): HitBursts {
  const flashTint = tokenColor3('--c-beat-note-glow');
  const sparkleTint = tokenColor3('--c-beat-sparkle');
  const maxPetals = BURST_PETALS.perfect;
  const maxSparkles = BURST_SPARKLES.perfect;
  const bursts: Burst[] = Array.from({ length: SLOTS }, (_, slot) => {
    const flash = pooledSprite(manager, `beat-flash-${slot}`, BEAT_CELL.glow);
    // Brighter than white: the flash crosses the bloom threshold.
    flash.color.set(flashTint.r * 1.5, flashTint.g * 1.5, flashTint.b * 1.5, 1);
    return {
      flash,
      petals: Array.from({ length: maxPetals }, (_, i) => pooledSprite(manager, `beat-petal-${slot}-${i}`, BEAT_CELL.petal)),
      sparkles: Array.from({ length: maxSparkles }, (_, i) => {
        const sparkle = pooledSprite(manager, `beat-sparkle-${slot}-${i}`, BEAT_CELL.sparkle);
        sparkle.color.set(sparkleTint.r * 1.5, sparkleTint.g * 1.5, sparkleTint.b * 1.5, 1);
        return sparkle;
      }),
      startedAt: Number.NEGATIVE_INFINITY,
      grade: 'good',
      at: { x: 0, y: 0, z: 0 },
    };
  });
  let cursor = 0;
  let latest = Number.NEGATIVE_INFINITY;

  const hide = (burst: Burst): void => {
    burst.flash.isVisible = false;
    for (const sprite of [...burst.petals, ...burst.sparkles]) sprite.isVisible = false;
  };

  return {
    fire(at, grade, nowMs) {
      const burst = bursts[cursor];
      cursor = (cursor + 1) % bursts.length;
      if (!burst) return;
      burst.startedAt = nowMs;
      burst.grade = grade;
      burst.at = at;
      latest = nowMs;
    },
    update(nowMs) {
      for (const burst of bursts) {
        const age = nowMs - burst.startedAt;
        if (!(age >= 0 && age < BURST_MS)) {
          hide(burst);
          continue;
        }
        const flash = burstFlash(age);
        place(burst.flash, burst.at, { x: 0, y: 0.04, z: 0, size: 0.9 * flash.scale, angle: 0, alpha: flash.alpha }, true);
        const petals = BURST_PETALS[burst.grade];
        burst.petals.forEach((sprite, i) => place(sprite, burst.at, burstPetal(i, petals, age, reducedMotion), i < petals));
        const sparkles = BURST_SPARKLES[burst.grade];
        burst.sparkles.forEach((sprite, i) => place(sprite, burst.at, burstSparkle(i, sparkles, age, reducedMotion), i < sparkles));
      }
    },
    clear() {
      for (const burst of bursts) {
        burst.startedAt = Number.NEGATIVE_INFINITY;
        hide(burst);
      }
      latest = Number.NEGATIVE_INFINITY;
    },
    latestAge(nowMs) {
      const age = nowMs - latest;
      return age >= 0 && age < BURST_MS ? age : null;
    },
  };
}
