"use client";

import { useState } from "react";
import { CalendarRange, Syringe } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import type { ImmunizationOrderType, ImmunizationScheduleType } from "@/types/immunization.type";
import AdministerVaccineModal from "./AdministerVaccineModal";
import { ImmunizationStatusBadge, formatDay, formatGiven, isOpenOrder } from "./immunizationUi";

interface ImmunizationChartCardProps {
  schedule: ImmunizationScheduleType;
  canEdit: boolean;
  isAdmin?: boolean;
  actingNurseId?: string;
  nurses?: { id: string; name: string }[];
  onOpenSchedule: () => void;
  onChanged: () => void;
}

// Nurse Workbench chart card: the doctor-ordered vaccines waiting to be given (due/overdue
// first), each administered right here against its order, plus a way into the full schedule.
export default function ImmunizationChartCard({
  schedule,
  canEdit,
  isAdmin,
  actingNurseId,
  nurses,
  onOpenSchedule,
  onChanged,
}: ImmunizationChartCardProps) {
  const [administerTarget, setAdministerTarget] = useState<ImmunizationOrderType | null>(null);

  const rank = (o: ImmunizationOrderType) =>
    o.displayStatus === "Overdue" ? 0 : o.displayStatus === "Due" ? 1 : o.displayStatus === "Missed" ? 2 : 3;
  const waiting = schedule.orders
    .filter(isOpenOrder)
    .sort((a, b) => rank(a) - rank(b) || a.scheduledDate.localeCompare(b.scheduledDate));
  const lastGiven = schedule.orders
    .filter((o) => o.status === "Administered")
    .sort((a, b) => (b.administeredAt ?? "").localeCompare(a.administeredAt ?? ""))[0];
  const dueNow = waiting.filter((o) => o.displayStatus === "Due" || o.displayStatus === "Overdue").length;

  return (
    <div id="section-immunizations" className={`card p-6 flex flex-col gap-4 ${dueNow > 0 ? "animate-pending-glow" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Syringe size={18} className="text-primary" /> Immunizations
          {schedule.patient.isPediatric && (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
              Pediatric
            </span>
          )}
        </h2>
        <button
          onClick={onOpenSchedule}
          className="flex items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
        >
          <CalendarRange size={14} /> Full schedule
        </button>
      </div>

      {waiting.length > 0 ? (
        <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
          {waiting.map((o) => (
            <div key={o.immunizationOrderId} className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground flex flex-wrap items-center gap-1.5">
                    {o.vaccineName} <span className="font-normal text-muted-foreground">· {o.doseLabel}</span>
                    <ImmunizationStatusBadge status={o.displayStatus} />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {o.status === "Missed" ? `Missed - was due ${formatDay(o.scheduledDate)}` : `For ${formatDay(o.scheduledDate)}`} · ordered by{" "}
                    {o.orderedByName || "—"}
                  </p>
                  {o.remarks && <p className="text-xs text-muted-foreground">Remarks: {o.remarks}</p>}
                </div>
                {canEdit && (
                  <button
                    onClick={() => setAdministerTarget(o)}
                    className="shrink-0 flex items-center gap-1 bg-primary/10 hover:bg-primary/20 text-primary font-semibold py-1 px-2 rounded-lg text-xs transition-colors"
                  >
                    <Syringe size={13} /> Administer
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState size="compact" illustration="done" title="No vaccines waiting to be given" />
      )}

      <p className="text-xs text-muted-foreground">
        {schedule.counts.completed} given · {waiting.length} waiting
        {lastGiven ? ` · last given: ${lastGiven.vaccineName} ${lastGiven.doseLabel} on ${formatGiven(lastGiven)}` : ""}
      </p>

      {administerTarget && (
        <AdministerVaccineModal
          order={administerTarget}
          isAdmin={isAdmin}
          actingNurseId={actingNurseId}
          nurses={nurses}
          onClose={() => setAdministerTarget(null)}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}
