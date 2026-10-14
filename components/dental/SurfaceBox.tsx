// High-quality 3D occlusal dental chart component.
// Each tooth is rendered from the occlusal (top-down) view with anatomically
// accurate groove networks, multi-layer gradients, cusp highlights, and a
// drop-shadow that give a convincing 3D depth effect.

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

// ── Tooth outlines (54×54 viewBox) ────────────────────────────────────────────
// Coordinate convention: M (mesial) = top (y≈0), D (distal) = bottom (y≈54),
// B (buccal) = right (x≈54), L (lingual/palatal) = left (x≈0), O = centre.
const TOOTH_OUTLINE: Record<ToothShape, string> = {
  // Incisor — wide trapezoid; convex labial (right), slightly concave lingual (left)
  incisor:
    "M15,4 Q27,1 39,4 L48,12 L48,42 Q48,52 36,52 L18,52 Q6,52 6,42 L6,12 Z",
  // Canine — pointed diamond; buccal cusp creates the wide right side
  canine:
    "M10,8 Q27,2 44,8 Q54,18 52,30 Q46,50 27,54 Q8,50 2,30 Q0,18 10,8 Z",
  // Premolar — oval; lightly waisted to hint at two cusps
  premolar:
    "M11,4 Q27,0 43,4 Q55,13 55,27 Q55,41 43,50 Q27,54 11,50 Q-1,41 -1,27 Q-1,13 11,4 Z",
  // Molar — broad rhomboid; mesial (top) visibly wider than distal (bottom)
  molar:
    "M6,10 Q16,3 27,3 Q38,3 48,10 L50,42 Q44,53 27,53 Q10,53 4,42 Z",
};

// ── Surface sector paths (same 54×54 space) ───────────────────────────────────
const SURFACE_PATHS: Record<ToothSurface, string> = {
  M: "M 0,0 L 54,0 L 43,14 L 11,14 Z",
  D: "M 0,54 L 54,54 L 43,40 L 11,40 Z",
  B: "M 54,0 L 54,54 L 43,40 L 43,14 Z",
  L: "M 0,0 L 0,54 L 11,40 L 11,14 Z",
  O: "M 11,14 L 43,14 L 43,40 L 11,40 Z",
};

// ── Anatomical groove network ─────────────────────────────────────────────────
// Lines are primary and secondary grooves; fossae are pit pockets (small circles).
// All coordinates in 54×54 space.
type GrooveSpec =
  | { k: "line"; x1: number; y1: number; x2: number; y2: number; w: number }
  | { k: "fossa"; cx: number; cy: number; r: number };

const GROOVES: Record<ToothShape, GrooveSpec[]> = {
  incisor: [
    // Incisal crest (labial ridge)
    { k: "line", x1: 14, y1: 9, x2: 40, y2: 9, w: 0.9 },
    // Three mamelon notches
    { k: "line", x1: 20, y1: 6, x2: 20, y2: 13, w: 0.75 },
    { k: "line", x1: 27, y1: 5, x2: 27, y2: 13, w: 0.75 },
    { k: "line", x1: 34, y1: 6, x2: 34, y2: 13, w: 0.75 },
    // Cingulum ridge (lingual side)
    { k: "line", x1: 18, y1: 44, x2: 36, y2: 44, w: 0.75 },
    { k: "fossa", cx: 27, cy: 46, r: 1.4 },
  ],
  canine: [
    // Buccal ridge from cusp tip to cervical
    { k: "line", x1: 27, y1: 9, x2: 27, y2: 37, w: 1.0 },
    // Mesial ridge
    { k: "line", x1: 27, y1: 13, x2: 10, y2: 28, w: 0.65 },
    // Distal ridge
    { k: "line", x1: 27, y1: 13, x2: 44, y2: 28, w: 0.65 },
    // Cingulum
    { k: "line", x1: 19, y1: 45, x2: 35, y2: 45, w: 0.75 },
    // Cusp tip pit
    { k: "fossa", cx: 27, cy: 9, r: 1.2 },
    { k: "fossa", cx: 27, cy: 46, r: 1.2 },
  ],
  premolar: [
    // Central groove (main mesiodistal groove)
    { k: "line", x1: 7, y1: 27, x2: 47, y2: 27, w: 1.05 },
    // Buccal groove exits toward buccal surface
    { k: "line", x1: 27, y1: 27, x2: 27, y2: 9, w: 0.90 },
    // Lingual groove exits toward lingual surface
    { k: "line", x1: 27, y1: 27, x2: 27, y2: 45, w: 0.90 },
    // Mesial fossa
    { k: "fossa", cx: 11, cy: 27, r: 1.6 },
    // Central pit
    { k: "fossa", cx: 27, cy: 27, r: 1.8 },
    // Distal fossa
    { k: "fossa", cx: 43, cy: 27, r: 1.6 },
  ],
  molar: [
    // Central groove (mesiodistal, main transverse groove)
    { k: "line", x1: 9,  y1: 27, x2: 45, y2: 27, w: 1.1 },
    // Buccal groove (runs vertically dividing MB and DB cusps)
    { k: "line", x1: 38, y1: 11, x2: 38, y2: 43, w: 1.0 },
    // Mesial groove exits mesially
    { k: "line", x1: 27, y1: 27, x2: 27, y2: 11, w: 0.80 },
    // Distal groove exits distally
    { k: "line", x1: 27, y1: 27, x2: 27, y2: 43, w: 0.80 },
    // Buccal exit to B surface
    { k: "line", x1: 38, y1: 27, x2: 48, y2: 27, w: 0.75 },
    // Lingual groove (shorter, toward lingual margin)
    { k: "line", x1: 11, y1: 27, x2: 20, y2: 27, w: 0.70 },
    // Central fossa (deepest pit)
    { k: "fossa", cx: 27, cy: 27, r: 2.2 },
    // Mesial fossa pit
    { k: "fossa", cx: 22, cy: 18, r: 1.6 },
    // Distal fossa pit
    { k: "fossa", cx: 32, cy: 36, r: 1.6 },
    // Buccal pit
    { k: "fossa", cx: 43, cy: 27, r: 1.3 },
  ],
};

// ── Cusp highlight positions ──────────────────────────────────────────────────
// Bright specular ellipses on convex cusp tips create the 3D convexity illusion.
type CuspSpot = { cx: number; cy: number; rx: number; ry: number };

const CUSP_HIGHLIGHTS: Record<ToothShape, CuspSpot[]> = {
  incisor: [
    { cx: 20, cy: 8, rx: 3.5, ry: 2.0 },
    { cx: 27, cy: 7, rx: 3.5, ry: 2.0 },
    { cx: 34, cy: 8, rx: 3.5, ry: 2.0 },
  ],
  canine: [
    { cx: 27, cy: 10, rx: 7, ry: 4.5 },
  ],
  premolar: [
    { cx: 27, cy: 10, rx: 7.5, ry: 4.5 },  // buccal cusp
    { cx: 27, cy: 44, rx: 5.5, ry: 3.5 },  // lingual cusp (smaller)
  ],
  molar: [
    { cx: 38, cy: 17, rx: 8.5, ry: 6 },  // mesiobuccal
    { cx: 16, cy: 17, rx: 7.5, ry: 6 },  // mesiolingual
    { cx: 38, cy: 37, rx: 7.5, ry: 5.5 }, // distobuccal
    { cx: 16, cy: 37, rx: 6.5, ry: 5 },  // distolingual
  ],
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
  const wholeCondition   = conditions.find(c => WHOLE_TOOTH_CONDITIONS.includes(c));
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
  const outlinePath  = TOOTH_OUTLINE[shape];
  const grooves      = GROOVES[shape];
  const cuspSpots    = CUSP_HIGHLIGHTS[shape];

  // Stable IDs shared by all instances of the same shape (identical defs → safe)
  const uid = `sb-${shape[0]}`;

  const hasCondition = !!wholeCondition || (surfaces.length > 0 && !!surfaceCondition);
  const showAnatomy  = !wholeCondition;

  return (
    <svg
      viewBox="0 0 54 54"
      width={size}
      height={size}
      className={`cursor-pointer transition-opacity ${isSelected ? "opacity-100" : "opacity-85 hover:opacity-100"}`}
      onClick={onClick}
      style={{ display: "block", filter: "drop-shadow(0px 1.5px 3px rgba(0,0,0,0.28))" }}
    >
      <defs>
        {/* ── Base enamel: radial highlight shifted to upper-buccal ── */}
        <radialGradient id={`eg-${uid}`} cx="62%" cy="24%" r="72%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#fefdf8" />
          <stop offset="38%"  stopColor="#f4ecd9" />
          <stop offset="78%"  stopColor="#dfc8a0" />
          <stop offset="100%" stopColor="#c8a878" />
        </radialGradient>

        {/* ── Ambient occlusion: transparent centre → dark rim ── */}
        <radialGradient id={`ao-${uid}`} cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
          <stop offset="48%"  stopColor="#1a0e04" stopOpacity="0" />
          <stop offset="82%"  stopColor="#1a0e04" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#1a0e04" stopOpacity="0.26" />
        </radialGradient>

        {/* ── Primary specular (buccal-mesial area) ── */}
        <radialGradient id={`sp-${uid}`} cx="62%" cy="22%" r="38%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.72" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>

        {/* ── Cusp tip highlight (reused for each cusp) ── */}
        <radialGradient id={`ch-${uid}`} cx="50%" cy="40%" r="55%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.60" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>

        {/* ── Groove depth colour (linear, darker toward centre for depth cue) ── */}
        <linearGradient id={`gd-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#5a3c1a" />
          <stop offset="100%" stopColor="#3d2208" />
        </linearGradient>

        {/* ── Clip path: confines all layers to tooth silhouette ── */}
        <clipPath id={`cp-${uid}`}>
          <path d={outlinePath} />
        </clipPath>
      </defs>

      {/* ═══ LAYER 1: Base enamel fill ═══ */}
      <path
        d={outlinePath}
        fill={wholeCondition ? CONDITION_COLOR[wholeCondition] : `url(#eg-${uid})`}
        stroke={isSelected ? "#2563eb" : "#8a7060"}
        strokeWidth={isSelected ? 2.2 : 1.2}
      />

      {/* ═══ LAYER 2: Surface condition fills (clipped to tooth) ═══ */}
      <g clipPath={`url(#cp-${uid})`}>
        {allSurfaces.map(surface => {
          const fill = getSurfaceFill(surface);
          if (!fill) return null;
          return (
            <path
              key={surface}
              d={SURFACE_PATHS[surface]}
              fill={fill}
              fillOpacity={0.82}
            />
          );
        })}
      </g>

      {showAnatomy && (
        <>
          {/* ═══ LAYER 3: Anatomical grooves and fossae ═══ */}
          <g clipPath={`url(#cp-${uid})`} opacity={hasCondition ? 0.45 : 0.78}>
            {grooves.map((g, i) => {
              if (g.k === "line") {
                return (
                  <line
                    key={i}
                    x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}
                    stroke={`url(#gd-${uid})`}
                    strokeWidth={g.w}
                    strokeLinecap="round"
                  />
                );
              }
              // fossa: concentric dark circle simulating pit depth
              return (
                <g key={i}>
                  <circle cx={g.cx} cy={g.cy} r={g.r + 1.2}
                    fill="#5a3c1a" fillOpacity={0.20} />
                  <circle cx={g.cx} cy={g.cy} r={g.r}
                    fill="#3d2208" fillOpacity={0.55} />
                  <circle cx={g.cx} cy={g.cy} r={g.r * 0.45}
                    fill="#200e02" fillOpacity={0.70} />
                </g>
              );
            })}
          </g>

          {/* ═══ LAYER 4: Cusp specular highlights ═══ */}
          <g clipPath={`url(#cp-${uid})`} opacity={hasCondition ? 0.30 : 0.88}>
            {cuspSpots.map((c, i) => (
              <ellipse key={i}
                cx={c.cx} cy={c.cy} rx={c.rx} ry={c.ry}
                fill={`url(#ch-${uid})`}
              />
            ))}
          </g>

          {/* ═══ LAYER 5: Primary buccal-mesial specular ═══ */}
          <path
            d={outlinePath}
            fill={`url(#sp-${uid})`}
            clipPath={`url(#cp-${uid})`}
            opacity={hasCondition ? 0.25 : 0.70}
          />

          {/* ═══ LAYER 6: Ambient occlusion (rim darkening) ═══ */}
          <path
            d={outlinePath}
            fill={`url(#ao-${uid})`}
            clipPath={`url(#cp-${uid})`}
          />
        </>
      )}

      {/* ═══ LAYER 7: Crisp outline on top ═══ */}
      <path
        d={outlinePath}
        fill="none"
        stroke={isSelected ? "#2563eb" : "#7a6050"}
        strokeWidth={isSelected ? 2.2 : 1.1}
      />

      {/* ═══ LAYER 8: Special condition overlays ═══ */}

      {/* Missing / ExtractionIndicated: cross */}
      {(wholeCondition === "Missing" || wholeCondition === "ExtractionIndicated") && (
        <g
          stroke={wholeCondition === "Missing" ? "#ef4444" : "#7f1d1d"}
          strokeWidth={wholeCondition === "Missing" ? 2.2 : 2.8}
          strokeLinecap="round"
        >
          <line x1={11} y1={11} x2={43} y2={43} />
          <line x1={43} y1={11} x2={11} y2={43} />
        </g>
      )}

      {/* Implant: titanium screw threads */}
      {wholeCondition === "Implant" && (
        <g stroke="#374151" strokeWidth={1.3} fill="none">
          <circle cx={27} cy={27} r={11} />
          <circle cx={27} cy={27} r={7} strokeDasharray="2.5 2" />
          <line x1={27} y1={16} x2={27} y2={38} strokeWidth={1} opacity={0.5} />
          <line x1={16} y1={27} x2={38} y2={27} strokeWidth={1} opacity={0.5} />
        </g>
      )}

      {/* Crown: gold circle with cross */}
      {wholeCondition === "Crown" && (
        <g stroke="#92400e" strokeWidth={1.4} fill="none">
          <circle cx={27} cy={27} r={13} />
          <circle cx={27} cy={27} r={8} strokeWidth={0.9} strokeDasharray="2 1.5" />
          <line x1={27} y1={14} x2={27} y2={40} strokeWidth={1} />
          <line x1={14} y1={27} x2={40} y2={27} strokeWidth={1} />
        </g>
      )}

      {/* RCT: purple dot in central fossa */}
      {conditions.includes("RCT") && !wholeCondition && (
        <g>
          <circle cx={27} cy={27} r={7} fill="#7e22ce" fillOpacity={0.15} />
          <circle cx={27} cy={27} r={4.5} fill="#a855f7" />
          <circle cx={25} cy={25} r={1.5} fill="#ffffff" fillOpacity={0.5} />
        </g>
      )}

      {/* Bridge Pontic: shaded diamond */}
      {wholeCondition === "BridgePontic" && (
        <g stroke="#d97706" strokeWidth={1.3} fill="none">
          <line x1={27} y1={10} x2={44} y2={27} />
          <line x1={44} y1={27} x2={27} y2={44} />
          <line x1={27} y1={44} x2={10} y2={27} />
          <line x1={10} y1={27} x2={27} y2={10} />
        </g>
      )}

      {/* Selected ring */}
      {isSelected && (
        <>
          <path d={outlinePath} fill="none" stroke="#2563eb" strokeWidth={2.8} opacity={0.35} />
          <path d={outlinePath} fill="none" stroke="#2563eb" strokeWidth={1.8} />
        </>
      )}

      {/* ═══ Clickable surface hit zones (transparent, fires onSurfaceClick) ═══ */}
      {onSurfaceClick && (
        <g clipPath={`url(#cp-${uid})`}>
          {allSurfaces.map(surface => (
            <path
              key={surface}
              d={SURFACE_PATHS[surface]}
              fill="transparent"
              className="cursor-pointer hover:fill-black/[0.07] transition-colors"
              onClick={e => { e.stopPropagation(); onSurfaceClick(surface); }}
            />
          ))}
        </g>
      )}
    </svg>
  );
}
