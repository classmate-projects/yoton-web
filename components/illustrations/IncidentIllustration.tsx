import { Frame, P, CARD, BORDER } from "./shared";

// Shield with an exclamation - incident reports.
export default function IncidentIllustration() {
  return (
    <Frame>
      <path d="M100 28l38 14v28c0 26-17 42-38 50-21-8-38-24-38-50V42z" fill={CARD} stroke={BORDER} strokeWidth="2" strokeLinejoin="round" />
      <path d="M100 38l28 10v22c0 19-12 31-28 37-16-6-28-18-28-37V48z" fill={P} opacity="0.12" />
      <path d="M100 54v24" stroke={P} strokeWidth="6" strokeLinecap="round" />
      <circle cx="100" cy="92" r="4" fill={P} />
    </Frame>
  );
}
