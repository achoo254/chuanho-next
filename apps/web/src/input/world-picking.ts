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
  /** The tappable prop under a screen point (CSS pixels), whether or not picking is enabled. */
  pickPropAt(clientX: number, clientY: number): InteractivePropId | null;
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

  // Active pointers on empty ground, for the two-finger pinch zoom.
  const touches = new Map<number, { x: number; y: number }>();
  let pinchLast = 0;
  const pinchDistance = (): number => {
    const [a, b] = [...touches.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

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
  const pickPoint = (clientX: number, clientY: number): InteractivePropId | null => {
    const rect = canvas.getBoundingClientRect();
    const hit = scene.pick(clientX - rect.left, clientY - rect.top, (mesh) => mesh.isPickable && mesh.isEnabled());
    return hit.hit ? propOfNode(hit.pickedMesh) : null;
  };
  const pickAt = (event: PointerEvent): InteractivePropId | null => pickPoint(event.clientX, event.clientY);

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
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size === 2) {
      // A second finger turns the drag into a pinch.
      sway.endDrag();
      pinchLast = pinchDistance();
    } else {
      sway.beginDrag(event.clientX, event.clientY);
    }
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
  };
  const onPointerMove = (event: PointerEvent): void => {
    if (touches.has(event.pointerId)) touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size === 2) {
      const distance = pinchDistance();
      if (pinchLast > 0 && distance > 0) sway.zoomBy(pinchLast / distance);
      pinchLast = distance;
      return;
    }
    if (sway.dragging) {
      sway.dragTo(event.clientX, event.clientY);
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
    const wasPinching = touches.size === 2;
    touches.delete(event.pointerId);
    if (wasPinching) pinchLast = 0;
    if (!sway.dragging && !wasPinching) return;
    sway.endDrag();
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
  };
  const onPointerLeave = (): void => setHovered(null, null);
  const onWheel = (event: WheelEvent): void => {
    if (!enabled) return;
    event.preventDefault();
    // Deltas come in pixels, lines or pages depending on the device; the response is smooth and exponential.
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
    sway.zoomBy(Math.exp(event.deltaY * unit * 0.0012));
  };
  const onDoubleClick = (event: MouseEvent): void => {
    if (enabled && !pickPoint(event.clientX, event.clientY)) sway.resetView();
  };

  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('dblclick', onDoubleClick);

  return {
    pickPropAt: pickPoint,
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
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('dblclick', onDoubleClick);
      highlight.removeAllMeshes();
    },
  };
}
