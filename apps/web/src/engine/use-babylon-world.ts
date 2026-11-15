/**
 * Mounts the 3D world in a host element for as long as the component lives: downloads the Babylon part of the app on
 * first use (a separate chunk), boots it with progress, and disposes every engine resource on unmount. Boot failures
 * end in the still-picture fallback rather than a broken page.
 */
import { type RefObject, useEffect, useRef, useState } from 'react';
import type { LightingPresetId } from '../scene/lighting-presets';
import type { InteractivePropId } from '../scene/world-actions';
import type { BabylonWorld } from './boot-babylon-world';
import { pinnedQuality, rendererPreference } from './game-3d-flag';
import { qualityIndexOf } from './quality-levels';

export type WorldStatus = 'loading' | 'ready' | 'unsupported';

export interface WorldHandlers {
  onPick(prop: InteractivePropId): void;
  onHover(prop: InteractivePropId | null, clientX: number, clientY: number): void;
}

export interface WorldState {
  readonly status: WorldStatus;
  readonly progress: number;
  readonly world: BabylonWorld | null;
}

function mediaMatches(query: string): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

export function useBabylonWorld(
  hostRef: RefObject<HTMLElement | null>,
  canvasLabel: string,
  initialPreset: LightingPresetId,
  handlers: WorldHandlers,
): WorldState {
  const [state, setState] = useState<WorldState>({ status: 'loading', progress: 0.05, world: null });
  const handlersRef = useRef(handlers);
  const labelRef = useRef(canvasLabel);
  const presetRef = useRef(initialPreset);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    labelRef.current = canvasLabel;
    hostRef.current?.querySelector('canvas')?.setAttribute('aria-label', canvasLabel);
  }, [hostRef, canvasLabel]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const abort = new AbortController();
    let world: BabylonWorld | null = null;
    const setProgress = (progress: number): void => {
      if (!abort.signal.aborted) setState((current) => ({ ...current, progress: Math.max(current.progress, progress) }));
    };

    const boot = async (): Promise<void> => {
      const engineModule = await import('./boot-babylon-world');
      setProgress(0.3);
      try {
        const result = await engineModule.bootBabylonWorld({
          host,
          canvasLabel: labelRef.current,
          preference: rendererPreference(window.location.search),
          reducedMotion: mediaMatches('(prefers-reduced-motion: reduce)'),
          coarsePointer: mediaMatches('(pointer: coarse)'),
          initialPreset: presetRef.current,
          pinnedQuality: qualityIndexOf(pinnedQuality(window.location.search)),
          signal: abort.signal,
          onProgress: setProgress,
          onPick: (prop) => handlersRef.current.onPick(prop),
          onHover: (prop, x, y) => handlersRef.current.onHover(prop, x, y),
        });
        if (result.kind === 'unsupported') {
          if (!abort.signal.aborted) setState({ status: 'unsupported', progress: 1, world: null });
          return;
        }
        if (abort.signal.aborted) {
          result.world.dispose();
          return;
        }
        world = result.world;
        setState({ status: 'ready', progress: 1, world: result.world });
      } catch (error) {
        if (engineModule.isBootAborted(error)) return;
        throw error;
      }
    };

    boot().catch((error: unknown) => {
      console.error('The 3D yard could not start', error);
      if (!abort.signal.aborted) setState({ status: 'unsupported', progress: 1, world: null });
    });

    return () => {
      abort.abort();
      world?.dispose();
      world = null;
    };
  }, [hostRef]);

  return state;
}
