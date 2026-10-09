import { Frame, Line, P, CARD, BORDER } from "./shared";

// Bar chart on a card - reports / analytics.
export default function ChartIllustration() {
  return (
    <Frame>
      <rect x="46" y="34" width="108" height="84" rx="10" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <path d="M60 104h80" stroke={BORDER} strokeWidth="2" strokeLinecap="round" />
      {[22, 36, 16, 44, 28].map((h, i) => (
        <rect key={i} x={64 + i * 15} y={102 - h} width="10" height={h} rx="3" fill={P} opacity={i === 3 ? 0.8 : 0.2} />
      ))}
      <Line x={60} y={46} w={40} h={6} o={0.3} />
    </Frame>
  );
}
