/**
 * The world as a menu: a ray from the pointer finds the prop under it. With a mouse, hovering a prop makes it glow
 * and turns the cursor into a hand; pressing (pointerdown, so a tap answers at once) picks it. Pressing empty ground
 * starts a small drag that turns the camera instead.
 */
import type { HighlightLayer } from '@babylonjs/core/Layers/highlightLayer';
import type { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import '@babylonjs/core/Culling/ray';
import type { Scene } from '@babylonjs/core/scene';
import { propOfNode } from '../scene/build-diorama';
import type { InteractivePropId } from '../scene/world-actions';
import type { CameraSwayInput } from './camera-sway-input';

export interface WorldPickingOptions {
  readonly scene: Scene;
  readonly canvas: HTMLCanvasElement;
  readonly props: ReadonlyMap<InteractivePropId, TransformNode>;
  readonly highlight: HighlightLayer;
  readonly glow: Color3;
  readonly sway: CameraSwayInput;
  /** A prop was pressed. */
  onPick(prop: InteractivePropId): void;
  /** The hovered prop changed (null = none), with the pointer's place for a hint. */
  onHover(prop: InteractivePropId | null, clientX: number, clientY: number): void;
}

export interface WorldPicking {
  /** Glows a prop without the pointer (the corner bar, the keyboard); null clears it. */
  setFocus(prop: InteractivePropId | null): void;
  /** Turns picking off while a dialog covers the scene. */
  setEnabled(enabled: boolean): void;
  dispose(): void;
}

export function createWorldPicking(options: WorldPickingOptions): WorldPicking {
  const { scene, canvas, props, highlight, glow, sway } = options;
  let enabled = true;
  let hovered: InteractivePropId | null = null;
  let focused: InteractivePropId | null = null;
  let pendingMove: PointerEvent | null = null;
  let frame = 0;

  const glowing = new Set<Mesh>();
  const refreshGlow = (): void => {
    const wanted = new Set<Mesh>();
    for (const prop of [hovered, focused]) {
      const node = prop ? props.get(prop) : undefined;
      if (!node) continue;
      const meshes = node instanceof Mesh ? [node, ...node.getChildMeshes(false)] : node.getChildMeshes(false);
      for (const mesh of meshes) if (mesh instanceof Mesh) wanted.add(mesh);
    }
    for (const mesh of glowing) if (!wanted.has(mesh)) highlight.removeMesh(mesh);
    for (const mesh of wanted) if (!glowing.has(mesh)) highlight.addMesh(mesh, glow);
    glowing.clear();
    for (const mesh of wanted) glowing.add(mesh);
  };

  /** The canvas-relative point of a pointer event, in CSS pixels (what scene.pick expects). */
  const pickAt = (event: PointerEvent): InteractivePropId | null => {
    const rect = canvas.getBoundingClientRect();
    const hit = scene.pick(event.clientX - rect.left, event.clientY - rect.top, (mesh) => mesh.isPickable && mesh.isEnabled());
    return hit.hit ? propOfNode(hit.pickedMesh) : null;
  };

  const setHovered = (prop: InteractivePropId | null, event: PointerEvent | null): void => {
    if (prop === hovered) return;
    hovered = prop;
    canvas.style.cursor = prop ? 'pointer' : sway.dragging ? 'grabbing' : 'grab';
    refreshGlow();
    options.onHover(prop, event?.clientX ?? 0, event?.clientY ?? 0);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (!enabled || event.button > 0) return;
    const prop = pickAt(event);
    if (prop) {
      options.onPick(prop);
      return;
    }
    sway.beginDrag(event.clientX);
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
  };
  const onPointerMove = (event: PointerEvent): void => {
    if (sway.dragging) {
      sway.dragTo(event.clientX);
      return;
    }
    if (!enabled || event.pointerType !== 'mouse') return;
    // One ray per animation frame at most, however fast the mouse reports.
    pendingMove = event;
    if (!frame) {
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (pendingMove) setHovered(pickAt(pendingMove), pendingMove);
        pendingMove = null;
      });
    }
  };
  const onPointerUp = (event: PointerEvent): void => {
    if (!sway.dragging) return;
    sway.endDrag();
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
  };
  const onPointerLeave = (): void => setHovered(null, null);

  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);

  return {
    setFocus(prop) {
      focused = prop;
      refreshGlow();
    },
    setEnabled(next) {
      enabled = next;
      if (!next) setHovered(null, null);
    },
    dispose() {
      if (frame) cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      highlight.removeAllMeshes();
    },
  };
}
