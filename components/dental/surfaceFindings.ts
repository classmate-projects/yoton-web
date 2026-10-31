import type { ToothCondition, ToothRecord, ToothSurface } from "@/types/dental.type";

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

export const ALL_SURFACES: ToothSurface[] = ["M", "D", "B", "L", "O"];

// Conditions that describe the whole tooth rather than a surface, in drawing priority.
export const WHOLE_TOOTH_CONDITIONS: ToothCondition[] = [
  "Missing", "BridgePontic", "Implant", "ExtractionIndicated", "Crown", "BridgeAbutment",
];

// Conditions a doctor can chart on an individual surface.
export const SURFACE_CONDITIONS: ToothCondition[] = [
  "Caries", "Filled", "Fracture", "Watch", "Attrition", "Abrasion", "Erosion", "Calculus",
];

// RCT isn't charted per surface, but older charts marked surfaces alongside it and the 2D
// chart has always coloured them with it - so it still counts when nothing else is charted.
const FALLBACK_SURFACE_CONDITIONS: ToothCondition[] = [...SURFACE_CONDITIONS, "RCT"];

export function wholeToothCondition(conditions: ToothCondition[]): ToothCondition | null {
  return WHOLE_TOOTH_CONDITIONS.find((c) => conditions.includes(c)) ?? null;
}

// What a marked surface shows when nothing more specific was charted on it - the first
// surface-level condition the doctor added, same as the 2D chart has always used.
export function primarySurfaceCondition(conditions: ToothCondition[]): ToothCondition | null {
  return conditions.find((c) => FALLBACK_SURFACE_CONDITIONS.includes(c)) ?? null;
}

type SurfaceFields = Pick<ToothRecord, "conditions" | "surfaces" | "surfaceConditions">;

export function surfaceCondition(record: SurfaceFields, surface: ToothSurface): ToothCondition | null {
  if (!record.surfaces.includes(surface)) return null;
  return record.surfaceConditions?.[surface] ?? primarySurfaceCondition(record.conditions);
}

// Missing teeth, pontics and implants have no natural surfaces to chart.
export function surfacesUnavailableReason(conditions: ToothCondition[]): string | null {
  if (conditions.includes("Missing")) return "No surfaces — tooth is missing";
  if (conditions.includes("BridgePontic")) return "No surfaces — bridge pontic has no natural tooth tissue";
  if (conditions.includes("Implant")) return "No natural enamel surfaces — implant crown surfaces not charted here";
  return null;
}

const sortSurfaces = (list: ToothSurface[]) => ALL_SURFACES.filter((s) => list.includes(s));

// Charts `brush` on a surface, or clears it when that's already what's there (or when the
// brush is null - the eraser).
export function paintSurface(record: ToothRecord, surface: ToothSurface, brush: ToothCondition | null): ToothRecord {
  const surfaceConditions = { ...(record.surfaceConditions ?? {}) };
  delete surfaceConditions[surface];
  const others = record.surfaces.filter((s) => s !== surface);

  if (brush === null || surfaceCondition(record, surface) === brush) {
    return { ...record, surfaces: others, surfaceConditions };
  }

  surfaceConditions[surface] = brush;
  const conditions = record.conditions.includes(brush)
    ? record.conditions
    : [...record.conditions.filter((c) => c !== "Healthy"), brush];
  return { ...record, conditions, surfaces: sortSurfaces([...others, surface]), surfaceConditions };
}

// When a condition is taken off the tooth, the surfaces it was charted on go with it.
export function withoutCondition(record: ToothRecord, condition: ToothCondition): ToothRecord {
  const entries = Object.entries(record.surfaceConditions ?? {}) as [ToothSurface, ToothCondition][];
  const cleared = entries.filter(([, c]) => c === condition).map(([s]) => s);
  return {
    ...record,
    conditions: record.conditions.filter((c) => c !== condition),
    surfaces: record.surfaces.filter((s) => !cleared.includes(s)),
    surfaceConditions: Object.fromEntries(entries.filter(([, c]) => c !== condition)),
  };
}

// e.g. "M Caries · O Filled" - for the Dental Details table.
export function surfaceSummary(record: SurfaceFields): string {
  return sortSurfaces(record.surfaces)
    .map((s) => {
      const c = surfaceCondition(record, s);
      return c ? `${s} ${c}` : s;
    })
    .join(" · ");
}
