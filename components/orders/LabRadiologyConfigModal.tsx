"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { OrderLockFields } from "@/types/orderLock.type";
import OrderLockNotice from "@/components/orders/OrderLockNotice";

export interface LabRadiologyConfigValues {
  quantity: string;
  priority: string;
  source: string;
  remarks: string;
  bodyParts: string;
  price: string;
  uccCode: string;
  covered: "" | "Yes" | "No";
  preAuthStatus: string;
  patientShareAmount: string;
  coInsurancePercent: string;
}

export const DEFAULT_LAB_RADIOLOGY_VALUES: LabRadiologyConfigValues = {
  quantity: "1",
  priority: "Normal",
  source: "InHouse",
  remarks: "",
  bodyParts: "",
  price: "",
  uccCode: "",
  covered: "",
  preAuthStatus: "Not Required",
  patientShareAmount: "",
  coInsurancePercent: "",
};

interface LabRadiologyConfigModalProps {
  category: "Lab" | "Radiology";
  itemName: string;
  values: LabRadiologyConfigValues;
  // Reference-only hint pulled from the patient's insurance coverage on file - fields stay
  // independently editable, never auto-filled. Same wording the old Order Investigation
  // card used.
  coverageHint?: string | null;
  // lock: this specific order is currently locked (started by a team, or the visit's
  // finalized) - shows who has it and what to do. readOnly: this VIEWER just isn't
  // allowed to edit here regardless (Lab/Radiology/Nursing's own gear-icon view) - no
  // banner, fields simply disabled. The two are independent; either forces disabled=true.
  lock?: OrderLockFields | null;
  visitLockHint?: string;
  readOnly?: boolean;
  saving?: boolean;
  submitLabel: string;
  onSave: (values: LabRadiologyConfigValues) => void;
  onClose: () => void;
}

// The exact field set the old "Order Investigation" card used (quantity, priority, source,
// remarks, body parts for Radiology only, price, UCC code, covered, pre-authorization,
// patient share, co-insurance) - unchanged, just moved behind a gear icon / the unified
// picker's "Add" step instead of living inline in its own card. See LabController/
// RadiologyController for what each field maps to server-side.
export default function LabRadiologyConfigModal({
  category,
  itemName,
  values: initialValues,
  coverageHint,
  lock,
  visitLockHint,
  readOnly = false,
  saving = false,
  submitLabel,
  onSave,
  onClose,
}: LabRadiologyConfigModalProps) {
  const [values, setValues] = useState(initialValues);
  const locked = !!lock?.locked;
  const disabled = locked || readOnly;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-md">
      <div className="card flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-border shadow-2xl">
        <div className="flex items-center justify-between gap-4 p-6 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">{category}</p>
            <h3 className="text-lg font-semibold text-foreground">{itemName}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          {lock && locked && (
            <div className="mb-4">
              <OrderLockNotice lock={lock} visitLockHint={visitLockHint} />
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
              <select
                disabled={disabled}
                value={values.priority}
                onChange={(e) => setValues((p) => ({ ...p, priority: e.target.value }))}
                className="h-10 text-sm disabled:opacity-60"
              >
                <option value="Normal">Normal</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            <select
              disabled={disabled}
              value={values.source}
              onChange={(e) => setValues((p) => ({ ...p, source: e.target.value }))}
              className="h-10 text-sm disabled:opacity-60"
            >
              <option value="InHouse">In-house</option>
              <option value="External">External</option>
            </select>

            <textarea
              disabled={disabled}
              placeholder="Remarks for the lab (optional)"
              value={values.remarks}
              onChange={(e) => setValues((p) => ({ ...p, remarks: e.target.value }))}
              className="w-full min-h-12 text-sm disabled:opacity-60"
            />

            {category === "Radiology" && (
              <input
                type="text"
                disabled={disabled}
                placeholder="Body parts (e.g. Chest, Left knee)"
                value={values.bodyParts}
                onChange={(e) => setValues((p) => ({ ...p, bodyParts: e.target.value }))}
                className="h-10 text-sm disabled:opacity-60"
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Price (AED)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  disabled={disabled}
                  value={values.price}
                  onChange={(e) => setValues((p) => ({ ...p, price: e.target.value }))}
                  className="h-10 text-sm disabled:opacity-60"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">UCC code</label>
                <input
                  type="text"
                  disabled={disabled}
                  value={values.uccCode}
                  onChange={(e) => setValues((p) => ({ ...p, uccCode: e.target.value }))}
                  className="h-10 text-sm disabled:opacity-60"
                />
              </div>
            </div>

            {coverageHint && (
              <p className="rounded-md bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">{coverageHint}</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Covered</label>
                <div className="flex h-10 items-center gap-3 text-sm">
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="radio"
                      disabled={disabled}
                      checked={values.covered === "Yes"}
                      onChange={() => setValues((p) => ({ ...p, covered: "Yes" }))}
                    />{" "}
                    Yes
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="radio"
                      disabled={disabled}
                      checked={values.covered === "No"}
                      onChange={() => setValues((p) => ({ ...p, covered: "No" }))}
                    />{" "}
                    No
                  </label>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Pre-authorization</label>
                <select
                  disabled={disabled}
                  value={values.preAuthStatus}
                  onChange={(e) => setValues((p) => ({ ...p, preAuthStatus: e.target.value }))}
                  className="h-10 text-sm disabled:opacity-60"
                >
                  <option value="Not Required">Not Required</option>
                  <option value="Required">Required</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Patient share (AED)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  disabled={disabled}
                  value={values.patientShareAmount}
                  onChange={(e) => setValues((p) => ({ ...p, patientShareAmount: e.target.value }))}
                  className="h-10 text-sm disabled:opacity-60"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">Co-Insurance (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  disabled={disabled}
                  value={values.coInsurancePercent}
                  onChange={(e) => setValues((p) => ({ ...p, coInsurancePercent: e.target.value }))}
                  className="h-10 text-sm disabled:opacity-60"
                />
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
