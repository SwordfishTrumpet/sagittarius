/**
 * SFIcon — Apple SF Symbols-style SVG icons for iCloud Mail aesthetic.
 *
 * Each icon is a hand-crafted SVG path matching SF Symbols' design language:
 *   • 1.5px stroke weight (monoline construction)
 *   • Round line caps & joins
 *   • Optically centred within a 24×24 viewBox
 *   • currentColor inheritance for seamless theming
 */

import { memo } from 'react';

interface SFIconProps {
  className?: string;
  /** Override default 1.5 stroke width */
  strokeWidth?: number;
  /** For icons that support a filled variant (e.g. Flag) */
  filled?: boolean;
}

const base = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
};

/* ── Reply ─────────────────────────────────────────────────────────── */
export const SFReply = memo(({ className, strokeWidth = 1.5 }: SFIconProps) => (
  <svg {...base} className={className} strokeWidth={strokeWidth}>
    <path d="M9 4L4 9l5 5" />
    <path d="M4 9h10a5 5 0 0 1 5 5v2" />
  </svg>
));
SFReply.displayName = 'SFReply';

/* ── Reply All ─────────────────────────────────────────────────────── */
export const SFReplyAll = memo(({ className, strokeWidth = 1.5 }: SFIconProps) => (
  <svg {...base} className={className} strokeWidth={strokeWidth}>
    <path d="M12 4L7 9l5 5" />
    <path d="M7 9h9a5 5 0 0 1 5 5v2" />
    <path d="M8 4L3 9l5 5" />
  </svg>
));
SFReplyAll.displayName = 'SFReplyAll';

/* ── Forward ───────────────────────────────────────────────────────── */
export const SFForward = memo(({ className, strokeWidth = 1.5 }: SFIconProps) => (
  <svg {...base} className={className} strokeWidth={strokeWidth}>
    <path d="M15 4l5 5-5 5" />
    <path d="M20 9H10a5 5 0 0 0-5 5v2" />
  </svg>
));
SFForward.displayName = 'SFForward';

/* ── Flag ──────────────────────────────────────────────────────────── */
export const SFFlag = memo(({ className, strokeWidth = 1.5, filled = false }: SFIconProps) => (
  <svg {...base} className={className} strokeWidth={strokeWidth}
    fill={filled ? 'currentColor' : 'none'}
  >
    <path d="M5 21V4" />
    <path d="M5 4h11.5a1 1 0 0 1 .8 1.6L14.5 9.5l2.8 3.9a1 1 0 0 1-.8 1.6H5" />
  </svg>
));
SFFlag.displayName = 'SFFlag';

/* ── Archive ───────────────────────────────────────────────────────── */
export const SFArchive = memo(({ className, strokeWidth = 1.5 }: SFIconProps) => (
  <svg {...base} className={className} strokeWidth={strokeWidth}>
    <rect x="3" y="3" width="18" height="5" rx="1" />
    <path d="M3 8v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8" />
    <path d="M10 12h4" />
  </svg>
));
SFArchive.displayName = 'SFArchive';

/* ── Trash ─────────────────────────────────────────────────────────── */
export const SFTrash = memo(({ className, strokeWidth = 1.5 }: SFIconProps) => (
  <svg {...base} className={className} strokeWidth={strokeWidth}>
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6l-.8 12.1A2 2 0 0 1 16.2 20H7.8a2 2 0 0 1-2-1.9L5 6" />
    <line x1="10" y1="10" x2="10" y2="16" />
    <line x1="14" y1="10" x2="14" y2="16" />
  </svg>
));
SFTrash.displayName = 'SFTrash';

/* ── Star (for Flag toggle in list) ────────────────────────────────── */
/* ── Snooze ─────────────────────────────────────────────────────────── */
export const SFSnooze = memo(({ className, strokeWidth = 1.5 }: SFIconProps) => (
  <svg {...base} className={className} strokeWidth={strokeWidth}>
    <path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z" />
    <path d="M12 8v4l2.5 2.5" />
  </svg>
));
SFSnooze.displayName = 'SFSnooze';

export const SFStar = memo(({ className, strokeWidth = 1.5, filled = false }: SFIconProps) => (
  <svg {...base} className={className} strokeWidth={strokeWidth}
    fill={filled ? 'currentColor' : 'none'}
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
));
SFStar.displayName = 'SFStar';
