import { Frame, Line, P, CARD, BORDER } from "./shared";

// Stacked documents.
export default function DocumentsIllustration() {
  return (
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
  );
}
