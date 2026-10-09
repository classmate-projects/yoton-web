"use client";

import type { ReactNode } from "react";

// Inline illustrations drawn with the theme's CSS variables (--primary, --muted, --border,
// --card, --muted-foreground) rather than fixed colors, so they follow light/dark mode and any
// future palette change without separate artwork. Every scene shares the same frame (soft
// halo + ground shadow) and the same 200x160 canvas so they read as one set.
export type EmptyStateIllustration =
  | "patients"
  | "visits"
  | "referrals"
  | "search"
  | "lab"
  | "radiology"
  | "pharmacy"
  | "billing"
  | "building"
  | "users"
  | "roles"
  | "clipboard"
  | "chart"
  | "messages"
  | "notes"
  | "documents"
  | "incident"
  | "hygiene"
  | "feedback"
  | "vitals"
  | "done";

const P = "var(--primary)";
const MF = "var(--muted-foreground)";
const CARD = "var(--card)";
const BORDER = "var(--border)";

// Grey placeholder "text line" used inside cards/documents.
const Line = ({ x, y, w, h = 5, o = 0.25 }: { x: number; y: number; w: number; h?: number; o?: number }) => (
  <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={MF} opacity={o} />
);

const Frame = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 200 160" fill="none" aria-hidden="true" className="h-full w-full">
    <ellipse cx="100" cy="146" rx="62" ry="6" fill="var(--muted)" />
    <circle cx="100" cy="76" r="62" fill={P} opacity="0.07" />
    {children}
  </svg>
);

// Small round badge with a magnifier, bottom-right - reused by "search".
const Magnifier = ({ cx, cy }: { cx: number; cy: number }) => (
  <>
    <circle cx={cx} cy={cy} r="17" fill={CARD} stroke={P} strokeWidth="4" />
    <path d={`M${cx - 7} ${cy}h14`} stroke={P} strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" />
    <path d={`M${cx + 12} ${cy + 12}l12 12`} stroke={P} strokeWidth="6" strokeLinecap="round" />
  </>
);

const calendar = (
  <Frame>
    <rect x="48" y="34" width="92" height="84" rx="10" fill={CARD} stroke={BORDER} strokeWidth="2" />
    <path d="M48 44a10 10 0 0 1 10-10h72a10 10 0 0 1 10 10v12H48V44z" fill={P} opacity="0.85" />
    <rect x="68" y="26" width="6" height="16" rx="3" fill={MF} opacity="0.6" />
    <rect x="114" y="26" width="6" height="16" rx="3" fill={MF} opacity="0.6" />
    {[0, 1, 2, 3].map((col) =>
      [0, 1, 2].map((row) => (
        <rect key={`${col}-${row}`} x={60 + col * 18} y={66 + row * 16} width="11" height="9" rx="2.5" fill={MF} opacity="0.15" />
      )),
    )}
    <circle cx="142" cy="108" r="22" fill={CARD} stroke={P} strokeWidth="4" />
    <path d="M142 96v12l8 5" stroke={P} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </Frame>
);

const illustrations: Record<EmptyStateIllustration, ReactNode> = {
  // Patient card with a magnifying glass.
  patients: (
    <Frame>
      <rect x="46" y="38" width="96" height="72" rx="10" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <circle cx="74" cy="66" r="12" fill={P} opacity="0.18" />
      <circle cx="74" cy="62" r="5" fill={P} opacity="0.55" />
      <path d="M65 75c2-5 6-7 9-7s7 2 9 7" stroke={P} strokeOpacity="0.55" strokeWidth="2.5" strokeLinecap="round" />
      <Line x={94} y={56} w={36} h={6} o={0.35} />
      <Line x={94} y={68} w={26} o={0.2} />
      <Line x={58} y={90} w={72} o={0.15} />
      <Magnifier cx={140} cy={100} />
    </Frame>
  ),
  // Calendar with a clock.
  visits: calendar,
  // Two documents with a hand-off arrow.
  referrals: (
    <Frame>
      <rect x="40" y="44" width="56" height="72" rx="8" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <Line x={50} y={58} w={30} o={0.35} />
      <Line x={50} y={70} w={36} h={4} o={0.2} />
      <Line x={50} y={80} w={24} h={4} o={0.2} />
      <path d="M58 98l5 5 10-10" stroke={P} strokeOpacity="0.6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="110" y="34" width="56" height="72" rx="8" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <Line x={120} y={48} w={30} o={0.35} />
      <Line x={120} y={60} w={36} h={4} o={0.2} />
      <Line x={120} y={70} w={24} h={4} o={0.2} />
      <path d="M128 90h20" stroke={P} strokeOpacity="0.4" strokeWidth="3" strokeLinecap="round" />
      <circle cx="103" cy="118" r="16" fill={P} />
      <path d="M95 118h15m-5-5l5 5-5 5" stroke="var(--primary-foreground)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  ),
  // Faded result rows with a magnifier - "nothing matched your search/filters".
  search: (
    <Frame>
      <rect x="44" y="36" width="104" height="80" rx="10" fill={CARD} stroke={BORDER} strokeWidth="2" />
      {[0, 1, 2].map((i) => (
        <g key={i} opacity={1 - i * 0.3}>
          <circle cx="60" cy={56 + i * 20} r="6" fill={MF} opacity="0.2" />
          <Line x={72} y={53 + i * 20} w={i === 1 ? 44 : 58} o={0.2} />
        </g>
      ))}
      <Magnifier cx={142} cy={104} />
    </Frame>
  ),
  // Test tube in a rack.
  lab: (
    <Frame>
      <rect x="52" y="96" width="96" height="14" rx="4" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <rect x="64" y="42" width="16" height="66" rx="8" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <rect x="92" y="30" width="18" height="78" rx="9" fill={CARD} stroke={P} strokeWidth="3" />
      <path d="M95 74h12v24a6 6 0 0 1-12 0V74z" fill={P} opacity="0.7" />
      <circle cx="101" cy="64" r="2.5" fill={P} opacity="0.45" />
      <circle cx="104" cy="54" r="1.8" fill={P} opacity="0.35" />
      <rect x="88" y="26" width="26" height="7" rx="3.5" fill={P} />
      <rect x="122" y="50" width="16" height="58" rx="8" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <rect x="62" y="38" width="20" height="6" rx="3" fill={MF} opacity="0.4" />
      <rect x="120" y="46" width="20" height="6" rx="3" fill={MF} opacity="0.4" />
    </Frame>
  ),
  // X-ray film showing a chest outline.
  radiology: (
    <Frame>
      <rect x="50" y="30" width="100" height="90" rx="10" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <rect x="58" y="38" width="84" height="74" rx="6" fill={P} opacity="0.12" />
      <path d="M100 46v58" stroke={P} strokeWidth="4" strokeLinecap="round" opacity="0.7" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i} stroke={P} strokeWidth="3" strokeLinecap="round" opacity={0.55 - i * 0.07} fill="none">
          <path d={`M96 ${56 + i * 12}c-10 -4 -20 -2 -26 6`} />
          <path d={`M104 ${56 + i * 12}c10 -4 20 -2 26 6`} />
        </g>
      ))}
      <circle cx="140" cy="44" r="4" fill={P} opacity="0.6" />
    </Frame>
  ),
  // Pill bottle with a capsule.
  pharmacy: (
    <Frame>
      <rect x="62" y="30" width="56" height="14" rx="4" fill={P} />
      <rect x="58" y="42" width="64" height="76" rx="10" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <rect x="66" y="62" width="48" height="34" rx="5" fill={P} opacity="0.12" />
      <path d="M90 70v18M81 79h18" stroke={P} strokeWidth="5" strokeLinecap="round" />
      <g transform="rotate(-35 138 104)">
        <rect x="120" y="96" width="38" height="16" rx="8" fill={CARD} stroke={P} strokeWidth="3" />
        <path d="M139 96h11a8 8 0 0 1 0 16h-11z" fill={P} opacity="0.8" />
      </g>
    </Frame>
  ),
  // Receipt with a zig-zag tear and a total line.
  billing: (
    <Frame>
      <path
        d="M62 30h76v86l-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-4 3z"
        fill={CARD}
        stroke={BORDER}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <Line x={74} y={44} w={36} h={6} o={0.35} />
      <Line x={74} y={60} w={52} h={4} o={0.18} />
      <Line x={74} y={70} w={44} h={4} o={0.18} />
      <Line x={74} y={80} w={50} h={4} o={0.18} />
      <path d="M74 92h52" stroke={BORDER} strokeWidth="2" strokeDasharray="4 3" />
      <rect x="104" y="98" width="22" height="6" rx="3" fill={P} opacity="0.7" />
      {/* Stack of coins - currency-neutral, the app is used with several currencies. */}
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="132" y={100 - i * 9} width="30" height="10" fill={P} opacity={0.55 + i * 0.15} />
          <ellipse cx="147" cy={110 - i * 9} rx="15" ry="5" fill={P} opacity={0.55 + i * 0.15} />
        </g>
      ))}
      <ellipse cx="147" cy="82" rx="15" ry="5" fill={P} stroke={CARD} strokeWidth="1.5" />
    </Frame>
  ),
  // Building with windows and a cross - departments / branches.
  building: (
    <Frame>
      <rect x="56" y="44" width="88" height="76" rx="6" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <rect x="82" y="30" width="36" height="20" rx="4" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <path d="M100 34v12M94 40h12" stroke={P} strokeWidth="4" strokeLinecap="round" />
      {[0, 1, 2].map((col) =>
        [0, 1].map((row) => (
          <rect key={`${col}-${row}`} x={66 + col * 26} y={58 + row * 20} width="16" height="12" rx="2.5" fill={P} opacity={col === 1 && row === 0 ? 0.5 : 0.15} />
        )),
      )}
      <rect x="90" y="100" width="20" height="20" rx="3" fill={P} opacity="0.7" />
    </Frame>
  ),
  // Group of three people.
  users: (
    <Frame>
      <circle cx="68" cy="66" r="11" fill={MF} opacity="0.25" />
      <path d="M48 106c2-14 10-22 20-22s18 8 20 22z" fill={MF} opacity="0.18" />
      <circle cx="132" cy="66" r="11" fill={MF} opacity="0.25" />
      <path d="M112 106c2-14 10-22 20-22s18 8 20 22z" fill={MF} opacity="0.18" />
      <circle cx="100" cy="58" r="15" fill={CARD} stroke={P} strokeWidth="3" />
      <path d="M72 114c3-18 14-28 28-28s25 10 28 28z" fill={CARD} stroke={P} strokeWidth="3" strokeLinejoin="round" />
    </Frame>
  ),
  // Shield with a key - roles & permissions.
  roles: (
    <Frame>
      <path d="M100 28l38 14v28c0 26-17 42-38 50-21-8-38-24-38-50V42z" fill={CARD} stroke={BORDER} strokeWidth="2" strokeLinejoin="round" />
      <path d="M100 38l28 10v22c0 19-12 31-28 37-16-6-28-18-28-37V48z" fill={P} opacity="0.12" />
      <circle cx="100" cy="66" r="9" fill="none" stroke={P} strokeWidth="4" />
      <path d="M100 75v20M100 86h7M100 93h5" stroke={P} strokeWidth="4" strokeLinecap="round" />
    </Frame>
  ),
  // Clipboard with checklist rows - audit logs, open cases, generic lists.
  clipboard: (
    <Frame>
      <rect x="58" y="34" width="84" height="88" rx="10" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <rect x="82" y="26" width="36" height="14" rx="5" fill={P} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="70" y={54 + i * 20} width="10" height="10" rx="3" fill="none" stroke={P} strokeOpacity={0.6 - i * 0.15} strokeWidth="2" />
          <Line x={86} y={56 + i * 20} w={i === 1 ? 30 : 42} o={0.22} />
        </g>
      ))}
    </Frame>
  ),
  // Bar chart on a card - reports / analytics.
  chart: (
    <Frame>
      <rect x="46" y="34" width="108" height="84" rx="10" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <path d="M60 104h80" stroke={BORDER} strokeWidth="2" strokeLinecap="round" />
      {[22, 36, 16, 44, 28].map((h, i) => (
        <rect key={i} x={64 + i * 15} y={102 - h} width="10" height={h} rx="3" fill={P} opacity={i === 3 ? 0.8 : 0.2} />
      ))}
      <Line x={60} y={46} w={40} h={6} o={0.3} />
    </Frame>
  ),
  // Two chat bubbles.
  messages: (
    <Frame>
      <path d="M44 42a10 10 0 0 1 10-10h62a10 10 0 0 1 10 10v34a10 10 0 0 1-10 10H70l-14 12V86h-2a10 10 0 0 1-10-10z" fill={CARD} stroke={BORDER} strokeWidth="2" strokeLinejoin="round" />
      <Line x={58} y={48} w={48} o={0.25} />
      <Line x={58} y={60} w={34} o={0.18} />
      <path d="M90 74a10 10 0 0 1 10-10h46a10 10 0 0 1 10 10v26a10 10 0 0 1-10 10h-2v12l-14-12h-30a10 10 0 0 1-10-10z" fill={P} />
      <circle cx="108" cy="87" r="3.5" fill="var(--primary-foreground)" />
      <circle cx="122" cy="87" r="3.5" fill="var(--primary-foreground)" />
      <circle cx="136" cy="87" r="3.5" fill="var(--primary-foreground)" />
    </Frame>
  ),
  // Notepad with a pen.
  notes: (
    <Frame>
      <rect x="54" y="32" width="80" height="90" rx="8" fill={CARD} stroke={BORDER} strokeWidth="2" />
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={70 + i * 16} cy="32" r="4" fill={MF} opacity="0.45" />
      ))}
      <Line x={66} y={50} w={52} o={0.22} />
      <Line x={66} y={62} w={44} o={0.22} />
      <Line x={66} y={74} w={50} o={0.22} />
      <Line x={66} y={86} w={30} o={0.22} />
      <g transform="rotate(35 140 92)">
        <rect x="134" y="52" width="12" height="52" rx="3" fill={P} />
        <path d="M134 104h12l-6 12z" fill={CARD} stroke={P} strokeWidth="2" strokeLinejoin="round" />
        <rect x="134" y="52" width="12" height="8" rx="2" fill={MF} opacity="0.5" />
      </g>
    </Frame>
  ),
  // Stacked documents.
  documents: (
    <Frame>
      <rect x="70" y="30" width="70" height="86" rx="8" fill={CARD} stroke={BORDER} strokeWidth="2" transform="rotate(8 105 73)" />
      <path d="M58 36a8 8 0 0 1 8-8h40l20 20v66a8 8 0 0 1-8 8H66a8 8 0 0 1-8-8z" fill={CARD} stroke={BORDER} strokeWidth="2" strokeLinejoin="round" />
      <path d="M106 28v14a6 6 0 0 0 6 6h14" fill={P} opacity="0.15" stroke={BORDER} strokeWidth="2" strokeLinejoin="round" />
      <Line x={70} y={58} w={40} h={6} o={0.32} />
      <Line x={70} y={72} w={44} h={4} o={0.18} />
      <Line x={70} y={82} w={36} h={4} o={0.18} />
      <Line x={70} y={92} w={42} h={4} o={0.18} />
      <rect x="70" y="102" width="20" height="6" rx="3" fill={P} opacity="0.6" />
    </Frame>
  ),
  // Shield with an exclamation - incident reports.
  incident: (
    <Frame>
      <path d="M100 28l38 14v28c0 26-17 42-38 50-21-8-38-24-38-50V42z" fill={CARD} stroke={BORDER} strokeWidth="2" strokeLinejoin="round" />
      <path d="M100 38l28 10v22c0 19-12 31-28 37-16-6-28-18-28-37V48z" fill={P} opacity="0.12" />
      <path d="M100 54v24" stroke={P} strokeWidth="6" strokeLinecap="round" />
      <circle cx="100" cy="92" r="4" fill={P} />
    </Frame>
  ),
  // Open hand with a sanitiser droplet.
  hygiene: (
    <Frame>
      <path
        d="M70 120V80a6 6 0 0 1 12 0v-28a6 6 0 0 1 12 0v-6a6 6 0 0 1 12 0v6a6 6 0 0 1 12 0v32a6 6 0 0 1 12 0v14c0 12-10 22-22 22H82c-7 0-12-5-12-12z"
        fill={CARD}
        stroke={BORDER}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M140 30c8 10 12 16 12 22a12 12 0 0 1-24 0c0-6 4-12 12-22z" fill={P} />
      <path d="M136 52a5 5 0 0 0 4 5" stroke="var(--primary-foreground)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="58" cy="50" r="5" fill={P} opacity="0.3" />
      <circle cx="50" cy="66" r="3" fill={P} opacity="0.25" />
    </Frame>
  ),
  // Speech card with stars - patient feedback.
  feedback: (
    <Frame>
      <rect x="44" y="40" width="112" height="64" rx="12" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <path d="M70 104l-6 16 22-16" fill={CARD} stroke={BORDER} strokeWidth="2" strokeLinejoin="round" />
      <path d="M66 103h22" stroke={CARD} strokeWidth="4" />
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          transform={`translate(${62 + i * 19} 62)`}
          d="M8 0l2.4 5 5.6.8-4 3.9 1 5.5L8 12.6 3 15.2l1-5.5-4-3.9 5.6-.8z"
          fill={P}
          opacity={i < 3 ? 0.8 : 0.18}
        />
      ))}
      <Line x={62} y={86} w={76} h={4} o={0.18} />
    </Frame>
  ),
  // Heart-rate monitor.
  vitals: (
    <Frame>
      <rect x="44" y="38" width="112" height="74" rx="10" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <path d="M54 78h22l8-18 12 34 10-24 6 8h34" stroke={P} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M134 52c-3-5-11-3-11 3 0 5 7 9 11 12 4-3 11-7 11-12 0-6-8-8-11-3z" fill={P} opacity="0.8" />
      <rect x="88" y="112" width="24" height="10" rx="2" fill={MF} opacity="0.3" />
    </Frame>
  ),
  // Big check mark - "all caught up".
  done: (
    <Frame>
      <circle cx="100" cy="76" r="40" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <circle cx="100" cy="76" r="30" fill={P} opacity="0.85" />
      <path d="M86 76l10 10 18-20" stroke="var(--primary-foreground)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="52" cy="46" r="4" fill={P} opacity="0.35" />
      <circle cx="150" cy="56" r="3" fill={P} opacity="0.3" />
      <circle cx="146" cy="108" r="5" fill={P} opacity="0.2" />
      <path d="M58 104l4 4m0-4l-4 4" stroke={P} strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round" />
    </Frame>
  ),
};

type EmptyStateProps = {
  illustration: EmptyStateIllustration;
  title: string;
  description?: string;
  // Optional one-click way out - e.g. clearing the filter that hid everything.
  action?: { label: string; onClick: () => void };
  // "compact" for side panels, modals and narrow columns.
  size?: "default" | "compact";
};

export default function EmptyState({ illustration, title, description, action, size = "default" }: EmptyStateProps) {
  const compact = size === "compact";
  return (
    <div className={`flex flex-col items-center justify-center whitespace-normal px-4 text-center normal-case ${compact ? "py-6" : "py-12"}`}>
      <div className={`animate-empty-float ${compact ? "mb-3 h-24 w-28" : "mb-4 h-32 w-40 sm:h-36 sm:w-44"}`}>
        {illustrations[illustration]}
      </div>
      <h3 className={`font-semibold text-foreground ${compact ? "text-sm" : "text-base"}`}>{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm font-normal text-muted-foreground">{description}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
