import { Frame, Line, P, CARD, BORDER } from "./shared";

// Receipt with a zig-zag tear and a total line.
export default function BillingIllustration() {
  return (
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
  );
}
