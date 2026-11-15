/**
 * Mõ Beat notes in the scene: glowing orbs flying along their arcs (note-orb-path.ts) onto the top of the wooden fish
 * in time with the music. A small pool of instances is reused; a judged hit pops (swells and vanishes) where it
 * landed, a miss just fades. The rhythm judge stays in the React layer; this only draws what it decided.
 */
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import type { Scene } from '@babylonjs/core/scene';
import type { NoteState } from '../game/rhythm-judge';
import { tokenColor3 } from '../scene/token-colours';
import { ORB_FLIGHT_MS, type Point3, noteOrbPlacement } from './note-orb-path';

/** What the orbs follow: the chart, the song clock and the judge's verdict per note. */
export interface BeatTrack {
  readonly notes: readonly number[];
  songTimeMs(): number | null;
  noteState(index: number): NoteState;
}

const POOL_SIZE = 18;
const ORB_SIZE = 0.28;
const POP_MS = 200;

export interface BeatNoteOrbs {
  setTrack(track: BeatTrack | null): void;
  /** Marks a note as just hit, so its orb pops (the time is the scene clock). */
  pop(noteIndex: number, nowMs: number): void;
  update(nowMs: number): void;
  dispose(): void;
}

export function createBeatNoteOrbs(scene: Scene, landing: () => Point3, reducedMotion: boolean): BeatNoteOrbs {
  const material = new StandardMaterial('note-orb', scene);
  material.disableLighting = true;
  // Bright enough to cross the bloom threshold, so the orbs glow.
  material.emissiveColor = tokenColor3('--c-scene-orb').scale(1.35);
  const source = CreateSphere('note-orb', { diameter: 1, segments: 10 }, scene);
  source.material = material;
  source.isPickable = false;
  // Hidden itself; its instances still draw (they render through the source mesh, which must stay enabled).
  source.isVisible = false;
  const pool: InstancedMesh[] = Array.from({ length: POOL_SIZE }, (_, i) => {
    const orb = source.createInstance(`note-orb-${i}`);
    orb.isPickable = false;
    orb.setEnabled(false);
    return orb;
  });
  const pops = new Map<number, number>();
  let track: BeatTrack | null = null;

  return {
    setTrack(next) {
      track = next;
      pops.clear();
      if (!next) for (const orb of pool) orb.setEnabled(false);
    },
    pop(noteIndex, nowMs) {
      pops.set(noteIndex, nowMs);
    },
    update(nowMs) {
      let used = 0;
      const now = track?.songTimeMs() ?? null;
      if (track && now !== null) {
        const target = landing();
        // Notes are in time order: skip those long gone, stop at the first not yet in flight.
        for (let index = 0; index < track.notes.length && used < pool.length; index += 1) {
          const ahead = (track.notes[index] ?? 0) - now;
          if (ahead > ORB_FLIGHT_MS) break;
          const state = track.noteState(index);
          const poppedAt = pops.get(index);
          const orb = pool[used];
          if (!orb) break;
          if (state === 'pending') {
            const placement = noteOrbPlacement(ahead, index, target);
            if (!placement.visible) continue;
            orb.position.set(placement.position.x, placement.position.y, placement.position.z);
            orb.scaling.setAll(ORB_SIZE * (0.55 + 0.45 * placement.progress));
          } else if (state !== 'miss' && poppedAt !== undefined && nowMs - poppedAt < POP_MS) {
            const t = (nowMs - poppedAt) / POP_MS;
            orb.position.set(target.x, target.y + (reducedMotion ? 0 : t * 0.25), target.z);
            orb.scaling.setAll(ORB_SIZE * (reducedMotion ? 1 - t : 1 + t * 1.6) * (1 - t * 0.6));
          } else {
            continue;
          }
          orb.setEnabled(true);
          used += 1;
        }
      }
      for (let i = used; i < pool.length; i += 1) pool[i]?.setEnabled(false);
    },
    dispose() {
      for (const orb of pool) orb.dispose();
      source.dispose();
      material.dispose();
    },
  };
}
