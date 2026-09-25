"use client";

import { useState } from "react";
import { Lock, Plus, X } from "lucide-react";
import ToggleButton from "@/components/ToggleButton";

export interface TreatmentConfigValues {
  quantity: string;
  instructions: string;
  isPackage: boolean;
  isBillingPending: boolean;
}

export const DEFAULT_TREATMENT_VALUES: TreatmentConfigValues = {
  quantity: "1",
  instructions: "",
  isPackage: false,
  isBillingPending: false,
};

interface TreatmentConfigModalProps {
  itemName: string;
  values: TreatmentConfigValues;
  // See LabRadiologyConfigModal's own comment - locked (started/finalized) vs readOnly
  // (this viewer just can't edit here) are independent; either forces fields disabled.
  locked?: boolean;
  lockedBy?: string | null;
  readOnly?: boolean;
  saving?: boolean;
  submitLabel: string;
  onSave: (values: TreatmentConfigValues) => void;
  onClose: () => void;
}

// The exact field set the old "Treatments" card used (quantity, instructions, package,
// billing-pending) - unchanged, just moved behind a gear icon / the unified picker's "Add"
// step instead of living inline in its own card. Deliberately NOT merged with
// LabRadiologyConfigModal's richer field set - Treatment has no price/UCC/covered/pre-auth/
// patient-share/co-insurance fields at all, per the approved plan.
export default function TreatmentConfigModal({
  itemName,
  values: initialValues,
  locked = false,
  lockedBy,
  readOnly = false,
  saving = false,
  submitLabel,
  onSave,
  onClose,
}: TreatmentConfigModalProps) {
  const [values, setValues] = useState(initialValues);
  const disabled = locked || readOnly;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-md">
      <div className="card flex max-h-[85vh] w-full max-w-md flex-col rounded-xl border border-border shadow-2xl">
        <div className="flex items-center justify-between gap-4 p-6 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Treatment</p>
            <h3 className="text-lg font-semibold text-foreground">{itemName}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          {locked && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
              <Lock size={15} className="shrink-0" />
              {lockedBy === "Visit"
                ? "This visit has already been finalized and can no longer be edited."
                : `This order has already been started by ${lockedBy ?? "another team"} — ask them to revert it before editing.`}
            </div>
          )}

          <div className="flex flex-col gap-3 pb-2">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min={1}
                disabled={disabled}
                placeholder="Quantity"
                value={values.quantity}
                onChange={(e) => setValues((p) => ({ ...p, quantity: e.target.value }))}
                className="h-10 text-sm disabled:opacity-60"
              />
              <input
                type="text"
                disabled={disabled}
                placeholder="Instructions (optional)"
                value={values.instructions}
                onChange={(e) => setValues((p) => ({ ...p, instructions: e.target.value }))}
                className="h-10 text-sm disabled:opacity-60"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-sm">
                <ToggleButton
                  checked={values.isPackage}
                  disabled={disabled}
                  onChange={(checked) => setValues((p) => ({ ...p, isPackage: checked }))}
                />
                <span>Package</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <ToggleButton
                  checked={values.isBillingPending}
                  disabled={disabled}
                  onChange={(checked) => setValues((p) => ({ ...p, isBillingPending: checked }))}
                />
                <span>Pending (don&apos;t bill now — carry to next visit)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border p-6 pt-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground"
          >
            {disabled ? "Close" : "Cancel"}
          </button>
          {!disabled && (
            <button
              onClick={() => onSave(values)}
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Plus size={15} /> {saving ? "Saving..." : submitLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
