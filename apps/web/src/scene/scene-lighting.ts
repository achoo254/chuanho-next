/**
 * Light for the diorama: a sky/ground hemisphere light (the soft fill that stands in for an environment), one sun
 * (or moon) casting soft shadows, a warm lantern light near the censer, exponential fog and the sky gradient.
 * `setPreset` glides from the current look to another over a couple of seconds (at once with reduced motion).
 */
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Scene } from '@babylonjs/core/scene';
import type { QualityLevel } from '../engine/quality-levels';
import { LIGHTING_PRESETS, type LightingPresetId, type ResolvedLighting, blendLighting, easeInOut, resolveLighting } from './lighting-presets';
import type { MaterialPalette } from './placeholder-materials';
import type { PostProcessing } from './post-processing';
import type { SkyDome } from './sky-dome';
import { rgbToColor3, rgbToLinearColor3, tokenRgb } from './token-colours';

const TRANSITION_MS = 2400;
const SHADOW_FILTERS = {
  low: ShadowGenerator.QUALITY_LOW,
  medium: ShadowGenerator.QUALITY_MEDIUM,
  high: ShadowGenerator.QUALITY_HIGH,
} as const;

export interface SceneLighting {
  readonly preset: LightingPresetId;
  setPreset(id: LightingPresetId): void;
  /** Advances a running transition. */
  update(deltaMs: number): void;
  applyQuality(level: QualityLevel): void;
  dispose(): void;
}

interface Parts {
  readonly scene: Scene;
  readonly palette: MaterialPalette;
  readonly sky: SkyDome;
  readonly post: PostProcessing;
  readonly shadowCasters: readonly AbstractMesh[];
  readonly reducedMotion: boolean;
}

export function createSceneLighting({ scene, palette, sky, post, shadowCasters, reducedMotion }: Parts, initial: LightingPresetId): SceneLighting {
  const hemi = new HemisphericLight('sky-fill', new Vector3(0, 1, 0), scene);
  const sun = new DirectionalLight('sun', new Vector3(0.5, -1, 0.5), scene);
  sun.autoCalcShadowZBounds = true;
  const lanternLight = new PointLight('lantern-light', new Vector3(0, 2.4, -0.6), scene);
  lanternLight.diffuse = rgbToLinearColor3(tokenRgb('--c-scene-lantern-glow'));
  lanternLight.specular = Color3.Black();
  lanternLight.range = 14;

  const shadows = new ShadowGenerator(1024, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.bias = 0.0015;
  shadows.normalBias = 0.02;
  shadows.darkness = 0.25;
  for (const mesh of shadowCasters) shadows.addShadowCaster(mesh, false);

  scene.fogMode = Scene.FOGMODE_EXP2;

  const resolve = (id: LightingPresetId): ResolvedLighting => resolveLighting(LIGHTING_PRESETS[id], tokenRgb);
  let preset = initial;
  let from = resolve(initial);
  let to = from;
  let elapsed = TRANSITION_MS;

  const apply = (look: ResolvedLighting): void => {
    hemi.diffuse = rgbToLinearColor3(look.hemiSky);
    hemi.groundColor = rgbToLinearColor3(look.hemiGround);
    hemi.intensity = look.hemiIntensity;
    const direction = new Vector3(look.sunDirection[0], look.sunDirection[1], look.sunDirection[2]).normalize();
    sun.direction = direction;
    sun.position = direction.scale(-30);
    sun.diffuse = rgbToLinearColor3(look.sun);
    sun.specular = sun.diffuse.scale(0.6);
    sun.intensity = look.sunIntensity;
    lanternLight.intensity = Math.max(0, look.lanternGlow - 0.3) * 6;
    palette.setLanternGlow(look.lanternGlow);
    scene.fogColor = rgbToColor3(look.fog);
    scene.fogDensity = look.fogDensity;
    scene.clearColor = new Color4(look.skyHorizon[0], look.skyHorizon[1], look.skyHorizon[2], 1);
    sky.paint(look.skyTop, look.skyHorizon);
    post.applyLook(look);
  };
  apply(from);

  return {
    get preset() {
      return preset;
    },
    setPreset(id) {
      if (id === preset) return;
      // Start from wherever a running transition has got to, so quick presses never jump.
      from = blendLighting(from, to, easeInOut(elapsed / TRANSITION_MS));
      to = resolve(id);
      preset = id;
      elapsed = reducedMotion ? TRANSITION_MS : 0;
      if (reducedMotion) apply(to);
    },
    update(deltaMs) {
      if (elapsed >= TRANSITION_MS) return;
      elapsed = Math.min(TRANSITION_MS, elapsed + deltaMs);
      apply(blendLighting(from, to, easeInOut(elapsed / TRANSITION_MS)));
      if (elapsed >= TRANSITION_MS) from = to;
    },
    applyQuality(level) {
      sun.shadowEnabled = level.shadowMapSize > 0;
      if (level.shadowMapSize > 0) {
        shadows.getShadowMap()?.resize(level.shadowMapSize);
        shadows.filteringQuality = SHADOW_FILTERS[level.shadowFilter];
      }
    },
    dispose() {
      shadows.dispose();
      lanternLight.dispose();
      sun.dispose();
      hemi.dispose();
    },
  };
}
