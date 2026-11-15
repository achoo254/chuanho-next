/**
 * The yard's depth layers: the bronze censer that is always there, and the decorations merit unlocks (purely
 * visual). Lanterns use the drawn art; the lotus pot and the bodhi sapling are drawn in CSS until art exists.
 */
import type { ReactNode } from 'react';
import { DECORATIONS, type DecorationId, type PlayerProgress, isUnlocked } from '../game/player-progress';
import { SceneLayer } from '../scene/layered-scene';

function Decoration({ id }: { id: DecorationId }): ReactNode {
  switch (id) {
    case 'lanternLeft':
      return (
        <SceneLayer depth={26} className="decor-lantern decor-lantern-left">
          <img src="/art/lantern.webp" alt="" decoding="async" />
        </SceneLayer>
      );
    case 'lanternRight':
      return (
        <SceneLayer depth={34} className="decor-lantern decor-lantern-right">
          <img src="/art/lantern.webp" alt="" decoding="async" />
        </SceneLayer>
      );
    case 'lotus':
      return (
        <SceneLayer depth={-10} className="decor-lotus">
          <span className="lotus-petal lotus-petal-left" />
          <span className="lotus-petal lotus-petal-right" />
          <span className="lotus-petal lotus-petal-mid" />
          <span className="lotus-pot" />
        </SceneLayer>
      );
    case 'bodhiSapling':
      return (
        <SceneLayer depth={-8} className="decor-sapling">
          <span className="sapling-crown" />
          <span className="sapling-trunk" />
          <span className="lotus-pot" />
        </SceneLayer>
      );
  }
}

export function YardLayers({ progress }: { progress: PlayerProgress }): ReactNode {
  return (
    <>
      {DECORATIONS.filter((item) => isUnlocked(item, progress)).map((item) => (
        <Decoration key={item.id} id={item.id} />
      ))}
      <SceneLayer depth={-14} className="decor-censer">
        <img src="/art/incense.webp" alt="" decoding="async" />
      </SceneLayer>
    </>
  );
}

/** The next decoration still locked, with the merit it needs, or undefined when everything is unlocked. */
export function nextDecoration(progress: PlayerProgress): { id: DecorationId; missing: number } | undefined {
  const next = DECORATIONS.find((item) => !isUnlocked(item, progress));
  return next ? { id: next.id, missing: next.merit - progress.merit } : undefined;
}
