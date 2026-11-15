/**
 * What a device without WebGL2 (or with a broken GPU driver) sees: the yard as a still picture and one short note,
 * with a way to the classic version while it still exists. There is no separate 2D game to maintain for this case.
 */
import type { ReactNode } from 'react';
import { useHudText } from '../hud/hud-messages';

/** The current address without the 3D switch, i.e. the classic page. */
function classicHref(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete('v');
  url.searchParams.delete('renderer');
  url.hash = '';
  return `${url.pathname}${url.search}`;
}

export function NoWebglFallback(): ReactNode {
  const text = useHudText();
  return (
    <div className="game3d-fallback" data-id="game3d-fallback">
      <img className="game3d-fallback-art" src="/art/bg-courtyard.webp" alt="" />
      <div className="game3d-fallback-panel" role="alert">
        <p className="game3d-fallback-title">{text('unsupportedTitle')}</p>
        <p className="game3d-fallback-body">{text('unsupportedBody')}</p>
        <a className="game3d-fallback-link" href={classicHref()} data-id="game3d-fallback-classic">
          {text('unsupportedLink')}
        </a>
      </div>
    </div>
  );
}
