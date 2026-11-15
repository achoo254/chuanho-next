/**
 * The character's face and blush as transparent decal textures, all laid out the same way (features in the middle
 * ~40% of a square, eyes about a third of the width apart): the AI-drawn PNGs in `/art/character/` when they
 * exist, otherwise faces drawn here on a canvas (dot eyes, small smile, round pink cheeks) so the character always
 * has a face. Each image is checked for the PNG signature first: a missing file comes back as the HTML page.
 */
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Scene } from '@babylonjs/core/scene';
import { FACES, type FaceName } from './character-poses';

const ART_BASE = '/art/character/';
const SIZE = 256;

export interface FaceTextures {
  readonly faces: Readonly<Record<FaceName, BaseTexture>>;
  readonly blush: BaseTexture;
  /** How many of the five images came from art files (the rest are drawn). */
  readonly artCount: number;
  dispose(): void;
}

async function isPng(url: string, signal: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return false;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  } catch {
    return false;
  }
}

function cssToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

type Painter = (ctx: CanvasRenderingContext2D) => void;

const eyesDots: Painter = (ctx) => {
  for (const x of [86, 170]) {
    ctx.beginPath();
    ctx.ellipse(x, 122, 10, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  }
};
const eyesClosedSmile: Painter = (ctx) => {
  for (const x of [86, 170]) {
    ctx.beginPath();
    ctx.arc(x, 128, 12, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
};
const smile = (radius: number): Painter => (ctx) => {
  ctx.beginPath();
  ctx.arc(128, 132, radius, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();
};

/** Face drawings by name; strokes and fills use the ink token. */
const FACE_PAINTERS: Readonly<Record<FaceName, Painter>> = {
  neutral: (ctx) => {
    eyesDots(ctx);
    smile(10)(ctx);
  },
  happy: (ctx) => {
    eyesClosedSmile(ctx);
    smile(13)(ctx);
  },
  sleepy: (ctx) => {
    for (const x of [86, 170]) {
      ctx.beginPath();
      ctx.moveTo(x - 13, 124);
      ctx.lineTo(x + 13, 124);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(128, 146, 5, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
  },
  perfect: (ctx) => {
    eyesClosedSmile(ctx);
    ctx.beginPath();
    ctx.arc(128, 136, 14, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
  },
};

function drawnTexture(scene: Scene, name: string, paint: Painter): DynamicTexture {
  const texture = new DynamicTexture(`face-${name}`, { width: SIZE, height: SIZE }, scene, true);
  texture.hasAlpha = true;
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, SIZE, SIZE);
  const ink = cssToken('--c-scene-ink');
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  paint(ctx);
  texture.update();
  return texture;
}

/** Two soft pink cheeks: stacked translucent discs, so no colour literal is needed for a gradient. */
const paintBlush: Painter = (ctx) => {
  ctx.fillStyle = cssToken('--c-scene-blush');
  for (const x of [52, 204]) {
    for (let ring = 0; ring < 5; ring += 1) {
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.ellipse(x, 134, 24 - ring * 4, 22 - ring * 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
};

async function artOrDrawn(scene: Scene, name: string, paint: Painter, signal: AbortSignal): Promise<{ texture: BaseTexture; art: boolean }> {
  const url = `${ART_BASE}${name}.png`;
  if (await isPng(url, signal)) {
    const texture = new Texture(url, scene, { noMipmap: false });
    texture.hasAlpha = true;
    return { texture, art: true };
  }
  return { texture: drawnTexture(scene, name, paint), art: false };
}

export async function loadFaceTextures(scene: Scene, signal: AbortSignal): Promise<FaceTextures> {
  const loaded = await Promise.all([
    ...FACES.map((face) => artOrDrawn(scene, `face-${face}`, FACE_PAINTERS[face], signal)),
    artOrDrawn(scene, 'blush', paintBlush, signal),
  ]);
  const faces = Object.fromEntries(FACES.map((face, index) => [face, loaded[index]?.texture])) as Record<FaceName, BaseTexture>;
  const blush = loaded[FACES.length]?.texture;
  if (!blush || FACES.some((face) => !faces[face])) throw new Error('Face textures incomplete');
  return {
    faces,
    blush,
    artCount: loaded.filter((entry) => entry.art).length,
    dispose() {
      for (const entry of loaded) entry.texture.dispose();
    },
  };
}
