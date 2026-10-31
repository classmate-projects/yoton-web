"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Save, Syringe, X } from "lucide-react";
import SearchableSelect, { fieldSelectClass } from "@/components/SearchableSelect";
import DatePicker from "@/components/DatePicker";
import DateTimePicker from "@/components/DateTimePicker";
import PasswordInput from "@/components/PasswordInput";
import { ImmunizationService } from "@/services/immunization.service";
import { apiErrorMessage } from "@/lib/apiError";
import { toDateInputValue } from "@/lib/date";
import type { ImmunizationOrderType } from "@/types/immunization.type";
import {
  INJECTION_SITES,
  VACCINE_ROUTES,
  dateFieldClass,
  formatDay,
  timeFieldClass,
  withCurrentOption,
} from "./immunizationUi";

interface AdministerVaccineModalProps {
  order: ImmunizationOrderType;
  // Admin records on behalf of a nurse, who confirms with their own password (same rule as
  // medication administration on the Nurse Workbench).
  isAdmin?: boolean;
  actingNurseId?: string;
  nurses?: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}

const nowLocal = () => {
  const d = new Date();
  return `${toDateInputValue(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// The nurse's half of an immunization order: when it was given, batch/lot and expiry, route,
// injection site and any adverse reaction. Saving marks the order Administered.
export default function AdministerVaccineModal({ order, isAdmin, actingNurseId, nurses = [], onClose, onSaved }: AdministerVaccineModalProps) {
  const today = toDateInputValue(new Date());
  const [administeredAt, setAdministeredAt] = useState(nowLocal);
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [route, setRoute] = useState(order.defaultRoute ?? "");
  const [site, setSite] = useState(order.defaultSite ?? "");
  const [adverseReactions, setAdverseReactions] = useState("");
  const [notes, setNotes] = useState("");
  const [nurseId, setNurseId] = useState(actingNurseId ?? "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const givenOn = administeredAt.slice(0, 10);
  const expired = !!expiryDate && !!givenOn && expiryDate < givenOn;
  const early = order.scheduledDate > today;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdmin && !nurseId) return toast.error("Select the nurse giving the vaccine");
    if (!administeredAt) return toast.error("Enter when the vaccine was given");
    const givenAt = new Date(administeredAt);
    if (Number.isNaN(givenAt.getTime())) return toast.error("Enter a valid date and time");
    if (givenAt.getTime() > Date.now() + 5 * 60_000) return toast.error("The administration time can't be in the future");
    if (!batchNumber.trim()) return toast.error("Batch/lot number is required");
    if (!expiryDate) return toast.error("Expiry date is required");
    if (expired) return toast.error("This batch has expired - an expired vaccine can't be recorded as given");
    if (!route) return toast.error("Select the route");
    if (!site) return toast.error("Select the injection site");
    if (!password) return toast.error(isAdmin ? "Enter the nurse's password to confirm" : "Enter your password to confirm");

    try {
      setSaving(true);
      const res = await ImmunizationService.administer(order.immunizationOrderId, {
        administeredAt: givenAt.toISOString(),
        batchNumber: batchNumber.trim(),
        expiryDate,
        route,
        injectionSite: site,
        adverseReactions: adverseReactions.trim() || null,
        notes: notes.trim() || null,
        nurseId: isAdmin ? nurseId : undefined,
        password,
      });
      toast.success(res.message || "Vaccine recorded as given");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't record the administration"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-background p-6 shadow-xl flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Syringe size={22} className="text-primary shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-semibold text-foreground">Administer vaccine</h2>
              <p className="text-sm text-muted-foreground">
                {order.vaccineName} {order.doseLabel}
                {order.vaccineDescription ? ` · ${order.vaccineDescription}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Ordered by {order.orderedByName || "the doctor"} for {formatDay(order.scheduledDate)}
                {order.defaultDose ? ` · usual dose ${order.defaultDose}` : ""}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        {order.remarks && (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-foreground">
            <span className="font-semibold">Doctor&apos;s remarks:</span> {order.remarks}
          </p>
        )}
        {early && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            This dose is scheduled for {formatDay(order.scheduledDate)} - check with the doctor before giving it early.
          </p>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground required">Date &amp; time given</label>
          <DateTimePicker
            value={administeredAt}
            onChange={setAdministeredAt}
            max={today}
            dateClassName={dateFieldClass}
            timeClassName={timeFieldClass}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground required">Batch / lot number</label>
            <input
              type="text"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              maxLength={50}
              placeholder="e.g. A21CB143"
              className="h-10 w-full text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground required">Expiry date</label>
            <DatePicker value={expiryDate} onChange={setExpiryDate} className={dateFieldClass} />
            {expired && <p className="text-xs font-semibold text-red-600">Expired - this batch can&apos;t be used.</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground required">Route</label>
            <SearchableSelect
              value={route}
              onChange={setRoute}
              className={fieldSelectClass}
              preserveCase
              placeholder="Select route…"
              options={withCurrentOption(VACCINE_ROUTES, route)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground required">Injection site</label>
            <SearchableSelect
              value={site}
              onChange={setSite}
              className={fieldSelectClass}
              preserveCase
              placeholder="Select site…"
              options={withCurrentOption(INJECTION_SITES, site)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Adverse reactions</label>
          <textarea
            value={adverseReactions}
            onChange={(e) => setAdverseReactions(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Leave empty if none observed"
            className="w-full text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            placeholder="Optional"
            className="h-10 w-full text-sm"
          />
        </div>

        {isAdmin && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground required">Nurse giving the vaccine</label>
            <SearchableSelect
              value={nurseId}
              onChange={setNurseId}
              className={fieldSelectClass}
              preserveCase
              placeholder="Select nurse…"
              options={nurses.map((n) => ({ value: n.id, label: n.name }))}
            />
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground required">{isAdmin ? "Nurse's password" : "Your password"}</label>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password to confirm"
            className="h-10 w-full text-sm"
          />
        </div>

        <div className="flex gap-3 justify-end pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || expired}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Save size={15} /> {saving ? "Recording…" : "Confirm administration"}
          </button>
        </div>
      </form>
    </div>
  );
}
