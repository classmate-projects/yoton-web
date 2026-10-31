import { Frame, P, CARD, BORDER } from "./shared";

// Open hand with a sanitiser droplet.
export default function HygieneIllustration() {
  return (
    <Frame>
      <path
        d="M70 120V80a6 6 0 0 1 12 0v-28a6 6 0 0 1 12 0v-6a6 6 0 0 1 12 0v6a6 6 0 0 1 12 0v32a6 6 0 0 1 12 0v14c0 12-10 22-22 22H82c-7 0-12-5-12-12z"
        fill={CARD}
        stroke={BORDER}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M140 30c8 10 12 16 12 22a12 12 0 0 1-24 0c0-6 4-12 12-22z" fill={P} />
      <path d="M136 52a5 5 0 0 0 4 5" stroke="var(--primary-foreground)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="58" cy="50" r="5" fill={P} opacity="0.3" />
      <circle cx="50" cy="66" r="3" fill={P} opacity="0.25" />
    </Frame>
  );
}
