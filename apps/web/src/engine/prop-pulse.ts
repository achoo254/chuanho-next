/**
 * The scene's answer to a tap: the pressed prop squashes down and springs back in a quarter of a second, the way a
 * vinyl toy does. Several props can bounce at once; a new tap on the same prop restarts its bounce.
 */
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { InteractivePropId } from '../scene/world-actions';

const DURATION_MS = 260;

export interface PropPulse {
  start(prop: InteractivePropId): void;
  update(deltaMs: number): void;
}

export function createPropPulse(props: ReadonlyMap<InteractivePropId, TransformNode>): PropPulse {
  const running = new Map<InteractivePropId, number>();
  return {
    start(prop) {
      if (props.has(prop)) running.set(prop, 0);
    },
    update(deltaMs) {
      for (const [prop, elapsed] of running) {
        const node = props.get(prop);
        const t = elapsed + deltaMs;
        if (!node) {
          running.delete(prop);
          continue;
        }
        if (t >= DURATION_MS) {
          node.scaling.set(1, 1, 1);
          running.delete(prop);
          continue;
        }
        // A damped squash: down and wide first, then a small overshoot back up.
        const s = Math.sin((t / DURATION_MS) * Math.PI * 2) * (1 - t / DURATION_MS);
        node.scaling.set(1 + 0.08 * s, 1 - 0.14 * s, 1 + 0.08 * s);
        running.set(prop, t);
      }
    },
  };
}
