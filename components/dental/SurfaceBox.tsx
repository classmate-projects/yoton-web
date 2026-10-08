// Interactive 5-surface odontogram for one tooth.
// Each of the 5 surface zones (M/D/B/L/O) is independently clickable and
// coloured by its condition. The outer boundary is anatomically shaped per
// tooth type and filled with a radial enamel gradient so the box looks like
// an actual tooth seen from the occlusal (top-down) view.

import { ToothCondition, ToothSurface } from "@/types/dental.type";

export type ToothShape = "incisor" | "canine" | "premolar" | "molar";

// ── Condition colours ──────────────────────────────────────────────────────────

export const CONDITION_COLOR: Record<ToothCondition, string> = {
  Healthy:             "#ffffff",
  Caries:              "#ef4444",
  Filled:              "#3b82f6",
  Missing:             "#9ca3af",
  Implant:             "#6b7280",
  Crown:               "#f59e0b",
  BridgeAbutment:      "#d97706",
  BridgePontic:        "#fde68a",
  RCT:                 "#a855f7",
  ExtractionIndicated: "#dc2626",
  Fracture:            "#f97316",
  Watch:               "#eab308",
  Attrition:           "#92400e",
  Abrasion:            "#0d9488",
  Erosion:             "#65a30d",
  Calculus:            "#b45309",
};

const WHOLE_TOOTH_CONDITIONS: ToothCondition[] = [
  "Missing", "Implant", "Crown", "BridgeAbutment", "BridgePontic", "ExtractionIndicated",
];

// ── Occlusal outline paths (54 × 54 coordinate space) ─────────────────────────
// Orientation: M = top, D = bottom, B = right, L = left (matches existing convention).
// Shapes are anatomically proportioned occlusal silhouettes for each tooth class.

const TOOTH_OUTLINE: Record<ToothShape, string> = {
  // Incisors – narrow, rounded rectangle; nearly equal widths buccolingually
  incisor:
    "M17,3 Q37,3 37,3 L47,13 L47,41 Q47,51 37,51 L17,51 Q7,51 7,41 L7,13 Q7,3 17,3Z",
  // Canine – asymmetric oval; wider at buccal (top), narrowing toward lingual (bottom)
  canine:
    "M11,6 Q27,2 43,6 Q52,17 51,29 Q45,48 27,52 Q9,48 3,29 Q2,17 11,6Z",
  // Premolar – oval/elliptical with slight waist
  premolar:
    "M12,4 Q27,1 42,4 Q53,14 53,27 Q53,40 42,50 Q27,53 12,50 Q1,40 1,27 Q1,14 12,4Z",
  // Molar – broad rhomboidal; buccal (top) wider than lingual (bottom)
  molar:
    "M7,9 Q17,3 27,3 Q37,3 47,9 L49,41 Q43,51 27,51 Q11,51 5,41 Z",
};

// ── Surface sector paths (54 × 54, same trapezoid tiling as before) ───────────
// These extend to the edges of the 54 × 54 square; the clipPath clips them to
// the tooth outline, so only the visible part of each sector is rendered.

const SURFACE_PATHS: Record<ToothSurface, string> = {
  M: "M 0,0 L 54,0 L 43,14 L 11,14 Z",
  D: "M 0,54 L 54,54 L 43,40 L 11,40 Z",
  B: "M 54,0 L 54,54 L 43,40 L 43,14 Z",
  L: "M 0,0 L 0,54 L 11,40 L 11,14 Z",
  O: "M 11,14 L 43,14 L 43,40 L 11,40 Z",
};

// ── Anatomical groove lines per tooth type ─────────────────────────────────────
// [x1, y1, x2, y2] segments rendered inside the tooth outline.

const GROOVES: Record<ToothShape, [number, number, number, number][]> = {
  incisor:  [],
  canine:   [[27, 16, 27, 38]],                                  // central ridge
  premolar: [[15, 27, 39, 27], [27, 14, 27, 21], [27, 33, 27, 40]], // central + buccal + lingual
  molar:    [[14, 27, 40, 27], [27, 14, 27, 22], [27, 32, 27, 40]], // X-groove pattern
};

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  conditions: ToothCondition[];
  surfaces: ToothSurface[];
  isSelected?: boolean;
  onClick: () => void;
  onSurfaceClick?: (surface: ToothSurface) => void;
  size?: number;
  shape?: ToothShape;
}

export default function SurfaceBox({
  conditions,
  surfaces,
  isSelected,
  onClick,
  onSurfaceClick,
  size = 44,
  shape = "molar",
}: Props) {
  const wholeCondition = conditions.find(c => WHOLE_TOOTH_CONDITIONS.includes(c));
  const surfaceCondition = conditions.find(c =>
    c === "Caries" || c === "Filled" || c === "RCT" || c === "Fracture" || c === "Watch" ||
    c === "Attrition" || c === "Abrasion" || c === "Erosion" || c === "Calculus",
  );

  const getSurfaceFill = (surface: ToothSurface): string | null => {
    if (wholeCondition) return CONDITION_COLOR[wholeCondition];
    if (surfaces.includes(surface) && surfaceCondition) return CONDITION_COLOR[surfaceCondition];
    return null;
  };

  const allSurfaces: ToothSurface[] = ["M", "D", "B", "L", "O"];
  const outlinePath = TOOTH_OUTLINE[shape];
  const grooves = GROOVES[shape];

  // Stable gradient IDs per shape (last-writer-wins is fine for identical defs)
  const uid = `sb-${shape[0]}`;

  return (
    <svg
      viewBox="0 0 54 54"
      width={size}
      height={size}
      className={`cursor-pointer transition-opacity ${isSelected ? "opacity-100" : "opacity-90 hover:opacity-100"}`}
      onClick={onClick}
      style={{ display: "block" }}
    >
      <defs>
        {/* Enamel radial gradient — bright ivory highlight, warm shadowed rim */}
        <radialGradient id={`eg-${uid}`} cx="36%" cy="24%" r="72%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#fefdf9" />
          <stop offset="48%"  stopColor="#f2ead9" />
          <stop offset="100%" stopColor="#cbb896" />
        </radialGradient>
        {/* Specular highlight layer */}
        <radialGradient id={`sh-${uid}`} cx="36%" cy="22%" r="44%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.52" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        {/* Clip path locks all layers to the tooth outline */}
        <clipPath id={`cp-${uid}`}>
          <path d={outlinePath} />
        </clipPath>
      </defs>

      {/* ── Base fill ── */}
      <path
        d={outlinePath}
        fill={wholeCondition ? CONDITION_COLOR[wholeCondition] : `url(#eg-${uid})`}
        stroke={isSelected ? "#3b82f6" : "#8a7060"}
        strokeWidth={isSelected ? 2 : 1.1}
      />

      {/* ── Surface condition fills (clipped) ── */}
      <g clipPath={`url(#cp-${uid})`}>
        {allSurfaces.map(surface => {
          const fill = getSurfaceFill(surface);
          if (!fill) return null;
          return (
            <path
              key={surface}
              d={SURFACE_PATHS[surface]}
              fill={fill}
              fillOpacity={0.80}
            />
          );
        })}
      </g>

      {/* ── Anatomical groove lines ── */}
      {grooves.length > 0 && (
        <g clipPath={`url(#cp-${uid})`}>
          {grooves.map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#9a8768" strokeWidth={0.85} strokeLinecap="round" opacity={0.55}
            />
          ))}
        </g>
      )}

      {/* ── Specular enamel highlight ── */}
      {!wholeCondition && (
        <path d={outlinePath} fill={`url(#sh-${uid})`} clipPath={`url(#cp-${uid})`} />
      )}

      {/* ── Clickable surface hit areas (transparent, for onSurfaceClick) ── */}
      {onSurfaceClick && (
        <g clipPath={`url(#cp-${uid})`}>
          {allSurfaces.map(surface => (
            <path
              key={surface}
              d={SURFACE_PATHS[surface]}
              fill="transparent"
              className="cursor-pointer hover:fill-black/[0.08] transition-colors"
              onClick={(e) => { e.stopPropagation(); onSurfaceClick(surface); }}
            />
          ))}
        </g>
      )}

      {/* ── Tooth outline (drawn on top for crisp edge) ── */}
      <path
        d={outlinePath}
        fill="none"
        stroke={isSelected ? "#3b82f6" : "#8a7060"}
        strokeWidth={isSelected ? 2.5 : 1.1}
      />

      {/* ── Special condition overlays ── */}

      {/* Missing / ExtractionIndicated: red/dark-red × */}
      {(wholeCondition === "Missing" || wholeCondition === "ExtractionIndicated") && (
        <g
          stroke={wholeCondition === "Missing" ? "#ef4444" : "#7f1d1d"}
          strokeWidth={wholeCondition === "Missing" ? 2 : 2.5}
          strokeLinecap="round"
        >
          <line x1={10} y1={10} x2={44} y2={44} />
          <line x1={44} y1={10} x2={10} y2={44} />
        </g>
      )}

      {/* Implant: dashed circle */}
      {wholeCondition === "Implant" && (
        <circle cx={27} cy={27} r={12}
          fill="none" stroke="#374151" strokeWidth={1.5} strokeDasharray="3 2"
        />
      )}

      {/* Crown: circle with lines */}
      {wholeCondition === "Crown" && (
        <g stroke="#92400e" strokeWidth={1.2} fill="none">
          <circle cx={27} cy={27} r={13} />
          <line x1={27} y1={14} x2={27} y2={40} />
          <line x1={14} y1={27} x2={40} y2={27} />
        </g>
      )}

      {/* RCT: purple dot in occlusal center */}
      {conditions.includes("RCT") && !wholeCondition && (
        <circle cx={27} cy={27} r={5} fill="#a855f7" />
      )}

      {/* Selected ring */}
      {isSelected && (
        <path d={outlinePath} fill="none" stroke="#3b82f6" strokeWidth={2.5} />
      )}
    </svg>
  );
}
