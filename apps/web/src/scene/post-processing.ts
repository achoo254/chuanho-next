/**
 * The miniature look in post: bloom so lanterns glow, a shallow depth of field focused on the yard (the tilt-shift
 * blur), anti-aliasing, ACES tone mapping and a soft vignette. One `DefaultRenderingPipeline`; the time-of-day look
 * sets its weights and the quality ladder switches its costly parts on and off.
 */
import type { Camera } from '@babylonjs/core/Cameras/camera';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { DepthOfFieldEffectBlurLevel } from '@babylonjs/core/PostProcesses/depthOfFieldEffect';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import '@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent';
import '@babylonjs/core/Rendering/depthRendererSceneComponent';
import type { Scene } from '@babylonjs/core/scene';
import type { QualityLevel } from '../engine/quality-levels';
import type { ResolvedLighting } from './lighting-presets';
import { tokenRgb } from './token-colours';

export interface PostProcessing {
  applyLook(look: ResolvedLighting): void;
  applyQuality(level: QualityLevel): void;
  /** Keeps the sharp band on the yard as the camera's distance changes. */
  focusAt(distance: number): void;
  dispose(): void;
}

export function createPostProcessing(scene: Scene, camera: Camera): PostProcessing {
  const pipeline = new DefaultRenderingPipeline('diorama-look', true, scene, [camera]);
  pipeline.imageProcessingEnabled = true;
  const image = pipeline.imageProcessing;
  image.toneMappingEnabled = true;
  image.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  image.vignetteEnabled = true;
  image.vignetteStretch = 0.4;
  image.vignetteBlendMode = ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;
  const ink = tokenRgb('--c-scene-ink');
  image.vignetteColor = new Color4(ink[0], ink[1], ink[2], 0);

  pipeline.bloomThreshold = 0.75;
  pipeline.bloomKernel = 48;
  pipeline.bloomScale = 0.5;

  // A long lens with a wide aperture: everything off the yard's focal band softens, like a photo of a miniature.
  pipeline.depthOfField.focalLength = 120;
  pipeline.depthOfField.fStop = 2.4;
  pipeline.depthOfField.lensSize = 50;

  return {
    applyLook(look) {
      image.exposure = look.exposure;
      image.contrast = look.contrast;
      image.vignetteWeight = look.vignetteWeight;
      pipeline.bloomWeight = look.bloomWeight;
    },
    applyQuality(level) {
      pipeline.samples = level.msaaSamples;
      pipeline.fxaaEnabled = level.fxaa;
      pipeline.bloomEnabled = level.bloom;
      pipeline.depthOfFieldEnabled = level.depthOfField;
      pipeline.depthOfFieldBlurLevel = level.id === 'ultra' ? DepthOfFieldEffectBlurLevel.Medium : DepthOfFieldEffectBlurLevel.Low;
    },
    focusAt(distance) {
      // Babylon measures the focus distance in millimetres of scene units.
      pipeline.depthOfField.focusDistance = distance * 1000;
    },
    dispose() {
      pipeline.dispose();
    },
  };
}
