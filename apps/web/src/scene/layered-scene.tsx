/**
 * A temple corner with depth, without a 3D engine: a blurred backdrop, light rays through the incense haze, layers
 * of transparent art at different depths, a vignette, and the interactive foreground on top. Layers shift against
 * each other with the phone's tilt (use-parallax-tilt.ts); `depth` is how many pixels a layer travels at full tilt
 * (negative = towards the viewer).
 */
import { type CSSProperties, type ReactNode, useRef } from 'react';
import { useParallaxTilt } from './use-parallax-tilt';

export const BACKDROPS = {
  courtyard: '/art/bg-courtyard.webp',
  courtyardAlt: '/art/bg-courtyard-alt.webp',
} as const;
export type Backdrop = keyof typeof BACKDROPS;

interface SceneLayerProps {
  readonly depth: number;
  readonly className?: string;
  readonly children?: ReactNode;
}

/** One moving layer; its look (position, size, shadow) comes from `className`. */
export function SceneLayer({ depth, className = '', children }: SceneLayerProps): ReactNode {
  // A custom property is not in React's CSSProperties type; the value is a plain number.
  const style = { '--depth': depth } as CSSProperties;
  return (
    <div className={`scene-layer ${className}`} style={style} aria-hidden="true">
      {children}
    </div>
  );
}

interface LayeredSceneProps {
  readonly backdrop: Backdrop;
  /** Decorative layers between the backdrop and the foreground (SceneLayer elements). */
  readonly layers?: ReactNode;
  /** The interactive content: it does not move, so taps land where the eye expects. */
  readonly children?: ReactNode;
  readonly className?: string;
  readonly dataId?: string;
}

export function LayeredScene({ backdrop, layers, children, className = '', dataId }: LayeredSceneProps): ReactNode {
  const sceneRef = useRef<HTMLDivElement>(null);
  useParallaxTilt(sceneRef);
  return (
    <div ref={sceneRef} className={`scene ${className}`} data-id={dataId}>
      <SceneLayer depth={6} className="scene-backdrop">
        <img className="scene-backdrop-img" src={BACKDROPS[backdrop]} alt="" decoding="async" />
      </SceneLayer>
      <SceneLayer depth={10} className="scene-rays" />
      {layers}
      <div className="scene-vignette" aria-hidden="true" />
      <div className="scene-front">{children}</div>
    </div>
  );
}
