import { Frame, Line, P, CARD, BORDER } from "./shared";

// Two chat bubbles.
export default function MessagesIllustration() {
  return (
    <Frame>
      <path d="M44 42a10 10 0 0 1 10-10h62a10 10 0 0 1 10 10v34a10 10 0 0 1-10 10H70l-14 12V86h-2a10 10 0 0 1-10-10z" fill={CARD} stroke={BORDER} strokeWidth="2" strokeLinejoin="round" />
      <Line x={58} y={48} w={48} o={0.25} />
      <Line x={58} y={60} w={34} o={0.18} />
      <path d="M90 74a10 10 0 0 1 10-10h46a10 10 0 0 1 10 10v26a10 10 0 0 1-10 10h-2v12l-14-12h-30a10 10 0 0 1-10-10z" fill={P} />
      <circle cx="108" cy="87" r="3.5" fill="var(--primary-foreground)" />
      <circle cx="122" cy="87" r="3.5" fill="var(--primary-foreground)" />
      <circle cx="136" cy="87" r="3.5" fill="var(--primary-foreground)" />
    </Frame>
  );
}
