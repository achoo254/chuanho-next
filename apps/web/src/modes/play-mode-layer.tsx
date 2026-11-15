/** The HTML layer of the current play mode over the canvas (the yard itself has none: the HUD covers it). */
import type { ReactNode } from 'react';
import type { BabylonWorld } from '../engine/boot-babylon-world';
import { Share3dPanel } from '../share3d/share-3d-panel';
import { EndlessMode } from './endless-mode';
import { IncenseMode } from './incense-mode';
import type { PlayModeProps } from './mode-chrome';
import { MoBeatMode } from './mo-beat-mode';
import type { PlayMode } from './play-mode-routing';
import { SessionEndMode } from './session-end-mode';
import { SutraMode } from './sutra-mode';

interface PlayModeLayerProps extends Omit<PlayModeProps, 'stage'> {
  readonly mode: PlayMode;
  readonly world: BabylonWorld;
  /** `?song=` preview time for Mõ Beat screenshots, or null. */
  readonly previewSongMs: number | null;
}

export function PlayModeLayer({ mode, world, previewSongMs, ...props }: PlayModeLayerProps): ReactNode {
  const shared: PlayModeProps = { ...props, stage: world.stage };
  switch (mode) {
    case 'yard':
      return null;
    case 'incense':
      return <IncenseMode {...shared} pickPropAt={(x, y) => world.pickPropAt(x, y)} />;
    case 'beat':
      return <MoBeatMode {...shared} previewSongMs={previewSongMs} />;
    case 'sutra':
      return <SutraMode {...shared} />;
    case 'endless':
      return <EndlessMode {...shared} />;
    case 'sessionEnd':
      return <SessionEndMode onBack={props.onBack} onShare={() => props.onOpen('share')} />;
    case 'share':
      return <Share3dPanel stage={world.stage} onBack={props.onBack} />;
  }
}
