import { Frame, P, CARD, BORDER } from "./shared";

// Big check mark - "all caught up".
export default function DoneIllustration() {
  return (
    <Frame>
      <circle cx="100" cy="76" r="40" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <circle cx="100" cy="76" r="30" fill={P} opacity="0.85" />
      <path d="M86 76l10 10 18-20" stroke="var(--primary-foreground)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="52" cy="46" r="4" fill={P} opacity="0.35" />
      <circle cx="150" cy="56" r="3" fill={P} opacity="0.3" />
      <circle cx="146" cy="108" r="5" fill={P} opacity="0.2" />
      <path d="M58 104l4 4m0-4l-4 4" stroke={P} strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round" />
    </Frame>
  );
}
