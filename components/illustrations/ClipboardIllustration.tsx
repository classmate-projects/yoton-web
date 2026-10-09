import { Frame, Line, P, CARD, BORDER } from "./shared";

// Clipboard with checklist rows - audit logs, open cases, generic lists.
export default function ClipboardIllustration() {
  return (
    <Frame>
      <rect x="58" y="34" width="84" height="88" rx="10" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <rect x="82" y="26" width="36" height="14" rx="5" fill={P} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="70" y={54 + i * 20} width="10" height="10" rx="3" fill="none" stroke={P} strokeOpacity={0.6 - i * 0.15} strokeWidth="2" />
          <Line x={86} y={56 + i * 20} w={i === 1 ? 30 : 42} o={0.22} />
        </g>
      ))}
    </Frame>
  );
}
