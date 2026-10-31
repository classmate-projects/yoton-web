"use client";

import { ClipboardList, X } from "lucide-react";
import { useRegion } from "@/lib/region";
import type { LabRequestType } from "@/types/lab.type";
import type { LabSpecimenType } from "@/types/labSpecimen.type";
import { ContainerSwatch, byDrawOrder } from "@/components/lab/SpecimenChips";

interface CollectionGuideModalProps {
  patientName: string;
  // The patient's requests still waiting for collection (same visit, or walk-in).
  requests: LabRequestType[];
  canCollect: boolean;
  collecting: boolean;
  onCollectAll: () => void;
  onClose: () => void;
}

interface Group {
  key: string;
  container: LabSpecimenType;
  tests: { request: LabRequestType; specimen: LabSpecimenType }[];
}

const mixLabel = (inversions: string | null) =>
  inversions ? (/^\d/.test(inversions) ? `invert ${inversions}×` : inversions.toLowerCase()) : null;

// Everything a nurse needs to draw one patient's samples in one go: each container once, in
// the region's order of draw (blood culture first, trace elements last in Qatar), with the
// tests that go in it, then the non-blood samples, then the region's collection reminders.
export default function CollectionGuideModal({ patientName, requests, canCollect, collecting, onCollectAll, onClose }: CollectionGuideModalProps) {
  const region = useRegion();

  const groups = new Map<string, Group>();
  const notSet: LabRequestType[] = [];
  const notRequired: LabRequestType[] = [];
  for (const request of requests) {
    if (request.specimenSource === "NotRequired") notRequired.push(request);
    else if (request.specimens.length === 0) notSet.push(request);
    for (const specimen of request.specimens) {
      const key = specimen.containerCode || specimen.containerName;
      const group = groups.get(key) ?? { key, container: specimen, tests: [] };
      group.tests.push({ request, specimen });
      groups.set(key, group);
    }
  }
  const ordered = [...groups.values()].sort((a, b) => byDrawOrder(a.container, b.container));
  const blood = ordered.filter((g) => g.container.drawOrder != null);
  const other = ordered.filter((g) => g.container.drawOrder == null);

  const renderGroup = (g: Group, step?: number) => (
    <div key={g.key} className="rounded-lg border border-border p-3">
      <div className="flex items-start gap-2">
        <ContainerSwatch hex={g.container.colorHex} size={16} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {step != null && <span className="text-muted-foreground">{step}. </span>}
            {g.container.containerName}
          </p>
          <p className="text-xs text-muted-foreground">
            {[g.container.additive, mixLabel(g.container.inversions)].filter(Boolean).join(" · ")}
          </p>
          {g.container.handling && <p className="mt-1 text-xs text-foreground/70">{g.container.handling}</p>}
        </div>
      </div>
      <ul className="mt-2 flex flex-col gap-1.5 border-t border-border pt-2">
        {g.tests.map(({ request, specimen }, i) => (
          <li key={`${request.labRequestId}-${i}`} className="text-xs">
            <p className="font-medium text-foreground">
              {request.testType}
              {request.priority === "Urgent" && <span className="ml-1.5 font-semibold text-destructive">Urgent</span>}
            </p>
            <p className="text-muted-foreground">
              {[specimen.specimenType, specimen.volume, specimen.quantity > 1 ? `${specimen.quantity} containers` : null].filter(Boolean).join(" · ")}
              {request.specimenSource === "Suggested" && " · suggested"}
            </p>
            {specimen.instructions && <p className="text-amber-700 dark:text-amber-400">{specimen.instructions}</p>}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
      <div className="bg-card w-full max-w-xl rounded-xl border border-border p-6 shadow-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <ClipboardList size={20} className="text-primary" /> Collection guide
          </h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {patientName} · {requests.length} test{requests.length === 1 ? "" : "s"} waiting
          {region?.labSpecimenSource ? ` · ${region.labSpecimenSource}` : ""}
        </p>

        <div className="flex flex-col gap-3">
          {blood.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Blood - draw in this order</p>
              {blood.map((g, i) => renderGroup(g, i + 1))}
            </>
          )}
          {other.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Other samples</p>
              {other.map((g) => renderGroup(g))}
            </>
          )}
          {notSet.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <p className="font-semibold">No container set</p>
              <p>{notSet.map((r) => r.testType).join(", ")} - check with the lab before collecting, or set it under Configurable Lists.</p>
            </div>
          )}
          {notRequired.length > 0 && (
            <p className="text-xs text-muted-foreground">No sample needed: {notRequired.map((r) => r.testType).join(", ")}</p>
          )}
        </div>

        {/* Optional chaining: a region cached in the browser before these notes existed lacks them. */}
        {!!region?.labCollectionNotes?.length && (
          <ul className="mt-4 flex list-disc flex-col gap-1 rounded-lg bg-muted/50 py-3 pl-7 pr-3 text-xs text-muted-foreground">
            {region.labCollectionNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-end gap-3 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-md border border-border hover:bg-muted transition-all duration-200 cursor-pointer text-foreground"
          >
            Close
          </button>
          {canCollect && (
            <button
              type="button"
              onClick={onCollectAll}
              disabled={collecting}
              className="px-5 py-2.5 rounded-md bg-primary text-white hover:opacity-90 transition-all duration-200 cursor-pointer disabled:opacity-60"
            >
              {collecting ? "Collecting..." : `Mark ${requests.length === 1 ? "sample" : `all ${requests.length}`} collected`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
