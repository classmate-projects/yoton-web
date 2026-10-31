import { Frame, Line, P, CARD, BORDER } from "./shared";

// Prescription sheet with a capsule and a "history" clock badge - past medications.
export default function MedicationHistoryIllustration() {
  return (
    <Frame>
      <rect x="52" y="32" width="80" height="90" rx="8" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <path d="M64 64V44h8a5 5 0 0 1 0 10h-8M71 54l11 10M82 56l-8 8" stroke={P} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <Line x={64} y={74} w={56} h={4} o={0.2} />
      <Line x={64} y={84} w={44} h={4} o={0.2} />
      <Line x={64} y={94} w={50} h={4} o={0.2} />
      <g transform="rotate(-35 104 52)">
        <rect x="88" y="45" width="32" height="14" rx="7" fill={CARD} stroke={P} strokeWidth="3" />
        <path d="M104 45h9a7 7 0 0 1 0 14h-9z" fill={P} opacity="0.8" />
      </g>
      <circle cx="140" cy="106" r="20" fill={CARD} stroke={P} strokeWidth="4" />
      <path d="M140 96v10l7 4" stroke={P} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M118 98a22 22 0 0 1 6-10" stroke={P} strokeWidth="3" strokeLinecap="round" opacity="0.5" />
    </Frame>
  );
}
