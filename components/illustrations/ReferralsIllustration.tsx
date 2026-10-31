import { Frame, Line, P, CARD, BORDER } from "./shared";

// Two documents with a hand-off arrow.
export default function ReferralsIllustration() {
  return (
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
  );
}
