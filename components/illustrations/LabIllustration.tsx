import { Frame, P, MF, CARD, BORDER } from "./shared";

// Test tube in a rack.
export default function LabIllustration() {
  return (
    <Frame>
      <rect x="52" y="96" width="96" height="14" rx="4" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <rect x="64" y="42" width="16" height="66" rx="8" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <rect x="92" y="30" width="18" height="78" rx="9" fill={CARD} stroke={P} strokeWidth="3" />
      <path d="M95 74h12v24a6 6 0 0 1-12 0V74z" fill={P} opacity="0.7" />
      <circle cx="101" cy="64" r="2.5" fill={P} opacity="0.45" />
      <circle cx="104" cy="54" r="1.8" fill={P} opacity="0.35" />
      <rect x="88" y="26" width="26" height="7" rx="3.5" fill={P} />
      <rect x="122" y="50" width="16" height="58" rx="8" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <rect x="62" y="38" width="20" height="6" rx="3" fill={MF} opacity="0.4" />
      <rect x="120" y="46" width="20" height="6" rx="3" fill={MF} opacity="0.4" />
    </Frame>
  );
}
