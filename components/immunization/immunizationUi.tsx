import { parseDateInputValue, parseServerUtcDate } from "@/lib/date";
import type { ImmunizationOrderType, ImmunizationStatus, VaccineType } from "@/types/immunization.type";
import type { SearchableSelectOption } from "@/components/SearchableSelect";

// Shared bits of the Pediatric Immunization Schedule screens (doctor, nurse, admin, print).

const STATUS_STYLES: Record<ImmunizationStatus, { label: string; className: string }> = {
  Administered: { label: "Administered", className: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" },
  Scheduled: { label: "Scheduled", className: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
  Due: { label: "Due", className: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
  Overdue: { label: "Overdue", className: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" },
  Missed: { label: "Missed", className: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400" },
  Cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground line-through" },
  Upcoming: { label: "Upcoming", className: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300" },
};

export function ImmunizationStatusBadge({ status }: { status: ImmunizationStatus }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.Scheduled;
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.className}`}>
      {style.label}
    </span>
  );
}

// Same 40px field look as the rest of the clinical forms (see MedicationOrderPanel).
export const dateFieldClass =
  "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-transparent px-3 text-left text-sm text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
export const timeFieldClass =
  "h-10 w-28 shrink-0 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50";

export const VACCINE_ROUTES = ["Intramuscular (IM)", "Subcutaneous (SC)", "Intradermal (ID)", "Oral (PO)", "Intranasal (IN)"];

export const INJECTION_SITES = [
  "Left anterolateral thigh",
  "Right anterolateral thigh",
  "Left deltoid",
  "Right deltoid",
  "Left upper arm",
  "Right upper arm",
  "Left gluteal",
  "Right gluteal",
  "Oral",
  "Intranasal",
  "Other",
];

// A saved value that isn't in the standard list (e.g. a site the vaccine master spells
// differently) still shows up as an option instead of silently going blank.
export const withCurrentOption = (values: string[], current: string | null | undefined): SearchableSelectOption[] =>
  [...(current && !values.includes(current) ? [current] : []), ...values].map((v) => ({ value: v, label: v }));

// "yyyy-MM-dd" fields are calendar days, not instants - read them on local calendar fields so
// a date never slips a day across timezones.
export const formatDay = (value: string | null | undefined) => {
  const date = value ? parseDateInputValue(value.slice(0, 10)) : null;
  return date ? date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—";
};

export const formatStamp = (value: string | null | undefined) =>
  value ? parseServerUtcDate(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

// An outside dose only has a date; one given here has the exact time.
export const formatGiven = (order: ImmunizationOrderType) =>
  order.isExternal ? formatDay(order.scheduledDate) : formatStamp(order.administeredAt);

export const isOpenOrder = (order: ImmunizationOrderType) => order.status === "Scheduled" || order.status === "Missed";

export const vaccineOption = (v: VaccineType): SearchableSelectOption => ({
  value: v.vaccineId,
  label: `${v.name}${v.description ? ` — ${v.description}` : ""}${v.category !== "Routine" ? ` (${v.category})` : ""}`,
});

// Routine vaccines offer their scheduled doses (plus a few extra numbers for catch-up or
// boosters); every other vaccine is just dose 1..10.
export function doseOptions(vaccine: VaccineType | undefined): SearchableSelectOption[] {
  if (!vaccine) return [];
  if (vaccine.doses.length === 0)
    return Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: `Dose ${i + 1}` }));
  const max = Math.max(...vaccine.doses.map((d) => d.doseNumber));
  return [
    ...vaccine.doses.map((d) => ({ value: String(d.doseNumber), label: `${d.doseLabel} · ${d.ageLabel}` })),
    ...[1, 2, 3].map((n) => ({ value: String(max + n), label: `Dose ${max + n} (additional)` })),
  ];
}

export const ACTION_LABELS: Record<string, string> = {
  Scheduled: "Scheduled",
  Modified: "Modified",
  Cancelled: "Cancelled",
  Administered: "Administered",
  AdministrationUndone: "Administration undone",
  MarkedMissed: "Marked missed",
  RecordedPastDose: "Outside dose recorded",
  ReminderUpcoming: "Reminder sent",
  ReminderOverdue: "Overdue reminder",
};
