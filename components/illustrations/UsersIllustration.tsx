import { Frame, P, MF, CARD } from "./shared";

// Group of three people.
export default function UsersIllustration() {
  return (
    <Frame>
      <circle cx="68" cy="66" r="11" fill={MF} opacity="0.25" />
      <path d="M48 106c2-14 10-22 20-22s18 8 20 22z" fill={MF} opacity="0.18" />
      <circle cx="132" cy="66" r="11" fill={MF} opacity="0.25" />
      <path d="M112 106c2-14 10-22 20-22s18 8 20 22z" fill={MF} opacity="0.18" />
      <circle cx="100" cy="58" r="15" fill={CARD} stroke={P} strokeWidth="3" />
      <path d="M72 114c3-18 14-28 28-28s25 10 28 28z" fill={CARD} stroke={P} strokeWidth="3" strokeLinejoin="round" />
    </Frame>
  );
}
