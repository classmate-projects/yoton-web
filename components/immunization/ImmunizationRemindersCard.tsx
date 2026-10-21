"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { ImmunizationService } from "@/services/immunization.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import type { ImmunizationReminderType, ImmunizationRemindersType } from "@/types/immunization.type";
import { ImmunizationStatusBadge, formatDay } from "./immunizationUi";

const PREVIEW_COUNT = 6;

interface ImmunizationRemindersCardProps {
  // Admin on the Doctor Workbench narrows to the selected doctor's orders; a doctor always
  // sees only their own (decided by the API).
  doctorId?: string;
  onOpenPatient: (patientId: string) => void;
}

const whenText = (r: ImmunizationReminderType) =>
  r.daysFromToday < 0
    ? `${-r.daysFromToday} day${r.daysFromToday === -1 ? "" : "s"} overdue`
    : r.daysFromToday === 0
      ? "today"
      : `in ${r.daysFromToday} day${r.daysFromToday === 1 ? "" : "s"}`;

// Workbench reminders for scheduled vaccinations: overdue ones, those due today, and those
// coming up within the company's reminder window (Settings). Hidden when there's nothing.
export default function ImmunizationRemindersCard({ doctorId, onOpenPatient }: ImmunizationRemindersCardProps) {
  const [reminders, setReminders] = useState<ImmunizationRemindersType | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = async () => {
    try {
      const res = await ImmunizationService.getReminders(doctorId);
      setReminders(res.data ?? null);
    } catch {
      setReminders(null);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId]);

  useSignalRRefetch(["immunizationOrderChanged", "immunizationRemindersUpdated"], () => void load());

  if (!reminders || reminders.items.length === 0) return null;

  // Overdue first (longest overdue at the top), then today, then soonest upcoming.
  const items = [...reminders.items].sort((a, b) => a.daysFromToday - b.daysFromToday);
  const visible = showAll ? items : items.slice(0, PREVIEW_COUNT);

  return (
    <div className={`card p-6 flex flex-col gap-3 border-l-4 ${reminders.overdue > 0 ? "border-l-red-500" : "border-l-amber-500"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <BellRing size={18} className={reminders.overdue > 0 ? "text-red-500" : "text-amber-500"} /> Immunization Reminders
        </h2>
        <p className="text-xs text-muted-foreground">
          {[
            reminders.overdue > 0 ? `${reminders.overdue} overdue` : null,
            reminders.dueToday > 0 ? `${reminders.dueToday} due today` : null,
            reminders.upcoming > 0 ? `${reminders.upcoming} in the next ${reminders.windowDays} day${reminders.windowDays === 1 ? "" : "s"}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {visible.map((r) => (
          <button
            key={r.immunizationOrderId}
            onClick={() => onOpenPatient(r.patientId)}
            className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-left hover:bg-muted/60 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-semibold text-foreground">
                {r.patientName}
                {r.opNumber && <span className="ml-1 font-mono text-[11px] font-normal text-muted-foreground">#{r.opNumber}</span>}
              </p>
              <ImmunizationStatusBadge status={r.displayStatus === "Scheduled" ? "Upcoming" : r.displayStatus} />
            </div>
            <p className="text-xs text-foreground/90">
              {r.vaccineName} · {r.doseLabel}
            </p>
            <p className={`text-xs ${r.displayStatus === "Overdue" ? "font-semibold text-red-600" : "text-muted-foreground"}`}>
              {formatDay(r.scheduledDate)} ({whenText(r)}){r.orderedByName ? ` · ${r.orderedByName}` : ""}
            </p>
          </button>
        ))}
      </div>
      {items.length > PREVIEW_COUNT && (
        <button onClick={() => setShowAll((v) => !v)} className="self-start text-xs font-semibold text-primary hover:underline">
          {showAll ? "Show fewer" : `Show all ${items.length}`}
        </button>
      )}
    </div>
  );
}
