import type { ReactNode } from "react";

// Building blocks shared by every empty-state illustration in this folder.
//
// Colors are the theme's CSS variables rather than fixed hex values, so the artwork follows
// light/dark mode and any future palette change automatically. (That's also why these are
// React components and not standalone .svg files - an .svg loaded via <img> can't see the
// page's CSS variables.)
export const P = "var(--primary)";
export const MF = "var(--muted-foreground)";
export const CARD = "var(--card)";
export const BORDER = "var(--border)";

// Every scene sits on the same 200x160 canvas with a soft halo and a ground shadow, so they
// read as one set. Draw new illustrations inside <Frame> on that canvas (artwork centered on
// 100,76); Frame scales it down around that point so it keeps some padding inside the halo.
export const Frame = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 200 160" fill="none" aria-hidden="true" className="h-full w-full">
    <ellipse cx="100" cy="146" rx="62" ry="6" fill="var(--muted)" />
    <circle cx="100" cy="76" r="68" fill={P} opacity="0.07" />
    <g transform="translate(100 76) scale(0.74) translate(-100 -76)">{children}</g>
  </svg>
);

// Grey placeholder "text line" used inside cards/documents.
export const Line = ({ x, y, w, h = 5, o = 0.25 }: { x: number; y: number; w: number; h?: number; o?: number }) => (
  <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={MF} opacity={o} />
);

// Round magnifier badge, drawn at the given center.
export const Magnifier = ({ cx, cy }: { cx: number; cy: number }) => (
  <>
    <circle cx={cx} cy={cy} r="17" fill={CARD} stroke={P} strokeWidth="4" />
    <path d={`M${cx - 7} ${cy}h14`} stroke={P} strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" />
    <path d={`M${cx + 12} ${cy + 12}l12 12`} stroke={P} strokeWidth="6" strokeLinecap="round" />
  </>
);
