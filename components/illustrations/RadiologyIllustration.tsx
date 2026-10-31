import { Frame, P, CARD, BORDER } from "./shared";

// X-ray film showing a chest outline.
export default function RadiologyIllustration() {
  return (
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
  );
}
