import { Frame, P, CARD, BORDER } from "./shared";

// Pill bottle with a capsule.
export default function PharmacyIllustration() {
  return (
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
  );
}
