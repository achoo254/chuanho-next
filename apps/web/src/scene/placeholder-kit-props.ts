/**
 * Placeholder props the player taps (censer, sutra stand, small bell, singing bowl, wooden board, wooden fish) and
 * the chibi stand-in for the character. Same rules as the architecture kit: one merged mesh, standing on y = 0,
 * facing −z.
 */
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { PartBuilder } from './placeholder-shapes';

/** The bronze incense burner on a stone stand, three sticks standing in it. */
export function buildCenser(kit: PartBuilder): Mesh {
  kit.cylinder('stoneDark', 1.2, 1.4, 0.35, [0, 0.175, 0]);
  for (const angle of [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]) {
    kit.cylinder('bronze', 0.1, 0.14, 0.4, [Math.sin(angle) * 0.3, 0.5, Math.cos(angle) * 0.3]);
  }
  kit.sphere('bronze', 1, [0, 0.95, 0], [1, 0.7, 1]);
  kit.torus('gold', 0.82, 0.12, [0, 1.25, 0]);
  for (const x of [-0.12, 0, 0.12]) kit.cylinder('wood', 0.035, 0.035, 0.7, [x, 1.55, 0], [0, 0, x * 0.8]);
  return kit.merge('censer');
}

/** A low wooden lectern with sutra books on it. */
export function buildSutraShelf(kit: PartBuilder): Mesh {
  kit.box('wood', [1.7, 0.7, 0.9], [0, 0.35, 0]);
  kit.box('lacquer', [1.8, 0.08, 1], [0, 0.74, 0]);
  kit.box('book', [0.85, 0.16, 0.62], [-0.2, 0.86, 0], [0, 0.15, 0]);
  kit.box('book', [0.75, 0.14, 0.55], [0.35, 0.84, -0.05], [0, -0.2, 0]);
  kit.box('book', [0.7, 0.12, 0.5], [-0.15, 1.0, 0.02], [0, -0.1, 0]);
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

/** The wooden fish on its cushion, with the mallet leaning against it. */
export function buildMo(kit: PartBuilder): Mesh {
  kit.cylinder('lacquer', 1.0, 1.1, 0.2, [0, 0.1, 0]);
  kit.sphere('mo', 0.85, [0, 0.55, 0], [1.2, 0.85, 1]);
  kit.box('ink', [0.55, 0.05, 0.12], [0, 0.55, -0.4]);
  kit.cylinder('wood', 0.06, 0.06, 0.75, [0.62, 0.45, -0.1], [0, 0, 0.75]);
  kit.sphere('vinyl', 0.18, [0.36, 0.73, -0.1]);
  return kit.merge('mo');
}

/** The chibi stand-in: round white body, big head, dot eyes and pink cheeks. Replaced by the coded character later. */
export function buildCharacter(kit: PartBuilder): Mesh {
  kit.sphere('vinyl', 0.9, [0, 0.42, 0], [1, 0.9, 0.95]);
  kit.sphere('vinyl', 1.05, [0, 1.22, 0], undefined, 20);
  for (const x of [-0.17, 0.17]) kit.sphere('ink', 0.1, [x, 1.28, -0.49], undefined, 8);
  for (const x of [-0.3, 0.3]) kit.sphere('blush', 0.16, [x, 1.13, -0.44], [1, 0.6, 0.4], 8);
  for (const x of [-0.42, 0.42]) kit.sphere('vinyl', 0.28, [x, 0.5, -0.2], undefined, 10);
  return kit.merge('character');
}
