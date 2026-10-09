import { Frame, Line, Magnifier, MF, CARD, BORDER } from "./shared";

// Faded result rows with a magnifier - "nothing matched your search/filters".
export default function SearchIllustration() {
  return (
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
  );
}
