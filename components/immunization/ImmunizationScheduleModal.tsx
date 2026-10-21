"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Ban,
  CalendarClock,
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  CircleSlash,
  History,
  Pencil,
  Printer,
  Syringe,
  Undo2,
  X,
} from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import ViewModeToggle from "@/components/ViewModeToggle";
import { useViewModePreference } from "@/hooks/useViewModePreference";
import { ImmunizationService } from "@/services/immunization.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { apiErrorMessage } from "@/lib/apiError";
import type {
  ImmunizationOrderType,
  ImmunizationScheduleType,
  RecommendedDoseType,
  VaccineType,
} from "@/types/immunization.type";
import ScheduleVaccineModal from "./ScheduleVaccineModal";
import AdministerVaccineModal from "./AdministerVaccineModal";
import PastDoseModal from "./PastDoseModal";
import ImmunizationReasonModal from "./ImmunizationReasonModal";
import ImmunizationHistoryPrintout from "./ImmunizationHistoryPrintout";
import ImmunizationChart, { ImmunizationChartLegend, type ChartCell, type ChartColumn, type ChartRow } from "./ImmunizationChart";
import {
  ACTION_LABELS,
  ImmunizationStatusBadge,
  approxAgeDays,
  formatDay,
  formatGiven,
  formatGivenDay,
  formatStamp,
  isOpenOrder,
} from "./immunizationUi";

// "doctor" orders/changes/cancels, "nurse" administers; both record outside doses and
// missed appointments. "view" is read-only (print only).
export type ImmunizationRole = "doctor" | "nurse" | "view";

interface ImmunizationScheduleModalProps {
  patientId: string;
  role: ImmunizationRole;
  // Doctor Workbench: admin's acting doctor, and the guard that asks admin to pick one.
  doctorId?: string;
  requireDoctorSelected?: () => boolean;
  encounterId?: string | null;
  visitId?: string | null;
  // Nurse Workbench: admin records on behalf of the acting nurse.
  isAdmin?: boolean;
  actingNurseId?: string;
  nurses?: { id: string; name: string }[];
  currentUserId?: string;
  onClose: () => void;
  onChanged?: () => void;
}

type ReasonAction =
  | { kind: "cancel"; order: ImmunizationOrderType }
  | { kind: "missed"; order: ImmunizationOrderType }
  | { kind: "undo"; order: ImmunizationOrderType }
  | { kind: "notGiven"; dose: RecommendedDoseType };

// Chart column for doses that aren't tied to an age on the routine schedule (optional and
// travel vaccines, additional doses).
const OTHER_COLUMN = "__other";

const doseKey = (d: { vaccineId: string; doseNumber: number }) => `${d.vaccineId}#${d.doseNumber}`;

// The date a chart box shows: the day it was given, else the day it's (or was) booked for.
const orderDateText = (o: ImmunizationOrderType) => (o.status === "Administered" ? formatGivenDay(o) : formatDay(o.scheduledDate));

// The Pediatric Immunization Schedule for one patient: the routine doses recommended for
// their age (with whatever order covers each), and the full vaccination record with each
// order's audit trail. Shared by the Doctor and Nurse Workbenches. Both tabs show either a
// vaccine-by-age chart (grid - the default) or the original list; the choice is remembered
// per user.
export default function ImmunizationScheduleModal({
  patientId,
  role,
  doctorId,
  requireDoctorSelected,
  encounterId,
  visitId,
  isAdmin,
  actingNurseId,
  nurses,
  currentUserId,
  onClose,
  onChanged,
}: ImmunizationScheduleModalProps) {
  const [schedule, setSchedule] = useState<ImmunizationScheduleType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [vaccines, setVaccines] = useState<VaccineType[]>([]);
  const [tab, setTab] = useState<"schedule" | "record">("schedule");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useViewModePreference("immunization.viewMode");
  // The box picked in each tab's chart - a dose key / order id on Schedule, an order id on
  // the record.
  const [selectedScheduleItem, setSelectedScheduleItem] = useState<string | null>(null);
  const [selectedRecordOrder, setSelectedRecordOrder] = useState<string | null>(null);
  // The details shown under the chart - brought into view when a box is picked lower down.
  const selectionRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (selectedScheduleItem || selectedRecordOrder) selectionRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedScheduleItem, selectedRecordOrder]);

  const [scheduleForm, setScheduleForm] = useState<{ order?: ImmunizationOrderType; prefill?: { vaccineId: string; doseNumber: number; date: string } } | null>(null);
  const [administerTarget, setAdministerTarget] = useState<ImmunizationOrderType | null>(null);
  const [pastDose, setPastDose] = useState<{ prefill?: { vaccineId: string; doseNumber: number } } | null>(null);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [showPrint, setShowPrint] = useState(false);

  const load = async () => {
    try {
      const res = await ImmunizationService.getSchedule(patientId);
      setSchedule(res.data ?? null);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't load the immunization schedule"));
    } finally {
      setIsLoading(false);
    }
  };

  const loadVaccines = async () => {
    try {
      const res = await ImmunizationService.getVaccines(true);
      setVaccines(res.data ?? []);
    } catch {
      setVaccines([]);
    }
  };

  useEffect(() => {
    void load();
    void loadVaccines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  useSignalRRefetch(["immunizationOrderChanged", "immunizationRemindersUpdated"], () => void load());
  useSignalRRefetch(["vaccineMasterUpdated"], () => {
    void load();
    void loadVaccines();
  });

  const afterChange = () => {
    void load();
    onChanged?.();
  };

  const isDoctor = role === "doctor";
  const isNurse = role === "nurse";
  const canSchedule = !!schedule?.canSchedule;

  const ordersById = useMemo(
    () => new Map((schedule?.orders ?? []).map((o) => [o.immunizationOrderId, o])),
    [schedule]
  );

  // Recommended doses grouped into age milestones (Birth, 2 months, ...), in age order.
  const milestones = useMemo(() => {
    const groups: { ageLabel: string; date: string; until: string | null; doses: RecommendedDoseType[] }[] = [];
    for (const dose of schedule?.recommended ?? []) {
      const last = groups[groups.length - 1];
      if (last && last.ageLabel === dose.ageLabel) last.doses.push(dose);
      else groups.push({ ageLabel: dose.ageLabel, date: dose.recommendedDate, until: dose.dueUntilDate, doses: [dose] });
    }
    return groups;
  }, [schedule]);

  // Orders that aren't a routine dose (optional/travel vaccines, extra doses).
  const otherOrders = useMemo(() => {
    const covered = new Set((schedule?.recommended ?? []).map((r) => r.immunizationOrderId).filter(Boolean));
    return (schedule?.orders ?? []).filter((o) => !covered.has(o.immunizationOrderId) && o.status !== "Cancelled");
  }, [schedule]);

  // ---------------- CHART (grid view) ----------------

  // Schedule tab: the recommended doses by vaccine and age, plus a column for the vaccines
  // ordered outside the routine schedule.
  const scheduleChart = useMemo(() => {
    const columns: ChartColumn[] = milestones.map((g) => ({
      key: g.ageLabel,
      label: g.ageLabel,
      hint: g.until ? `${formatDay(g.date)} - ${formatDay(g.until)}` : formatDay(g.date),
    }));
    const rows: ChartRow[] = [];
    const rowKeys = new Set<string>();
    const addRow = (vaccineId: string, label: string, hint: string | null) => {
      if (rowKeys.has(vaccineId)) return;
      rowKeys.add(vaccineId);
      rows.push({ key: vaccineId, label, hint });
    };
    const cells: ChartCell[] = [];
    for (const dose of schedule?.recommended ?? []) {
      addRow(dose.vaccineId, dose.vaccineName, dose.vaccineDescription);
      const order = dose.immunizationOrderId ? ordersById.get(dose.immunizationOrderId) : undefined;
      cells.push({
        id: doseKey(dose),
        rowKey: dose.vaccineId,
        colKey: dose.ageLabel,
        title: dose.doseLabel,
        status: dose.status,
        detail: order ? orderDateText(order) : formatDay(dose.recommendedDate),
      });
    }
    if (otherOrders.length > 0) {
      columns.push({ key: OTHER_COLUMN, label: "Other doses", hint: "not on the routine schedule" });
      for (const o of otherOrders) {
        addRow(o.vaccineId, o.vaccineName, o.vaccineDescription);
        cells.push({ id: o.immunizationOrderId, rowKey: o.vaccineId, colKey: OTHER_COLUMN, title: o.doseLabel, status: o.displayStatus, detail: orderDateText(o) });
      }
    }
    return { columns, rows, cells };
  }, [schedule, milestones, otherOrders, ordersById]);

  // Record tab: every order (cancelled ones too) in the box for its vaccine and age. An
  // order's age comes from the recommended schedule, else from the vaccine master's dose
  // (e.g. an older child's record), else it goes under "Other doses".
  const recordChart = useMemo(() => {
    const recommendedByDose = new Map((schedule?.recommended ?? []).map((r) => [doseKey(r), r]));
    const masterDose = new Map(
      vaccines.flatMap((v) => v.doses.map((d) => [doseKey({ vaccineId: v.vaccineId, doseNumber: d.doseNumber }), d] as const))
    );
    const vaccineRank = new Map(vaccines.map((v) => [v.vaccineId, v.sortOrder]));
    const columnsByKey = new Map<string, { column: ChartColumn; days: number }>();
    const rowsByKey = new Map<string, { row: ChartRow; rank: number }>();
    const cells: ChartCell[] = [];
    for (const o of schedule?.orders ?? []) {
      const rec = recommendedByDose.get(doseKey(o));
      const master = masterDose.get(doseKey(o));
      const colKey = rec ? rec.ageLabel : master ? master.ageLabel : OTHER_COLUMN;
      if (!columnsByKey.has(colKey)) {
        columnsByKey.set(colKey, {
          column:
            colKey === OTHER_COLUMN
              ? { key: OTHER_COLUMN, label: "Other doses", hint: "not on the routine schedule" }
              : { key: colKey, label: colKey, hint: rec ? formatDay(rec.recommendedDate) : null },
          days: rec ? rec.ageDays : master ? approxAgeDays(master.ageValue, master.ageUnit) : Number.MAX_SAFE_INTEGER,
        });
      }
      if (!rowsByKey.has(o.vaccineId)) {
        rowsByKey.set(o.vaccineId, {
          row: { key: o.vaccineId, label: o.vaccineName, hint: o.vaccineDescription },
          rank: vaccineRank.get(o.vaccineId) ?? Number.MAX_SAFE_INTEGER,
        });
      }
      cells.push({ id: o.immunizationOrderId, rowKey: o.vaccineId, colKey, title: o.doseLabel, status: o.displayStatus, detail: orderDateText(o) });
    }
    const columns = [...columnsByKey.values()].sort((a, b) => a.days - b.days).map((c) => c.column);
    const rows = [...rowsByKey.values()].sort((a, b) => a.rank - b.rank || a.row.label.localeCompare(b.row.label)).map((r) => r.row);
    return { columns, rows, cells };
  }, [schedule, vaccines]);

  // Offer active vaccines, plus an inactive one only when it's already on the order being edited.
  const formVaccines = (current?: string) => vaccines.filter((v) => v.isActive || v.vaccineId === current);

  const asDoctor = (action: () => void) => () => {
    if (requireDoctorSelected && !requireDoctorSelected()) return;
    action();
  };

  const toggleExpanded = (orderId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });

  const runReasonAction = (action: ReasonAction, reason: string, password: string): Promise<{ message?: string }> => {
    switch (action.kind) {
      case "cancel":
        return ImmunizationService.cancelOrder(action.order.immunizationOrderId, reason, doctorId);
      case "missed":
        return ImmunizationService.markMissed(action.order.immunizationOrderId, reason);
      case "undo":
        return ImmunizationService.undoAdministration(action.order.immunizationOrderId, reason, password);
      default:
        return ImmunizationService.recordMissedDose(
          patientId,
          { vaccineId: action.dose.vaccineId, doseNumber: action.dose.doseNumber, reason },
          doctorId
        );
    }
  };

  const confirmReason = async (reason: string, password: string) => {
    if (!reasonAction) return;
    try {
      const res = await runReasonAction(reasonAction, reason, password);
      toast.success(res.message || "Saved");
      setReasonAction(null);
      afterChange();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't save the change"));
    }
  };

  const canUndo = (o: ImmunizationOrderType) =>
    (isNurse || isDoctor) && o.status === "Administered" && (isAdmin || (!!currentUserId && o.administeredByUserId === currentUserId));

  // ---------------- ACTION BUTTONS ----------------

  const orderActions = (o: ImmunizationOrderType, includeUndo: boolean): ReactNode => {
    const buttons: ReactNode[] = [];
    if (isNurse && isOpenOrder(o)) {
      buttons.push(
        <ActionButton key="administer" primary onClick={() => setAdministerTarget(o)} icon={<Syringe size={13} />}>
          Administer
        </ActionButton>
      );
    }
    if (isDoctor && isOpenOrder(o) && canSchedule) {
      buttons.push(
        <ActionButton key="edit" onClick={asDoctor(() => setScheduleForm({ order: o }))} icon={o.status === "Missed" ? <CalendarClock size={13} /> : <Pencil size={13} />}>
          {o.status === "Missed" ? "Reschedule" : "Edit"}
        </ActionButton>
      );
    }
    if ((isNurse || isDoctor) && (o.displayStatus === "Due" || o.displayStatus === "Overdue")) {
      buttons.push(
        <ActionButton key="missed" onClick={() => setReasonAction({ kind: "missed", order: o })} icon={<CircleSlash size={13} />}>
          Mark missed
        </ActionButton>
      );
    }
    if (isDoctor && isOpenOrder(o)) {
      buttons.push(
        <ActionButton key="cancel" danger onClick={asDoctor(() => setReasonAction({ kind: "cancel", order: o }))} icon={<Ban size={13} />}>
          Cancel
        </ActionButton>
      );
    }
    if (includeUndo && canUndo(o)) {
      buttons.push(
        <ActionButton key="undo" danger onClick={() => setReasonAction({ kind: "undo", order: o })} icon={<Undo2 size={13} />}>
          Undo
        </ActionButton>
      );
    }
    return buttons.length > 0 ? <div className="flex flex-wrap justify-end gap-1.5">{buttons}</div> : null;
  };

  const recommendedActions = (dose: RecommendedDoseType): ReactNode => {
    if (!canSchedule) return null;
    const buttons: ReactNode[] = [];
    if (isDoctor) {
      buttons.push(
        <ActionButton
          key="schedule"
          primary
          onClick={asDoctor(() => setScheduleForm({ prefill: { vaccineId: dose.vaccineId, doseNumber: dose.doseNumber, date: dose.recommendedDate } }))}
          icon={<CalendarPlus size={13} />}
        >
          Schedule
        </ActionButton>
      );
    }
    if (isDoctor || isNurse) {
      buttons.push(
        <ActionButton key="past" onClick={() => setPastDose({ prefill: { vaccineId: dose.vaccineId, doseNumber: dose.doseNumber } })} icon={<History size={13} />}>
          Given elsewhere
        </ActionButton>
      );
    }
    if (isDoctor && (dose.status === "Due" || dose.status === "Overdue")) {
      buttons.push(
        <ActionButton key="notGiven" onClick={asDoctor(() => setReasonAction({ kind: "notGiven", dose }))} icon={<CircleSlash size={13} />}>
          Not given
        </ActionButton>
      );
    }
    return buttons.length > 0 ? <div className="flex flex-wrap justify-end gap-1.5">{buttons}</div> : null;
  };

  // ---------------- ROWS (list view, and the picked box under the chart) ----------------

  const renderDoseRow = (dose: RecommendedDoseType) => {
    const order = dose.immunizationOrderId ? ordersById.get(dose.immunizationOrderId) : undefined;
    return (
      <div key={doseKey(dose)} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
        <div className="min-w-[180px] flex-1">
          <p className="text-sm font-semibold text-foreground">
            {dose.vaccineName} <span className="font-normal text-muted-foreground">· {dose.doseLabel}</span>
          </p>
          {dose.vaccineDescription && <p className="text-xs text-muted-foreground">{dose.vaccineDescription}</p>}
        </div>
        <div className="min-w-[200px] flex-1 text-xs text-muted-foreground">
          {order ? <OrderSummaryLine order={order} /> : <>Not scheduled yet</>}
        </div>
        <ImmunizationStatusBadge status={dose.status} />
        <div className="ml-auto">{order ? orderActions(order, false) : recommendedActions(dose)}</div>
      </div>
    );
  };

  const renderOtherOrderRow = (o: ImmunizationOrderType) => (
    <div key={o.immunizationOrderId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
      <div className="min-w-[180px] flex-1">
        <p className="text-sm font-semibold text-foreground">
          {o.vaccineName} <span className="font-normal text-muted-foreground">· {o.doseLabel}</span>
        </p>
        {o.vaccineDescription && <p className="text-xs text-muted-foreground">{o.vaccineDescription}</p>}
      </div>
      <div className="min-w-[200px] flex-1 text-xs text-muted-foreground">
        <OrderSummaryLine order={o} />
      </div>
      <ImmunizationStatusBadge status={o.displayStatus} />
      <div className="ml-auto">{orderActions(o, false)}</div>
    </div>
  );

  const renderRecordCard = (o: ImmunizationOrderType) => {
    const isOpen = expanded.has(o.immunizationOrderId);
    return (
      <div key={o.immunizationOrderId} className={`rounded-lg border border-border px-3 py-2.5 ${o.status === "Cancelled" ? "opacity-70" : ""}`}>
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <div className="min-w-[180px] flex-1">
            <p className="text-sm font-semibold text-foreground">
              {o.vaccineName} <span className="font-normal text-muted-foreground">· {o.doseLabel}</span>
              {o.isExternal && (
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Given elsewhere</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {o.isExternal
                ? `Recorded by ${o.administeredByName || "—"} on ${formatStamp(o.createdAt)}`
                : `Ordered by ${o.orderedByName || "—"} on ${formatStamp(o.createdAt)} for ${formatDay(o.scheduledDate)}`}
            </p>
          </div>
          <ImmunizationStatusBadge status={o.displayStatus} />
          <div className="ml-auto">{orderActions(o, true)}</div>
        </div>

        <div className="mt-1.5 flex flex-col gap-0.5 text-xs text-muted-foreground">
          {o.status === "Administered" && (
            <p className="text-foreground/90">
              Given {formatGiven(o)}
              {o.isExternal
                ? o.externalFacility ? ` at ${o.externalFacility}` : " at another facility"
                : ` by ${o.administeredByName || "—"}`}
              {o.batchNumber ? ` · Batch ${o.batchNumber}` : ""}
              {o.expiryDate ? ` (exp ${formatDay(o.expiryDate)})` : ""}
              {o.route ? ` · ${o.route}` : ""}
              {o.injectionSite ? ` · ${o.injectionSite}` : ""}
            </p>
          )}
          {o.status === "Administered" && !o.isExternal && (
            <p className={o.adverseReactions ? "font-semibold text-red-600" : ""}>
              Adverse reactions: {o.adverseReactions || "none recorded"}
            </p>
          )}
          {o.administrationNotes && <p>Nurse notes: {o.administrationNotes}</p>}
          {o.remarks && <p>Remarks: {o.remarks}</p>}
          {(o.status === "Missed" || o.status === "Cancelled") && o.statusReason && (
            <p className="text-foreground/90">
              {o.status} by {o.statusChangedByName || "—"} on {formatStamp(o.statusChangedAt)} — {o.statusReason}
            </p>
          )}
        </div>

        <button
          onClick={() => toggleExpanded(o.immunizationOrderId)}
          className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Audit trail ({o.events.length})
        </button>
        {isOpen && (
          <ol className="mt-1.5 flex flex-col gap-1 border-l-2 border-border pl-3">
            {o.events.map((e) => (
              <li key={e.immunizationOrderEventId} className="text-xs">
                <span className="font-semibold text-foreground">{ACTION_LABELS[e.action] ?? e.action}</span>
                <span className="text-muted-foreground">
                  {" "}· {e.userName || "—"}
                  {e.userRole ? ` (${e.userRole})` : ""} · {formatStamp(e.createdAt)}
                </span>
                {e.details && <p className="text-muted-foreground">{e.details}</p>}
                {e.reason && <p className="text-muted-foreground">Reason: {e.reason}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  };

  // What's under the Schedule chart: the picked dose (or other-vaccine order) with its actions.
  const renderScheduleSelection = () => {
    if (!selectedScheduleItem) return <ChartHint />;
    const dose = schedule?.recommended.find((d) => doseKey(d) === selectedScheduleItem);
    if (dose) {
      return (
        <div className="rounded-lg border border-primary/40 bg-primary/5">
          <p className="px-3 pt-2.5 text-xs font-semibold text-muted-foreground">
            {dose.ageLabel} ·{" "}
            {dose.dueUntilDate ? `due ${formatDay(dose.recommendedDate)} - ${formatDay(dose.dueUntilDate)}` : `recommended ${formatDay(dose.recommendedDate)}`}
          </p>
          {renderDoseRow(dose)}
        </div>
      );
    }
    const other = otherOrders.find((o) => o.immunizationOrderId === selectedScheduleItem);
    return other ? (
      <div className="rounded-lg border border-primary/40 bg-primary/5">
        <p className="px-3 pt-2.5 text-xs font-semibold text-muted-foreground">Other doses · not on the routine schedule</p>
        {renderOtherOrderRow(other)}
      </div>
    ) : (
      <ChartHint />
    );
  };

  // ---------------- RENDER ----------------

  const patient = schedule?.patient;
  const counts = schedule?.counts;
  const pickedRecord = selectedRecordOrder ? ordersById.get(selectedRecordOrder) : undefined;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-6xl max-h-[94vh] rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Syringe size={18} className="text-primary" /> Pediatric Immunization Schedule
            </h2>
            {patient && (
              <p className="text-sm text-muted-foreground mt-0.5">
                <span className="font-semibold text-foreground">{patient.name}</span>
                {patient.opNumber ? ` · MRN ${patient.opNumber}` : ""} · {patient.sex || "—"} · DOB {formatDay(patient.dateOfBirth)}
                {patient.ageText ? ` · ${patient.ageText}` : ""}
                {patient.isPediatric && (
                  <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                    Pediatric
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isDoctor && canSchedule && (
              <button
                onClick={asDoctor(() => setScheduleForm({}))}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
              >
                <CalendarPlus size={14} /> Schedule vaccine
              </button>
            )}
            {(isDoctor || isNurse) && canSchedule && (
              <button
                onClick={() => setPastDose({})}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
              >
                <History size={14} /> Record past dose
              </button>
            )}
            {schedule && (
              <button
                onClick={() => setShowPrint(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
              >
                <Printer size={14} /> Print history
              </button>
            )}
            <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-10">
            <LoadingSpinner />
          </div>
        ) : !schedule ? (
          <div className="p-10">
            <EmptyState illustration="clipboard" title="Couldn't load the immunization schedule" />
          </div>
        ) : (
          <>
            {/* Summary + tabs */}
            <div className="px-6 pt-3 shrink-0 flex flex-col gap-3">
              {!canSchedule && (
                <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  {patient?.dateOfBirth
                    ? `This patient is past the pediatric age limit (under ${patient.pediatricMaxAgeYears} years) - the record is read-only.`
                    : "Add the patient's date of birth to use the immunization schedule."}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {counts ? (
                  <div className="flex flex-wrap gap-2 text-xs">
                    <CountChip label="Administered" value={counts.completed} tone="green" />
                    <CountChip label="Scheduled" value={counts.scheduled} tone="blue" />
                    <CountChip label="Due" value={counts.due} tone="amber" />
                    <CountChip label="Overdue" value={counts.overdue} tone="red" />
                    <CountChip label="Missed" value={counts.missed} tone="orange" />
                    {isDoctor && counts.notYetScheduled > 0 && (
                      <span className="self-center text-muted-foreground">
                        {counts.notYetScheduled} recommended dose{counts.notYetScheduled === 1 ? " isn't" : "s aren't"} scheduled yet
                      </span>
                    )}
                  </div>
                ) : (
                  <span />
                )}
                <ViewModeToggle value={viewMode} onChange={setViewMode} />
              </div>
              <div className="flex gap-1 border-b border-border">
                {([
                  ["schedule", "Schedule"],
                  ["record", `Vaccination record (${schedule.orders.length})`],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setTab(value)}
                    className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
                      tab === value ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4">
              {tab === "schedule" ? (
                milestones.length === 0 && otherOrders.length === 0 ? (
                  <EmptyState
                    size="compact"
                    illustration="clipboard"
                    title="No recommended vaccines"
                    description={patient?.dateOfBirth ? "No routine vaccines are set up for this age range." : "The recommended schedule needs the patient's date of birth."}
                  />
                ) : viewMode === "grid" ? (
                  <div className="flex flex-col gap-3">
                    <ImmunizationChartLegend statuses={scheduleChart.cells.map((c) => c.status)} />
                    <ImmunizationChart
                      columns={scheduleChart.columns}
                      rows={scheduleChart.rows}
                      cells={scheduleChart.cells}
                      selectedId={selectedScheduleItem}
                      onSelect={(id) => setSelectedScheduleItem((current) => (current === id ? null : id))}
                    />
                    <div ref={selectionRef}>{renderScheduleSelection()}</div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    {milestones.map((group) => (
                      <section key={group.ageLabel}>
                        <h3 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-foreground">
                          {group.ageLabel}
                          <span className="text-xs font-normal text-muted-foreground">
                            {group.until ? `due ${formatDay(group.date)} - ${formatDay(group.until)}` : `recommended ${formatDay(group.date)}`}
                          </span>
                        </h3>
                        <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
                          {group.doses.map(renderDoseRow)}
                        </div>
                      </section>
                    ))}
                    {otherOrders.length > 0 && (
                      <section>
                        <h3 className="mb-2 text-sm font-semibold text-foreground">Other vaccines</h3>
                        <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
                          {otherOrders.map(renderOtherOrderRow)}
                        </div>
                      </section>
                    )}
                  </div>
                )
              ) : schedule.orders.length === 0 ? (
                <EmptyState
                  size="compact"
                  illustration="clipboard"
                  title="No vaccinations recorded yet"
                  description={isDoctor ? "Schedule a vaccine from the Schedule tab." : undefined}
                />
              ) : viewMode === "grid" ? (
                <div className="flex flex-col gap-3">
                  <ImmunizationChartLegend statuses={recordChart.cells.map((c) => c.status)} />
                  <ImmunizationChart
                    columns={recordChart.columns}
                    rows={recordChart.rows}
                    cells={recordChart.cells}
                    selectedId={selectedRecordOrder}
                    onSelect={(id) => setSelectedRecordOrder((current) => (current === id ? null : id))}
                  />
                  <div ref={selectionRef}>{pickedRecord ? renderRecordCard(pickedRecord) : <ChartHint record />}</div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">{schedule.orders.map(renderRecordCard)}</div>
              )}
            </div>
          </>
        )}
      </div>

      {scheduleForm && (
        <ScheduleVaccineModal
          patientId={patientId}
          vaccines={formVaccines(scheduleForm.order?.vaccineId)}
          order={scheduleForm.order}
          prefill={scheduleForm.prefill}
          doctorId={doctorId}
          encounterId={encounterId}
          visitId={visitId}
          onClose={() => setScheduleForm(null)}
          onSaved={afterChange}
        />
      )}
      {administerTarget && (
        <AdministerVaccineModal
          order={administerTarget}
          isAdmin={isAdmin}
          actingNurseId={actingNurseId}
          nurses={nurses}
          onClose={() => setAdministerTarget(null)}
          onSaved={afterChange}
        />
      )}
      {pastDose && (
        <PastDoseModal
          patientId={patientId}
          dateOfBirth={patient?.dateOfBirth ?? null}
          vaccines={vaccines}
          prefill={pastDose.prefill}
          onClose={() => setPastDose(null)}
          onSaved={afterChange}
        />
      )}
      {reasonAction && <ReasonActionModal action={reasonAction} onConfirm={confirmReason} onClose={() => setReasonAction(null)} />}
      {showPrint && schedule && <ImmunizationHistoryPrintout schedule={schedule} onClose={() => setShowPrint(false)} />}
    </div>
  );
}

function ReasonActionModal({
  action,
  onConfirm,
  onClose,
}: {
  action: ReasonAction;
  onConfirm: (reason: string, password: string) => Promise<void>;
  onClose: () => void;
}) {
  switch (action.kind) {
    case "cancel":
      return (
        <ImmunizationReasonModal
          title="Cancel immunization order"
          description={`${action.order.vaccineName} ${action.order.doseLabel} scheduled for ${formatDay(action.order.scheduledDate)}. The order stays on the record as cancelled.`}
          icon={<Ban size={22} className="text-red-600" />}
          reasonPlaceholder="e.g. Parent declined, contraindicated, ordered twice"
          confirmLabel="Cancel order"
          busyLabel="Cancelling…"
          onConfirm={onConfirm}
          onClose={onClose}
        />
      );
    case "missed":
      return (
        <ImmunizationReasonModal
          title="Mark dose as missed"
          description={`${action.order.vaccineName} ${action.order.doseLabel} was due ${formatDay(action.order.scheduledDate)}. The doctor can reschedule it, or it can still be given late.`}
          icon={<CircleSlash size={22} className="text-amber-600" />}
          reasonPlaceholder="e.g. Patient did not attend, child unwell on the day"
          confirmLabel="Mark missed"
          busyLabel="Saving…"
          tone="warning"
          onConfirm={onConfirm}
          onClose={onClose}
        />
      );
    case "notGiven":
      return (
        <ImmunizationReasonModal
          title="Record dose as not given"
          description={`${action.dose.vaccineName} ${action.dose.doseLabel} (recommended ${formatDay(action.dose.recommendedDate)}) will show as missed instead of due.`}
          icon={<CircleSlash size={22} className="text-amber-600" />}
          reasonPlaceholder="e.g. Past the age limit for this vaccine, parent declined"
          confirmLabel="Record as not given"
          busyLabel="Saving…"
          tone="warning"
          onConfirm={onConfirm}
          onClose={onClose}
        />
      );
    default:
      return (
        <ImmunizationReasonModal
          title="Undo recorded administration"
          description={`${action.order.vaccineName} ${action.order.doseLabel} given ${formatGiven(action.order)}. The details stay in the audit trail${action.order.isExternal ? "." : " and the dose goes back on the schedule."}`}
          icon={<Undo2 size={22} className="text-red-600" />}
          reasonPlaceholder="e.g. Recorded against the wrong patient, wrong batch number"
          confirmLabel="Undo"
          busyLabel="Undoing…"
          requirePassword
          onConfirm={onConfirm}
          onClose={onClose}
        />
      );
  }
}

function ChartHint({ record }: { record?: boolean }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
      {record
        ? "Select a dose in the chart to see its full record and audit trail."
        : "Select a dose in the chart to see its details and actions."}
    </p>
  );
}

function OrderSummaryLine({ order }: { order: ImmunizationOrderType }) {
  if (order.status === "Administered")
    return (
      <>
        Given {formatGiven(order)}
        {order.isExternal ? " (elsewhere)" : ` by ${order.administeredByName || "—"}`}
        {order.batchNumber ? ` · Batch ${order.batchNumber}` : ""}
      </>
    );
  if (order.status === "Missed")
    return (
      <>
        Missed (was due {formatDay(order.scheduledDate)}){order.statusReason ? ` — ${order.statusReason}` : ""}
      </>
    );
  return (
    <>
      Scheduled for {formatDay(order.scheduledDate)} by {order.orderedByName || "—"}
      {order.remarks ? ` · ${order.remarks}` : ""}
    </>
  );
}

function ActionButton({
  children,
  icon,
  onClick,
  primary,
  danger,
}: {
  children: ReactNode;
  icon: ReactNode;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
}) {
  const style = primary
    ? "bg-primary/10 text-primary hover:bg-primary/20"
    : danger
      ? "text-destructive hover:bg-destructive/10"
      : "text-muted-foreground hover:bg-muted hover:text-foreground";
  return (
    <button onClick={onClick} className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${style}`}>
      {icon} {children}
    </button>
  );
}

const CHIP_TONES = {
  green: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900",
  blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900",
  amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900",
  red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900",
  orange: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900",
};

function CountChip({ label, value, tone }: { label: string; value: number; tone: keyof typeof CHIP_TONES }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${value > 0 ? CHIP_TONES[tone] : "border-border text-muted-foreground"}`}>
      {label} <span className="tabular-nums">{value}</span>
    </span>
  );
}
