import { Frame, Line, P, MF, CARD, BORDER } from "./shared";

// Notepad with a pen.
export default function NotesIllustration() {
  return (
    <Frame>
      <rect x="54" y="32" width="80" height="90" rx="8" fill={CARD} stroke={BORDER} strokeWidth="2" />
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={70 + i * 16} cy="32" r="4" fill={MF} opacity="0.45" />
      ))}
      <Line x={66} y={50} w={52} o={0.22} />
      <Line x={66} y={62} w={44} o={0.22} />
      <Line x={66} y={74} w={50} o={0.22} />
      <Line x={66} y={86} w={30} o={0.22} />
      <g transform="rotate(35 140 92)">
        <rect x="134" y="52" width="12" height="52" rx="3" fill={P} />
        <path d="M134 104h12l-6 12z" fill={CARD} stroke={P} strokeWidth="2" strokeLinejoin="round" />
        <rect x="134" y="52" width="12" height="8" rx="2" fill={MF} opacity="0.5" />
      </g>
    </Frame>
  );
}
