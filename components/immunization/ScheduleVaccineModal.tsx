"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Save, X } from "lucide-react";
import SearchableSelect, { fieldSelectClass } from "@/components/SearchableSelect";
import DatePicker from "@/components/DatePicker";
import { ImmunizationService } from "@/services/immunization.service";
import { apiErrorMessage } from "@/lib/apiError";
import { toDateInputValue } from "@/lib/date";
import type { ImmunizationOrderType, VaccineType } from "@/types/immunization.type";
import { dateFieldClass, doseOptions, formatDay, vaccineOption } from "./immunizationUi";

interface ScheduleVaccineModalProps {
  patientId: string;
  vaccines: VaccineType[];
  // Editing (or rescheduling a missed dose) instead of creating.
  order?: ImmunizationOrderType | null;
  // Scheduling straight from a recommended dose on the schedule.
  prefill?: { vaccineId: string; doseNumber: number; date: string } | null;
  doctorId?: string; // admin's acting doctor
  encounterId?: string | null;
  visitId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

// The doctor's immunization order: vaccine, dose, the day it should be given, and remarks.
// Saving creates (or changes) the order the nurse later administers against.
export default function ScheduleVaccineModal({
  patientId,
  vaccines,
  order,
  prefill,
  doctorId,
  encounterId,
  visitId,
  onClose,
  onSaved,
}: ScheduleVaccineModalProps) {
  const today = toDateInputValue(new Date());
  const isEdit = !!order;
  const isReschedule = order?.status === "Missed";

  const [vaccineId, setVaccineId] = useState(order?.vaccineId ?? prefill?.vaccineId ?? "");
  const [doseNumber, setDoseNumber] = useState(String(order?.doseNumber ?? prefill?.doseNumber ?? ""));
  // A missed dose needs a new date; otherwise start from what's there (or the recommended
  // date - never earlier than today).
  const [scheduledDate, setScheduledDate] = useState(() => {
    if (order) return isReschedule ? "" : order.scheduledDate;
    if (prefill?.date) return prefill.date < today ? today : prefill.date;
    return "";
  });
  const [remarks, setRemarks] = useState(order?.remarks ?? "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const vaccine = vaccines.find((v) => v.vaccineId === vaccineId);
  const options = doseOptions(vaccine);
  const scheduleDose = vaccine?.doses.find((d) => d.doseNumber === Number(doseNumber));
  const dateChanged = !order || scheduledDate !== order.scheduledDate;

  const pickVaccine = (id: string) => {
    setVaccineId(id);
    const next = vaccines.find((v) => v.vaccineId === id);
    const nextOptions = doseOptions(next);
    if (!nextOptions.some((o) => o.value === doseNumber)) setDoseNumber(nextOptions[0]?.value ?? "");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaccineId) return toast.error("Select a vaccine");
    if (!doseNumber) return toast.error("Select the dose");
    if (!scheduledDate) return toast.error("Pick the administration date");
    if (dateChanged && scheduledDate < today) return toast.error("The administration date can't be in the past");

    try {
      setSaving(true);
      const res = order
        ? await ImmunizationService.updateOrder(
            order.immunizationOrderId,
            { vaccineId, doseNumber: Number(doseNumber), scheduledDate, remarks: remarks.trim() || null, reason: reason.trim() || null },
            doctorId
          )
        : await ImmunizationService.scheduleVaccination(
            patientId,
            { vaccineId, doseNumber: Number(doseNumber), scheduledDate, remarks: remarks.trim() || null, encounterId, visitId },
            doctorId
          );
      toast.success(res.message || "Saved");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't save the immunization order"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-xl flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <CalendarPlus size={22} className="text-primary shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {isReschedule ? "Reschedule missed dose" : isEdit ? "Change immunization order" : "Schedule vaccination"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isEdit
                  ? `${order!.vaccineName} ${order!.doseLabel} · currently ${formatDay(order!.scheduledDate)}`
                  : "The nurse records the administration against this order."}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground required">Vaccine</label>
          <SearchableSelect
            value={vaccineId}
            onChange={pickVaccine}
            className={fieldSelectClass}
            preserveCase
            placeholder="Select vaccine…"
            options={vaccines.map(vaccineOption)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground required">Dose</label>
            <SearchableSelect
              value={doseNumber}
              onChange={setDoseNumber}
              className={fieldSelectClass}
              preserveCase
              disabled={!vaccine}
              placeholder={vaccine ? "Select dose…" : "Pick a vaccine first"}
              options={options}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground required">Administration date</label>
            <DatePicker value={scheduledDate} onChange={setScheduledDate} min={today} className={dateFieldClass} />
          </div>
        </div>
        {scheduleDose && (
          <p className="-mt-2 text-xs text-muted-foreground">Recommended at {scheduleDose.ageLabel.toLowerCase()} on the routine schedule.</p>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Remarks</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="e.g. Give with the 4-month visit, check for fever first"
            className="w-full text-sm"
          />
        </div>

        {isEdit && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Reason for the change (kept in the audit trail)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="Optional"
              className="h-10 w-full text-sm"
            />
          </div>
        )}

        <div className="flex gap-3 justify-end pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Save size={15} /> {saving ? "Saving…" : isReschedule ? "Reschedule" : isEdit ? "Save changes" : "Schedule"}
          </button>
        </div>
      </form>
    </div>
  );
}
