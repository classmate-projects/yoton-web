import { Frame, Line, Magnifier, P, CARD, BORDER } from "./shared";

// Patient card with a magnifying glass.
export default function PatientsIllustration() {
  return (
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
  );
}
