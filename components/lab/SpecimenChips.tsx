"use client";

import type { LabSpecimenSource, LabSpecimenType } from "@/types/labSpecimen.type";

// The cap colour of a tube/container, as a small square - what a collector matches against the
// rack. Containers with no colour (pots, swabs) get a neutral outline.
export function ContainerSwatch({ hex, size = 12, title }: { hex: string | null | undefined; size?: number; title?: string }) {
  return (
    <span
      title={title}
      className="inline-block shrink-0 rounded-sm border border-black/20"
      style={{ width: size, height: size, background: hex || "transparent" }}
    />
  );
}

// Venipuncture order of draw first, then everything outside it (urine, swabs, ...).
export const byDrawOrder = (a: LabSpecimenType, b: LabSpecimenType) =>
  (a.drawOrder ?? 99) - (b.drawOrder ?? 99) || a.containerName.localeCompare(b.containerName);

export function specimenDetail(s: LabSpecimenType): string {
  return [
    s.containerName,
    s.additive && `Additive: ${s.additive}`,
    s.specimenType && `Specimen: ${s.specimenType}`,
    s.volume && `Volume: ${s.volume}`,
    s.inversions && `Mix: ${/^\d/.test(s.inversions) ? `invert ${s.inversions} times` : s.inversions}`,
    s.instructions,
    s.handling,
  ]
    .filter(Boolean)
    .join("\n");
}

// The container(s) a lab request's sample goes in, as compact chips for a card.
export default function SpecimenChips({ specimens, source }: { specimens: LabSpecimenType[]; source: LabSpecimenSource | null }) {
  if (source === "NotRequired") return <p className="text-[11px] text-muted-foreground">No sample container needed</p>;
  if (specimens.length === 0)
    return <p className="text-[11px] text-amber-600">Container not set - check the lab test under Configurable Lists</p>;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {[...specimens].sort(byDrawOrder).map((s, i) => (
        <span
          key={`${s.containerCode}-${i}`}
          title={specimenDetail(s)}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-foreground/90"
        >
          <ContainerSwatch hex={s.colorHex} size={10} />
          <span className="truncate">{s.containerName}</span>
          {(s.volume || s.quantity > 1) && (
            <span className="shrink-0 text-muted-foreground">
              {s.quantity > 1 ? `×${s.quantity}` : ""}
              {s.quantity > 1 && s.volume ? " · " : ""}
              {s.volume}
            </span>
          )}
        </span>
      ))}
      {source === "Suggested" && (
        <span className="text-[10px] text-muted-foreground" title="Not set on the catalog - suggested from the test name by the region's collection rules">
          (suggested)
        </span>
      )}
    </div>
  );
}
