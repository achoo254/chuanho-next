/**
 * Mõ Beat notes in the scene: AI-drawn lotus blossoms (and a glowing lantern on the first beat of each bar) flying
 * along their arcs (note-orb-path.ts) onto the top of the wooden fish in time with the music, each wrapped in a soft
 * glow and trailing a short comet tail of sparkles. The halo round the wooden fish breathes on the beat and a ring
 * closes in as each note arrives; a hit bursts into petals and sparkles, a miss greys out and sinks. A fixed pool of
 * sprites from one atlas is reused. The rhythm judge stays in the React layer; this only draws what it decided.
 */
import type { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Sprite } from '@babylonjs/core/Sprites/sprite';
import type { Scene } from '@babylonjs/core/scene';
import type { NoteState } from '../game/rhythm-judge';
import { tokenColor3 } from '../scene/token-colours';
import { createHitBursts } from './beat-hit-bursts';
import { TRAIL_STEPS, approachRing, beatPulse, burstFlash, isAccentNote, trailStep } from './beat-note-motion';
import { BEAT_CELL, createBeatSpriteManager, pooledSprite } from './beat-sprite-atlas';
import { createTargetRing } from './beat-target-ring';
import { ORB_FLIGHT_MS, type Point3, noteOrbPlacement } from './note-orb-path';

/** What the notes follow: the chart, its beat length, the song clock and the judge's verdict per note. */
export interface BeatTrack {
  readonly notes: readonly number[];
  readonly beatMs: number;
  songTimeMs(): number | null;
  noteState(index: number): NoteState;
}

const POOL_SIZE = 16;
const NOTE_SIZE = 0.5;
const GLOW_SCALE = 2;
const POP_MS = 160;
const MISS_MS = 480;
/** Bursts and particles on top of the notes. */
const BURST_SPRITES = 3 * (1 + 10 + 6);

export interface BeatNoteOrbs {
  setTrack(track: BeatTrack | null): void;
  /** Marks a note as just hit, so it bursts (the time is the scene clock). */
  pop(noteIndex: number, nowMs: number): void;
  update(nowMs: number): void;
  dispose(): void;
}

/** Colours a sprite with a token colour at a brightness (above 1 blooms) and an opacity. */
function tint(sprite: Sprite, colour: Color3, brightness: number, alpha: number): void {
  sprite.color.set(colour.r * brightness, colour.g * brightness, colour.b * brightness, alpha);
}

interface Slot {
  readonly glow: Sprite;
  readonly trail: readonly Sprite[];
  readonly note: Sprite;
}

export function createBeatNoteOrbs(scene: Scene, landing: () => Point3, reducedMotion: boolean): BeatNoteOrbs {
  const manager = createBeatSpriteManager(scene, POOL_SIZE * (2 + TRAIL_STEPS) + BURST_SPRITES);
  const ring = createTargetRing(scene);
  const miss = tokenColor3('--c-beat-miss-tint');
  const glowTint = tokenColor3('--c-beat-note-glow');
  const sparkleTint = tokenColor3('--c-beat-sparkle');
  // Creation order is draw order: every glow, then every trail, then the notes, then the bursts on top.
  const glows = Array.from({ length: POOL_SIZE }, (_, i) => pooledSprite(manager, `beat-glow-${i}`, BEAT_CELL.glow));
  const trails = Array.from({ length: POOL_SIZE }, (_, i) =>
    Array.from({ length: TRAIL_STEPS }, (_, step) => pooledSprite(manager, `beat-trail-${i}-${step}`, BEAT_CELL.sparkle)),
  );
  const slots: Slot[] = glows.map((glow, i) => ({ glow, trail: trails[i] ?? [], note: pooledSprite(manager, `beat-note-${i}`, BEAT_CELL.lotus) }));
  const bursts = createHitBursts(manager, reducedMotion);

  const pops = new Map<number, number>();
  const burstFired = new Set<number>();
  const missedAt = new Map<number, number>();
  let track: BeatTrack | null = null;

  const hideSlot = (slot: Slot): void => {
    slot.glow.isVisible = false;
    slot.note.isVisible = false;
    for (const sprite of slot.trail) sprite.isVisible = false;
  };

  /** Draws one note in a slot; false when there is nothing to draw for it right now. */
  const drawNote = (slot: Slot, index: number, now: number, nowMs: number, target: Point3, pulse: number, beatMs: number): boolean => {
    if (!track) return false;
    const noteMs = track.notes[index] ?? 0;
    const ahead = noteMs - now;
    const state = track.noteState(index);
    const accent = isAccentNote(noteMs, beatMs);
    slot.note.cellIndex = accent ? BEAT_CELL.lantern : BEAT_CELL.lotus;
    for (const sprite of slot.trail) sprite.isVisible = false;

    if (state === 'pending') {
      const placement = noteOrbPlacement(ahead, index, target);
      if (!placement.visible) return false;
      const { x, y, z } = placement.position;
      const size = NOTE_SIZE * (accent ? 1.1 : 1) * (0.7 + 0.3 * placement.progress);
      const fadeIn = Math.min(1, placement.progress * 6);
      slot.note.position.set(x, y, z);
      slot.note.size = size;
      slot.note.angle = reducedMotion ? 0 : Math.sin(nowMs / 260 + index * 1.7) * 0.14;
      slot.note.color.set(1, 1, 1, fadeIn);
      slot.glow.position.set(x, y, z);
      slot.glow.size = size * GLOW_SCALE * (1 + pulse * 0.12);
      tint(slot.glow, glowTint, 1.1, fadeIn * (0.55 + pulse * 0.3));
      if (!reducedMotion) {
        slot.trail.forEach((sprite, step) => {
          const shape = trailStep(step);
          const behind = noteOrbPlacement(ahead + shape.lag * ORB_FLIGHT_MS, index, target);
          if (!behind.visible) return;
          sprite.isVisible = true;
          sprite.position.set(behind.position.x, behind.position.y, behind.position.z);
          sprite.size = size * 0.55 * shape.scale;
          sprite.angle = nowMs / 400 + step;
          tint(sprite, sparkleTint, 1.3, shape.alpha * fadeIn);
        });
      }
    } else if (state === 'miss') {
      const since = missedAt.get(index) ?? nowMs;
      missedAt.set(index, since);
      const t = (nowMs - since) / MISS_MS;
      if (t >= 1) return false;
      slot.note.position.set(target.x, target.y - (reducedMotion ? 0 : t * 0.35), target.z);
      slot.note.size = NOTE_SIZE * (1 - t * 0.3);
      slot.note.angle = reducedMotion ? 0 : t * 0.6;
      slot.note.color.set(miss.r, miss.g, miss.b, 1 - t);
      slot.glow.isVisible = false;
      slot.note.isVisible = true;
      return true;
    } else {
      const poppedAt = pops.get(index);
      if (poppedAt === undefined) return false;
      if (!burstFired.has(index)) {
        burstFired.add(index);
        bursts.fire(target, state, poppedAt);
      }
      const t = (nowMs - poppedAt) / POP_MS;
      if (t < 0 || t >= 1) return false;
      slot.note.position.set(target.x, target.y, target.z);
      slot.note.size = NOTE_SIZE * (1 + t * 0.5);
      slot.note.color.set(1, 1, 1, 1 - t);
      slot.glow.position.set(target.x, target.y, target.z);
      slot.glow.size = NOTE_SIZE * GLOW_SCALE * (1 + t);
      tint(slot.glow, glowTint, 1.3, 1 - t);
    }
    slot.note.isVisible = true;
    slot.glow.isVisible = true;
    return true;
  };

  return {
    setTrack(next) {
      track = next;
      pops.clear();
      burstFired.clear();
      missedAt.clear();
      if (!next) {
        for (const slot of slots) hideSlot(slot);
        bursts.clear();
        ring.show(null);
      }
    },
    pop(noteIndex, nowMs) {
      pops.set(noteIndex, nowMs);
    },
    update(nowMs) {
      let used = 0;
      const now = track?.songTimeMs() ?? null;
      if (track && now !== null) {
        const target = landing();
        const pulse = reducedMotion ? 0 : beatPulse(now, track.beatMs);
        let nextAhead = Number.POSITIVE_INFINITY;
        // Notes are in time order: skip those long gone, stop at the first not yet in flight.
        for (let index = 0; index < track.notes.length; index += 1) {
          const ahead = (track.notes[index] ?? 0) - now;
          if (ahead > ORB_FLIGHT_MS) break;
          if (ahead >= 0 && ahead < nextAhead && track.noteState(index) === 'pending') nextAhead = ahead;
          const slot = slots[used];
          if (slot && drawNote(slot, index, now, nowMs, target, pulse, track.beatMs)) used += 1;
        }
        const rippleAge = bursts.latestAge(nowMs);
        ring.show(target);
        ring.update({ pulse, approach: approachRing(nextAhead), ripple: rippleAge === null ? { scale: 0, alpha: 0 } : burstFlash(rippleAge) });
      }
      for (let i = used; i < slots.length; i += 1) {
        const slot = slots[i];
        if (slot) hideSlot(slot);
      }
      bursts.update(nowMs);
    },
    dispose() {
      ring.dispose();
      manager.dispose();
    },
  };
}
