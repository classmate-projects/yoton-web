import { Frame, Line, P, CARD, BORDER } from "./shared";

// Speech card with stars - patient feedback.
export default function FeedbackIllustration() {
  return (
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
  );
}
