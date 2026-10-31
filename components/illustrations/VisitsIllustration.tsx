import { Frame, P, MF, CARD, BORDER } from "./shared";

// Calendar with a clock.
export default function VisitsIllustration() {
  return (
    <Frame>
      <rect x="48" y="34" width="92" height="84" rx="10" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <path d="M48 44a10 10 0 0 1 10-10h72a10 10 0 0 1 10 10v12H48V44z" fill={P} opacity="0.85" />
      <rect x="68" y="26" width="6" height="16" rx="3" fill={MF} opacity="0.6" />
      <rect x="114" y="26" width="6" height="16" rx="3" fill={MF} opacity="0.6" />
      {[0, 1, 2, 3].map((col) =>
        [0, 1, 2].map((row) => (
          <rect key={`${col}-${row}`} x={60 + col * 18} y={66 + row * 16} width="11" height="9" rx="2.5" fill={MF} opacity="0.15" />
        )),
      )}
      <circle cx="142" cy="108" r="22" fill={CARD} stroke={P} strokeWidth="4" />
      <path d="M142 96v12l8 5" stroke={P} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}
