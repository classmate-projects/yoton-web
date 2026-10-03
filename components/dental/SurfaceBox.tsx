// Interactive 5-surface odontogram box for one tooth.
// Layout (44×44 SVG): 4 outer trapezoids (M/D/B/L) + 1 center square (O/I).
// Each region is independently clickable and coloured by its condition.

import { ToothCondition, ToothSurface } from "@/types/dental.type";

// Condition → fill colour. Missing/Crown/Implant etc. colour the whole tooth via
// the overlay layer; Caries/Filled/RCT colour individual surfaces.
export const CONDITION_COLOR: Record<ToothCondition, string> = {
  Healthy:            "#ffffff",
  Caries:             "#ef4444",
  Filled:             "#3b82f6",
  Missing:            "#9ca3af",
  Implant:            "#6b7280",
  Crown:              "#f59e0b",
  BridgeAbutment:     "#d97706",
  BridgePontic:       "#fde68a",
  RCT:                "#a855f7",
  ExtractionIndicated:"#dc2626",
  Fracture:           "#f97316",
  Watch:              "#eab308",
};

// Whole-tooth conditions take over all 5 regions.
const WHOLE_TOOTH_CONDITIONS: ToothCondition[] = [
  "Missing", "Implant", "Crown", "BridgeAbutment", "BridgePontic", "ExtractionIndicated",
];

const SURFACE_PATHS: Record<ToothSurface, string> = {
  M: "M 0,0 L 44,0 L 34,10 L 10,10 Z",
  D: "M 0,44 L 44,44 L 34,34 L 10,34 Z",
  B: "M 44,0 L 44,44 L 34,34 L 34,10 Z",
  L: "M 0,0 L 0,44 L 10,34 L 10,10 Z",
  O: "M 10,10 L 34,10 L 34,34 L 10,34 Z",
};

interface Props {
  conditions: ToothCondition[];
  surfaces: ToothSurface[];
  isSelected?: boolean;
  onClick: () => void;
  onSurfaceClick?: (surface: ToothSurface) => void;
  size?: number;
}

export default function SurfaceBox({
  conditions, surfaces, isSelected, onClick, onSurfaceClick, size = 44,
}: Props) {
  const wholeCondition = conditions.find(c => WHOLE_TOOTH_CONDITIONS.includes(c));
  const surfaceCondition = conditions.find(c => c === "Caries" || c === "Filled" || c === "RCT" || c === "Fracture" || c === "Watch");

  const getSurfaceFill = (surface: ToothSurface): string => {
    if (wholeCondition) return CONDITION_COLOR[wholeCondition];
    if (surfaces.includes(surface) && surfaceCondition) return CONDITION_COLOR[surfaceCondition];
    return "transparent";
  };

  const allSurfaces: ToothSurface[] = ["M", "D", "B", "L", "O"];

  return (
    <svg
      viewBox="0 0 44 44"
      width={size}
      height={size}
      className={`cursor-pointer transition-opacity ${isSelected ? "opacity-100" : "opacity-90 hover:opacity-100"}`}
      onClick={onClick}
      style={{ display: "block" }}
    >
      {/* Outer border */}
      <rect x={0.5} y={0.5} width={43} height={43}
        fill="none" stroke={isSelected ? "#3b82f6" : "currentColor"} strokeWidth={isSelected ? 2 : 1}
      />

      {/* 5 surface regions */}
      {allSurfaces.map(surface => (
        <path
          key={surface}
          d={SURFACE_PATHS[surface]}
          fill={getSurfaceFill(surface)}
          stroke="currentColor"
          strokeWidth={0.5}
          className={onSurfaceClick ? "cursor-pointer" : ""}
          onClick={onSurfaceClick ? (e) => { e.stopPropagation(); onSurfaceClick(surface); } : undefined}
        />
      ))}

      {/* Missing: red X */}
      {wholeCondition === "Missing" && (
        <g stroke="#ef4444" strokeWidth={2}>
          <line x1={4} y1={4} x2={40} y2={40} />
          <line x1={40} y1={4} x2={4} y2={40} />
        </g>
      )}

      {/* Extraction indicated: dark red X */}
      {wholeCondition === "ExtractionIndicated" && (
        <g stroke="#7f1d1d" strokeWidth={2.5}>
          <line x1={4} y1={4} x2={40} y2={40} />
          <line x1={40} y1={4} x2={4} y2={40} />
        </g>
      )}

      {/* Implant: circle symbol */}
      {wholeCondition === "Implant" && (
        <circle cx={22} cy={22} r={10} fill="none" stroke="#374151" strokeWidth={1.5} strokeDasharray="3 2" />
      )}

      {/* RCT: purple dot in center */}
      {conditions.includes("RCT") && !wholeCondition && (
        <circle cx={22} cy={22} r={4} fill="#a855f7" />
      )}

      {/* Selection highlight ring */}
      {isSelected && (
        <rect x={0.5} y={0.5} width={43} height={43} fill="none"
          stroke="#3b82f6" strokeWidth={2.5} rx={1}
        />
      )}
    </svg>
  );
}
