import { Frame, P, MF, CARD, BORDER } from "./shared";

// Heart-rate monitor.
export default function VitalsIllustration() {
  return (
    <Frame>
      <rect x="44" y="38" width="112" height="74" rx="10" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <path d="M54 78h22l8-18 12 34 10-24 6 8h34" stroke={P} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M134 52c-3-5-11-3-11 3 0 5 7 9 11 12 4-3 11-7 11-12 0-6-8-8-11-3z" fill={P} opacity="0.8" />
      <rect x="88" y="112" width="24" height="10" rx="2" fill={MF} opacity="0.3" />
    </Frame>
  );
}
