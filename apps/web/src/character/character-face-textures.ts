/**
 * The character's drawn parts as textures: AI-drawn eyes, mouths and blush (transparent WebP in `/art/character/`)
 * and the robe's patchwork fabric. Every eye image shares one layout (the pair centred in a 2:1 frame, about 80% of
 * its width), every mouth another (centred in a square), so the decals swap without moving. When an image is
 * missing (an offline cache miss, for example) a plain drawing made here on a canvas stands in, so the character
 * always has a face. Each file is checked for the WebP signature first: a missing file comes back as the HTML page.
 */
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Scene } from '@babylonjs/core/scene';
import { EYE_SHAPES, type EyeShape, MOUTH_SHAPES, type MouthShape } from './face-expressions';

const ART_BASE = '/art/character/';

export interface FaceTextures {
  readonly eyes: Readonly<Record<EyeShape, BaseTexture>>;
  readonly mouths: Readonly<Record<MouthShape, BaseTexture>>;
  readonly blush: BaseTexture;
  /** The robe's patchwork, near white (the robe colour token tints it); null when the file is missing. */
  readonly robe: Texture | null;
  /** How many images came from art files (the rest are drawn). */
  readonly artCount: number;
  dispose(): void;
}

async function isWebp(url: string, signal: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return false;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const ascii = (from: number, to: number): string => String.fromCharCode(...bytes.slice(from, to));
    return bytes.length > 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
  } catch {
    return false;
  }
}

function cssToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

type Painter = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

/** Stand-in drawings, in the same layout as the art: eyes a third of the width apart, mouth in the middle. */
const eyePair =
  (draw: (ctx: CanvasRenderingContext2D, x: number, y: number) => void): Painter =>
  (ctx, width, height) => {
    for (const x of [width * 0.3, width * 0.7]) {
      ctx.beginPath();
      draw(ctx, x, height / 2);
    }
  };

const EYE_PAINTERS: Readonly<Record<EyeShape, Painter>> = {
  open: eyePair((ctx, x, y) => {
    ctx.ellipse(x, y, 36, 50, 0, 0, Math.PI * 2);
    ctx.fill();
  }),
  happy: eyePair((ctx, x, y) => {
    ctx.arc(x, y + 20, 40, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }),
  calm: eyePair((ctx, x, y) => {
    ctx.arc(x, y - 20, 40, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
  }),
  sleepy: eyePair((ctx, x, y) => {
    ctx.moveTo(x - 40, y);
    ctx.lineTo(x + 40, y);
    ctx.stroke();
  }),
};

const MOUTH_PAINTERS: Readonly<Record<MouthShape, Painter>> = {
  smile: (ctx, width, height) => {
    ctx.beginPath();
    ctx.arc(width / 2, height / 2 - 30, 50, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
  },
  grin: (ctx, width, height) => {
    ctx.beginPath();
    ctx.arc(width / 2, height / 2 - 20, 60, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
  },
  o: (ctx, width, height) => {
    ctx.beginPath();
    ctx.ellipse(width / 2, height / 2, 26, 36, 0, 0, Math.PI * 2);
    ctx.fill();
  },
};

/** Two soft pink cheeks: stacked translucent discs, so no colour literal is needed for a gradient. */
const paintBlush: Painter = (ctx, width, height) => {
  ctx.fillStyle = cssToken('--c-scene-blush');
  for (const x of [width * 0.2, width * 0.8]) {
    for (let ring = 0; ring < 5; ring += 1) {
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.ellipse(x, height / 2, 90 - ring * 14, 60 - ring * 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
};

function drawnTexture(scene: Scene, name: string, width: number, height: number, paint: Painter): DynamicTexture {
  const texture = new DynamicTexture(`character-${name}`, { width, height }, scene, true);
  texture.hasAlpha = true;
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, width, height);
  const ink = cssToken('--c-scene-ink');
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 22;
  ctx.lineCap = 'round';
  paint(ctx, width, height);
  texture.update();
  return texture;
}

interface Loaded {
  readonly texture: BaseTexture;
  readonly art: boolean;
}

async function artOrDrawn(scene: Scene, name: string, size: readonly [number, number], paint: Painter, signal: AbortSignal): Promise<Loaded> {
  const url = `${ART_BASE}${name}.webp`;
  if (await isWebp(url, signal)) {
    const texture = new Texture(url, scene, { noMipmap: false });
    texture.hasAlpha = true;
    return { texture, art: true };
  }
  return { texture: drawnTexture(scene, name, size[0], size[1], paint), art: false };
}

async function loadRobe(scene: Scene, signal: AbortSignal): Promise<Texture | null> {
  const url = `${ART_BASE}robe-fabric.webp`;
  return (await isWebp(url, signal)) ? new Texture(url, scene, { noMipmap: false }) : null;
}

export async function loadFaceTextures(scene: Scene, signal: AbortSignal): Promise<FaceTextures> {
  const [eyeList, mouthList, blush, robe] = await Promise.all([
    Promise.all(EYE_SHAPES.map((shape) => artOrDrawn(scene, `eyes-${shape}`, [512, 256], EYE_PAINTERS[shape], signal))),
    Promise.all(MOUTH_SHAPES.map((shape) => artOrDrawn(scene, `mouth-${shape}`, [256, 256], MOUTH_PAINTERS[shape], signal))),
    artOrDrawn(scene, 'blush', [512, 256], paintBlush, signal),
    loadRobe(scene, signal),
  ]);
  const all: Loaded[] = [...eyeList, ...mouthList, blush];
  const byShape = <K extends string>(keys: readonly K[], list: readonly Loaded[]): Record<K, BaseTexture> => {
    const entries = keys.map((key, index) => {
      const loaded = list[index];
      if (!loaded) throw new Error(`Character texture ${key} missing`);
      return [key, loaded.texture] as const;
    });
    return Object.fromEntries(entries) as Record<K, BaseTexture>;
  };
  return {
    eyes: byShape(EYE_SHAPES, eyeList),
    mouths: byShape(MOUTH_SHAPES, mouthList),
    blush: blush.texture,
    robe,
    artCount: all.filter((entry) => entry.art).length + (robe ? 1 : 0),
    dispose() {
      for (const entry of all) entry.texture.dispose();
      robe?.dispose();
    },
  };
}
