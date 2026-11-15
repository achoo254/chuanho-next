/**
 * Placeholder props the player taps (censer, sutra stand, small bell, singing bowl, wooden board, wooden fish) and
 * the mallet the character holds. Same rules as the architecture kit: one merged mesh, standing on y = 0, facing −z.
 * The character itself is built in code (character/), not from the kit.
 */
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { PartBuilder } from './placeholder-shapes';

/**
 * The round bronze incense pot on a stone stand: three legs, a gold rim, dark ash inside and two ring handles. No
 * sticks: the player lights their own in the incense mode.
 */
export function buildCenser(kit: PartBuilder): Mesh {
  kit.cylinder('stoneDark', 1.2, 1.4, 0.35, [0, 0.175, 0]);
  for (const angle of [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]) {
    kit.cylinder('bronze', 0.1, 0.14, 0.42, [Math.sin(angle) * 0.3, 0.52, Math.cos(angle) * 0.3]);
  }
  kit.sphere('bronze', 1, [0, 0.98, 0], [1, 0.72, 1], 24);
  kit.torus('gold', 0.8, 0.1, [0, 1.3, 0]);
  kit.cylinder('ink', 0.72, 0.72, 0.04, [0, 1.3, 0]);
  for (const x of [-0.52, 0.52]) kit.torus('gold', 0.26, 0.06, [x, 1.14, 0], [0, 0, Math.PI / 2]);
  return kit.merge('censer');
}

/** A wooden lectern holding an open sutra book, its two pages tilted towards the reader (−z). */
export function buildSutraShelf(kit: PartBuilder): Mesh {
  for (const x of [-0.7, 0.7]) kit.box('wood', [0.12, 0.7, 0.6], [x, 0.35, 0]);
  kit.box('lacquer', [1.7, 0.1, 0.8], [0, 0.72, 0]);
  kit.box('wood', [1.2, 0.08, 0.7], [0, 0.95, 0.05], [-0.45, 0, 0]);
  kit.box('book', [0.52, 0.04, 0.6], [-0.27, 1.02, 0.02], [-0.45, 0, -0.1]);
  kit.box('book', [0.52, 0.04, 0.6], [0.27, 1.02, 0.02], [-0.45, 0, 0.1]);
  kit.box('lacquer', [0.05, 0.05, 0.62], [0, 1.01, 0.03], [-0.45, 0, 0]);
  return kit.merge('sutra-shelf');
}

/** A small bronze bell hanging in a wooden frame. */
export function buildBell(kit: PartBuilder): Mesh {
  for (const x of [-0.5, 0.5]) kit.cylinder('wood', 0.1, 0.12, 1.5, [x, 0.75, 0]);
  kit.box('wood', [1.2, 0.12, 0.12], [0, 1.5, 0]);
  kit.cylinder('bronze', 0.32, 0.58, 0.62, [0, 1.0, 0]);
  kit.sphere('bronze', 0.3, [0, 1.35, 0]);
  return kit.merge('bell');
}

/** A singing bowl resting on a red cushion. */
export function buildBowl(kit: PartBuilder): Mesh {
  kit.cylinder('lacquer', 0.85, 0.95, 0.18, [0, 0.09, 0]);
  kit.cylinder('bronze', 0.78, 0.48, 0.38, [0, 0.37, 0]);
  kit.torus('gold', 0.74, 0.06, [0, 0.56, 0]);
  return kit.merge('bowl');
}

/** A notice board under a little roof: the way to the journal and the radio. */
export function buildWoodenBoard(kit: PartBuilder): Mesh {
  for (const x of [-0.7, 0.7]) kit.cylinder('wood', 0.12, 0.14, 1.7, [x, 0.85, 0]);
  kit.box('wood', [1.6, 1.0, 0.1], [0, 1.15, 0]);
  kit.box('book', [1.3, 0.7, 0.04], [0, 1.15, -0.07]);
  kit.box('roof', [1.95, 0.14, 0.45], [0, 1.78, 0]);
  return kit.merge('wooden-board');
}

/**
 * The wooden fish alone (it rests on the lotus stand, a separate prop, so it can squash when struck): a round,
 * slightly flattened wooden body with a carved ridge, standing on y = 0. The open mouth is added in code for both
 * this placeholder and the model (mo-mouth-cavity.ts).
 */
export function buildMo(kit: PartBuilder): Mesh {
  kit.sphere('mo', 0.62, [0, 0.29, 0], [1.12, 0.92, 1], 24);
  kit.torus('lacquer', 0.5, 0.05, [0, 0.47, 0]);
  kit.sphere('lacquer', 0.12, [0, 0.56, 0.05], [1.4, 0.6, 1.6], 10);
  return kit.merge('mo');
}

/** The mallet, upright with the grip at y = 0: a jointed wooden handle, a cream padded head, a gold tassel below. */
export function buildMallet(kit: PartBuilder): Mesh {
  kit.cylinder('wood', 0.05, 0.055, 0.52, [0, 0.2, 0]);
  for (const y of [0.04, 0.18, 0.32]) kit.torus('lacquer', 0.062, 0.022, [0, y, 0]);
  kit.sphere('cream', 0.16, [0, 0.5, 0], [1, 1.1, 1], 14);
  kit.cylinder('gold', 0.02, 0.045, 0.14, [0, -0.13, 0]);
  kit.sphere('gold', 0.05, [0, -0.06, 0], undefined, 8);
  return kit.merge('mallet');
}
