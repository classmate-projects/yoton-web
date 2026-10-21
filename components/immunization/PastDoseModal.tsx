"use client";

import { useState } from "react";
import { toast } from "sonner";
import { History, Save, X } from "lucide-react";
import SearchableSelect, { fieldSelectClass } from "@/components/SearchableSelect";
import DatePicker from "@/components/DatePicker";
import { ImmunizationService } from "@/services/immunization.service";
import { apiErrorMessage } from "@/lib/apiError";
import { toDateInputValue } from "@/lib/date";
import type { VaccineType } from "@/types/immunization.type";
import { dateFieldClass, doseOptions, vaccineOption } from "./immunizationUi";

interface PastDoseModalProps {
  patientId: string;
  dateOfBirth: string | null;
  vaccines: VaccineType[];
  prefill?: { vaccineId: string; doseNumber: number } | null;
  onClose: () => void;
  onSaved: () => void;
}

// Completes the record from the child's vaccination card: a dose given at another facility,
// added straight in as given (date only) so the schedule stops showing it as due.
export default function PastDoseModal({ patientId, dateOfBirth, vaccines, prefill, onClose, onSaved }: PastDoseModalProps) {
  const today = toDateInputValue(new Date());
  const [vaccineId, setVaccineId] = useState(prefill?.vaccineId ?? "");
  const [doseNumber, setDoseNumber] = useState(prefill ? String(prefill.doseNumber) : "");
  const [administeredDate, setAdministeredDate] = useState("");
  const [facility, setFacility] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  const vaccine = vaccines.find((v) => v.vaccineId === vaccineId);

  const pickVaccine = (id: string) => {
    setVaccineId(id);
    const options = doseOptions(vaccines.find((v) => v.vaccineId === id));
    if (!options.some((o) => o.value === doseNumber)) setDoseNumber(options[0]?.value ?? "");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaccineId) return toast.error("Select a vaccine");
    if (!doseNumber) return toast.error("Select the dose");
    if (!administeredDate) return toast.error("Enter the date the dose was given");
    if (administeredDate > today) return toast.error("The date given can't be in the future");

    try {
      setSaving(true);
      const res = await ImmunizationService.recordPastDose(patientId, {
        vaccineId,
        doseNumber: Number(doseNumber),
        administeredDate,
        facility: facility.trim() || null,
        batchNumber: batchNumber.trim() || null,
        remarks: remarks.trim() || null,
      });
      toast.success(res.message || "Dose added to the record");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't add the dose"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-xl flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <History size={22} className="text-primary shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-semibold text-foreground">Record a dose given elsewhere</h2>
              <p className="text-sm text-muted-foreground">From the child&apos;s vaccination card or another facility&apos;s record.</p>
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
              options={doseOptions(vaccine)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground required">Date given</label>
            <DatePicker
              value={administeredDate}
              onChange={setAdministeredDate}
              min={dateOfBirth?.slice(0, 10) || undefined}
              max={today}
              className={dateFieldClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Where it was given</label>
            <input
              type="text"
              value={facility}
              onChange={(e) => setFacility(e.target.value)}
              maxLength={200}
              placeholder="Hospital / clinic"
              className="h-10 w-full text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Batch / lot number</label>
            <input
              type="text"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              maxLength={50}
              placeholder="If on the card"
              className="h-10 w-full text-sm"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Remarks</label>
          <input
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            maxLength={1000}
            placeholder="Optional"
            className="h-10 w-full text-sm"
          />
        </div>

        <div className="flex gap-3 justify-end pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Save size={15} /> {saving ? "Saving…" : "Add to record"}
          </button>
        </div>
      </form>
    </div>
  );
}
