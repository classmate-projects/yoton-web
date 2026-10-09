import { Frame, P, CARD, BORDER } from "./shared";

// Building with windows and a cross - departments / branches.
export default function BuildingIllustration() {
  return (
    <Frame>
      <rect x="56" y="44" width="88" height="76" rx="6" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <rect x="82" y="30" width="36" height="20" rx="4" fill={CARD} stroke={BORDER} strokeWidth="2" />
      <path d="M100 34v12M94 40h12" stroke={P} strokeWidth="4" strokeLinecap="round" />
      {[0, 1, 2].map((col) =>
        [0, 1].map((row) => (
          <rect key={`${col}-${row}`} x={66 + col * 26} y={58 + row * 20} width="16" height="12" rx="2.5" fill={P} opacity={col === 1 && row === 0 ? 0.5 : 0.15} />
        )),
      )}
      <rect x="90" y="100" width="20" height="20" rx="3" fill={P} opacity="0.7" />
    </Frame>
  );
}
