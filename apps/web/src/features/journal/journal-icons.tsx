/**
 * The journal's little drawings: an outline icon per karma kind (same stroke style as the HUD icons), the karma
 * cloud, a flower and a leaf. Colours come from journal.css classes (tokens only), never from here.
 */
import type { KarmaKind } from '@chuanho/contract';
import type { ReactNode } from 'react';

const BUBBLE = 'M4 5h16v10H10l-5 4v-4H4z';

const KIND_PATHS: Readonly<Record<KarmaKind, string>> = {
  harsh: `${BUBBLE}M12 7.5v4M12 13.2v.3`,
  lie: `${BUBBLE}M10 8.6a2 2 0 1 1 2.6 1.9c-.4.2-.6.6-.6 1.1M12 13.2v.3`,
  gossip: 'M3 4h11v7H7l-4 3zM10 13.5V15h7l4 3V8h-4',
  anger: 'M12 21c-3.9 0-7-2.8-7-6.6 0-3.8 2.9-5.8 3.9-9.4 1.9 1.9 2.9 3.8 2.9 5.7 1-1 1.9-1.9 1.9-3.8 2.9 1.9 5.3 4.8 5.3 7.6 0 3.7-3.1 6.5-7 6.5z',
};

const TRASH = 'M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13M10 11v5M14 11v5';

export function KindIcon({ kind, size = 20 }: { readonly kind: KarmaKind; readonly size?: number }): ReactNode {
  return <StrokeIcon path={KIND_PATHS[kind]} size={size} />;
}

export function TrashIcon({ size = 18 }: { readonly size?: number }): ReactNode {
  return <StrokeIcon path={TRASH} size={size} />;
}

function StrokeIcon({ path, size }: { readonly path: string; readonly size: number }): ReactNode {
  return (
    <svg className="journal-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A soft cloud; `dissolved` fades it into a few drifting puffs (journal.css animates it). */
export function KarmaCloud({ dissolved, size = 44 }: { readonly dissolved: boolean; readonly size?: number }): ReactNode {
  return (
    <svg className="journal-cloud" data-dissolved={dissolved} viewBox="0 0 48 32" width={size} height={(size * 2) / 3} aria-hidden="true" focusable="false">
      <path className="journal-cloud-body" d="M12 27a7 7 0 0 1-1-13.9A10 10 0 0 1 30 9.5a8 8 0 0 1 7 3.6A7 7 0 0 1 37 27z" />
    </svg>
  );
}

/** Five petals around a heart, centred on (x, y); `r` is the petal radius. Drawn inside a parent SVG. */
export function FlowerShape({ x, y, r }: { readonly x: number; readonly y: number; readonly r: number }): ReactNode {
  return (
    <g className="journal-flower">
      {[0, 72, 144, 216, 288].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        return <circle key={angle} className="journal-flower-petal" cx={x + Math.sin(rad) * r} cy={y - Math.cos(rad) * r} r={r} />;
      })}
      <circle className="journal-flower-heart" cx={x} cy={y} r={r * 0.8} />
    </g>
  );
}

/** A leaf on a stem at (x, y), leaning right (`side` 1) or left (-1). Drawn inside a parent SVG. */
export function LeafShape({ x, y, side }: { readonly x: number; readonly y: number; readonly side: 1 | -1 }): ReactNode {
  const tip = x + side * 9;
  return <path className="journal-leaf" d={`M${x} ${y}Q${x + side * 4} ${y - 7} ${tip} ${y - 5}Q${x + side * 5} ${y + 1} ${x} ${y}z`} />;
}

/** A standalone blooming flower (the end of a release). */
export function BloomFlower({ size = 72 }: { readonly size?: number }): ReactNode {
  return (
    <svg className="journal-bloom" viewBox="0 0 40 48" width={size} height={(size * 6) / 5} aria-hidden="true" focusable="false">
      <path className="journal-stem" d="M20 46V22" />
      <LeafShape x={20} y={38} side={-1} />
      <LeafShape x={20} y={32} side={1} />
      <FlowerShape x={20} y={15} r={6} />
    </svg>
  );
}
