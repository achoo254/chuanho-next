/**
 * Tiểu Đệ's round avatar: a little round-headed novice who is also a bit of a bot (a small antenna with a glowing tip,
 * dot eyes, blush, an orange robe collar). Inline SVG, colours from tokens.css through the classes in tieude.css.
 * Reusable anywhere Tiểu Đệ speaks; decorative, so the caller labels the message instead.
 */
import type { ReactNode } from 'react';

export function TieuDeAvatar({ size = 44 }: { readonly size?: number }): ReactNode {
  return (
    <svg className="tieude-avatar" viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false">
      <circle className="tieude-avatar-bg" cx="24" cy="24" r="23" />
      <path className="tieude-avatar-robe" d="M8 44c2-8 8-12 16-12s14 4 16 12a23 23 0 0 1 -32 0z" />
      <path className="tieude-avatar-robe-fold" d="M24 32l-5 8M24 32l5 8" />
      <line className="tieude-avatar-antenna" x1="24" y1="9" x2="24" y2="4" />
      <circle className="tieude-avatar-antenna-tip" cx="24" cy="3.5" r="2" />
      <circle className="tieude-avatar-head" cx="24" cy="21" r="12" />
      <circle className="tieude-avatar-eye" cx="19.5" cy="21" r="1.6" />
      <circle className="tieude-avatar-eye" cx="28.5" cy="21" r="1.6" />
      <circle className="tieude-avatar-blush" cx="16.5" cy="25" r="2" />
      <circle className="tieude-avatar-blush" cx="31.5" cy="25" r="2" />
      <path className="tieude-avatar-mouth" d="M21.5 26.5q2.5 2 5 0" />
    </svg>
  );
}
