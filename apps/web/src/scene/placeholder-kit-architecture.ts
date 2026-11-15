/**
 * Architecture and nature of the yard, built in code from primitives that wear the AI-made tiling textures: the
 * plinth the diorama stands on, a paving stone, the main hall with a two-tier curved roof, the bodhi tree, the bell
 * tower and a hanging lantern. Each builder returns one merged mesh standing on y = 0, facing −z (the camera).
 */
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { PartBuilder } from './placeholder-shapes';

/** The rounded base the whole diorama sits on (its top is y = 0). */
export function buildPlinth(kit: PartBuilder): Mesh {
  kit.cylinder('plinth', 1, 1, 1.4, [0, -0.72, 0], undefined, 48).scaling.set(19, 1, 15.5);
  kit.cylinder('stoneDark', 1, 1, 0.1, [0, -0.04, 0], undefined, 48).scaling.set(18.2, 1, 14.7);
  return kit.merge('plinth');
}

export function buildPavingStone(kit: PartBuilder): Mesh {
  kit.box('stone', [1.7, 0.12, 1.7], [0, 0.06, 0]);
  return kit.merge('paving-stone');
}

/** The main hall: stone platform and steps, red pillars, cream walls, two roof tiers with gold curled ends. */
export function buildTempleHall(kit: PartBuilder): Mesh {
  kit.box('stoneDark', [9, 0.6, 4.6], [0, 0.3, 0]);
  kit.box('stone', [3, 0.3, 0.8], [0, 0.15, -2.65]);
  kit.box('wall', [7, 2.4, 3.2], [0, 1.8, 0.2]);
  kit.box('lacquer', [1.6, 1.8, 0.1], [0, 1.5, -1.42]);
  kit.hipRoof('roof', 9.6, 4.6, 1.3, 0.56, [0, 3.65, 0.2]);
  kit.box('wall', [4.2, 0.5, 2.1], [0, 4.5, 0.2]);
  kit.hipRoof('roof', 6.4, 1.2, 1.3, 0.5, [0, 5.35, 0.2]);
  kit.box('lacquer', [4.4, 0.26, 0.26], [0, 6.05, 0.2]);
  // The upturned ends that make a Vietnamese roof read at a glance.
  for (const x of [-2.4, 2.4]) kit.sphere('gold', 0.5, [x, 6.2, 0.2]);
  for (const x of [-4.75, 4.75]) for (const z of [-2.5, 2.9]) kit.sphere('gold', 0.42, [x, 3.15, z]);
  for (const x of [-3.1, 3.1]) for (const z of [-1.4, 1.8]) kit.sphere('gold', 0.32, [x, 4.8, z]);
  return kit.merge('temple-hall');
}

/** A red lacquered pillar on a gold base, with a small gold capital (the hall's front pillars). */
export function buildPillar(kit: PartBuilder): Mesh {
  kit.cylinder('gold', 0.62, 0.66, 0.16, [0, 0.08, 0]);
  kit.cylinder('lacquer', 0.42, 0.46, 2.36, [0, 1.34, 0]);
  kit.cylinder('gold', 0.56, 0.46, 0.14, [0, 2.55, 0]);
  return kit.merge('pillar');
}

export function buildBodhiTree(kit: PartBuilder): Mesh {
  kit.cylinder('trunk', 0.34, 0.6, 2.6, [0, 1.3, 0]);
  kit.sphere('leaf', 2.8, [0, 3.2, 0], undefined, 12);
  kit.sphere('leafDeep', 2.2, [0.95, 2.75, 0.35], undefined, 12);
  kit.sphere('leaf', 2.0, [-0.85, 2.85, -0.35], undefined, 12);
  kit.sphere('leafDeep', 1.6, [0.1, 4.1, 0.2], undefined, 12);
  return kit.merge('bodhi-tree');
}

/** The bell tower: four red posts on a stone base, a small hipped roof and the big bronze bell inside. */
export function buildBellTower(kit: PartBuilder): Mesh {
  kit.box('stoneDark', [2.4, 0.3, 2.4], [0, 0.15, 0]);
  for (const x of [-0.85, 0.85]) for (const z of [-0.85, 0.85]) kit.cylinder('lacquer', 0.22, 0.26, 3, [x, 1.8, z]);
  kit.hipRoof('roof', 3.4, 0.4, 1, 1, [0, 3.75, 0]);
  for (const x of [-1.55, 1.55]) for (const z of [-1.55, 1.55]) kit.sphere('gold', 0.3, [x, 3.3, z]);
  kit.cylinder('bronze', 0.5, 0.85, 1, [0, 2.4, 0]);
  kit.sphere('bronze', 0.5, [0, 2.95, 0]);
  return kit.merge('bell-tower');
}

/**
 * A red lantern hanging from a wooden pole: a squat red globe between two gold caps, with a gold tassel below. The
 * arm reaches towards +x.
 */
export function buildLantern(kit: PartBuilder): Mesh {
  kit.cylinder('wood', 0.12, 0.16, 2.3, [0, 1.15, 0]);
  kit.box('wood', [0.7, 0.08, 0.08], [0.3, 2.25, 0]);
  kit.cylinder('wood', 0.02, 0.02, 0.2, [0.6, 2.13, 0]);
  kit.sphere('lantern', 0.6, [0.6, 1.76, 0], [1, 0.82, 1], 16);
  kit.cylinder('gold', 0.24, 0.32, 0.09, [0.6, 2.02, 0]);
  kit.cylinder('gold', 0.32, 0.24, 0.09, [0.6, 1.5, 0]);
  kit.cylinder('gold', 0.03, 0.09, 0.26, [0.6, 1.32, 0]);
  return kit.merge('lantern');
}
