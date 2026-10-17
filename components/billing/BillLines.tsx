"use client";

import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Pencil, Trash2, Plus } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import SearchableSelect from "@/components/SearchableSelect";
import { BillingService } from "@/services/billing.service";
import { notifySaveStatus } from "@/lib/saveStatus";
import { formatCurrency } from "@/lib/currency";
import { BILL_ITEM_CATEGORIES, BillItemCategory, BillItemType, BillType } from "@/types/billing.type";

const errorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.message || fallback : fallback;

const CATEGORY_OPTIONS = BILL_ITEM_CATEGORIES.map((c) => ({ value: c, label: c }));

// Numbers as typed (strings) so a box can be cleared; parsed when used. Empty = 0.
const num = (value: string) => Number(value) || 0;
const pct = (value: number) => `${Number(value.toFixed(2))}%`;

// Same per-line maths as Yoton-API's BillCalculator - only used for the live "line total"
// preview while typing; the saved figures always come back from the API.
function previewLineTotal(qty: number, price: number, discountPct: number, taxPct: number, billDiscountPct: number) {
  const gross = qty * price;
  const discounted = gross * (1 - discountPct / 100) * (1 - billDiscountPct / 100);
  return discounted * (1 + taxPct / 100);
}

interface LineForm {
  description: string;
  category: BillItemCategory;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  taxPercent: string;
  serviceCode: string;
}

const emptyForm = (defaultTax: number | null): LineForm => ({
  description: "",
  category: "Other",
  quantity: "1",
  unitPrice: "",
  discountPercent: "",
  taxPercent: defaultTax ? String(defaultTax) : "",
  serviceCode: "",
});

const formFromLine = (line: BillItemType): LineForm => ({
  description: line.description ?? "",
  category: line.category,
  quantity: String(line.quantity),
  unitPrice: String(line.unitPrice),
  discountPercent: line.discountPercent ? String(line.discountPercent) : "",
  taxPercent: line.taxPercent ? String(line.taxPercent) : "",
  serviceCode: line.serviceCode ?? "",
});

const inputClass =
  "w-full p-2.5 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground text-sm";

type BillLinesProps = { bill: BillType; onBillUpdated: (bill: BillType) => void };

// The "Add a line" form - lives in the bill window's left (add items) panel. Key it by bill
// so it starts fresh, with that bill's default tax pre-filled.
export function AddBillLineForm({ bill, onBillUpdated }: BillLinesProps) {
  const billDiscountPct = bill.discountPercent ?? 0;
  const [form, setForm] = useState<LineForm>(() => emptyForm(bill.taxPercent));
  const [isAdding, setIsAdding] = useState(false);

  const formReady = form.description.trim() && num(form.quantity) > 0 && num(form.unitPrice) > 0;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formReady || isAdding) return;
    notifySaveStatus("saving");
    try {
      setIsAdding(true);
      const data = await BillingService.addItem({
        billId: bill.billId,
        description: form.description.trim(),
        category: form.category,
        quantity: num(form.quantity),
        unitPrice: num(form.unitPrice),
        discountPercent: num(form.discountPercent),
        taxPercent: num(form.taxPercent),
        serviceCode: form.serviceCode.trim() || undefined,
      });
      toast.success(data.message || "Item added");
      notifySaveStatus("saved");
      setForm(emptyForm(bill.taxPercent));
      onBillUpdated(data.data);
    } catch (error) {
      notifySaveStatus("error");
      toast.error(errorMessage(error, "Failed to add item"));
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <form onSubmit={handleAdd} className="rounded-lg border border-border p-3">
      <p className="mb-2 text-sm font-bold text-foreground/90">Add a line</p>
      <LineFields form={form} setForm={setForm} />
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          Line total:{" "}
          <b className="text-foreground tabular-nums">
            {formatCurrency(
              previewLineTotal(num(form.quantity), num(form.unitPrice), num(form.discountPercent), num(form.taxPercent), billDiscountPct),
            )}
          </b>
          {billDiscountPct > 0 && ` (incl. ${pct(billDiscountPct)} bill discount)`}
        </span>
        <button
          type="submit"
          disabled={isAdding || !formReady}
          className="flex shrink-0 items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
        >
          <Plus size={15} /> {isAdding ? "Adding..." : "Add"}
        </button>
      </div>
    </form>
  );
}

// The bill's lines - live lines table, removed lines, and the adjust / remove dialogs
// (pending bills only; both need a reason, which the API keeps on the line). Lives in the
// bill window's right panel.
export default function BillLines({ bill, onBillUpdated }: BillLinesProps) {
  const editable = bill.status === "Pending";
  const liveLines = bill.items.filter((i) => !i.isRemoved);
  const removedLines = bill.items.filter((i) => i.isRemoved);

  const [editing, setEditing] = useState<BillItemType | null>(null);
  const [editForm, setEditForm] = useState<LineForm>(() => emptyForm(null));
  const [removing, setRemoving] = useState<BillItemType | null>(null);
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const openEdit = (line: BillItemType) => {
    setEditing(line);
    setEditForm(formFromLine(line));
    setReason("");
  };

  const openRemove = (line: BillItemType) => {
    setRemoving(line);
    setReason("");
  };

  const editReady =
    editForm.description.trim() && num(editForm.quantity) > 0 && num(editForm.unitPrice) > 0 && reason.trim();

  const saveEdit = async () => {
    if (!editing || !editReady) return;
    try {
      setIsSaving(true);
      const data = await BillingService.updateItem(editing.billItemId, {
        description: editForm.description.trim(),
        category: editForm.category,
        quantity: num(editForm.quantity),
        unitPrice: num(editForm.unitPrice),
        discountPercent: num(editForm.discountPercent),
        taxPercent: num(editForm.taxPercent),
        serviceCode: editForm.serviceCode.trim() || undefined,
        reason: reason.trim(),
      });
      toast.success(data.message || "Line updated");
      setEditing(null);
      onBillUpdated(data.data);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update line"));
    } finally {
      setIsSaving(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing || !reason.trim()) return;
    try {
      setIsSaving(true);
      const data = await BillingService.removeItem(removing.billItemId, reason.trim());
      toast.success(data.message || "Line removed");
      setRemoving(null);
      onBillUpdated(data.data);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to remove line"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* ---- Line table ---- */}
      <div>
        {liveLines.length === 0 ? (
          <EmptyState
            size="compact"
            illustration="billing"
            title="No items added yet"
            description={editable ? "Add chargeable items or a custom line from the left." : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-2">Item</th>
                  <th className="py-2 pr-2 text-right">Qty</th>
                  <th className="py-2 pr-2 text-right">Rate</th>
                  <th className="py-2 pr-2 text-right">Disc.</th>
                  <th className="py-2 pr-2 text-right">Tax</th>
                  <th className="py-2 text-right">Total</th>
                  {editable && <th className="py-2 pl-2" />}
                </tr>
              </thead>
              <tbody>
                {liveLines.map((line) => (
                  <tr key={line.billItemId} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-2">
                      <p className="font-medium text-foreground">{line.description}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="rounded bg-muted px-1.5 py-0.5">{line.category}</span>
                        {line.serviceCode && <span>Code {line.serviceCode}</span>}
                        {line.adjustedReason && (
                          <span title={line.adjustedReason} className="italic">Adjusted: {line.adjustedReason}</span>
                        )}
                      </p>
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{Number(line.quantity.toFixed(2))}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(line.unitPrice)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">
                      {line.discountAmount > 0 ? `-${formatCurrency(line.discountAmount)}` : "—"}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">
                      {line.taxAmount > 0 ? (
                        <span title={pct(line.taxPercent)}>+{formatCurrency(line.taxAmount)}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 text-right font-semibold tabular-nums text-foreground">{formatCurrency(line.amount)}</td>
                    {editable && (
                      <td className="py-1 pl-2">
                        <div className="flex justify-end gap-0.5">
                          <button
                            onClick={() => openEdit(line)}
                            title="Adjust line"
                            className="rounded-full p-1.5 text-primary hover:bg-primary/10 cursor-pointer"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => openRemove(line)}
                            title="Remove line"
                            className="rounded-full p-1.5 text-destructive hover:bg-destructive/10 cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {removedLines.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Removed</p>
            {removedLines.map((line) => (
              <div key={line.billItemId} className="flex justify-between gap-3 py-1 text-xs text-muted-foreground">
                <span className="min-w-0">
                  <span className="line-through">{line.description}</span>
                  {line.removedReason && <span className="italic"> — {line.removedReason}</span>}
                </span>
                <span className="shrink-0 line-through tabular-nums">{formatCurrency(line.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Adjust dialog ---- */}
      {editing && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-md">
          <div className="bg-card w-full max-w-lg rounded-xl border border-border p-6 shadow-2xl mx-4">
            <h2 className="text-xl font-semibold text-foreground">Adjust line</h2>
            <p className="mb-4 text-sm text-muted-foreground">{editing.description}</p>
            <LineFields form={editForm} setForm={setEditForm} />
            <ReasonBox value={reason} onChange={setReason} placeholder="Why is this line being changed?" />
            <DialogButtons
              onCancel={() => setEditing(null)}
              onConfirm={saveEdit}
              confirmLabel={isSaving ? "Saving..." : "Save changes"}
              disabled={isSaving || !editReady}
            />
          </div>
        </div>
      )}

      {/* ---- Remove dialog ---- */}
      {removing && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-md">
          <div className="bg-card w-full max-w-md rounded-xl border border-border p-6 shadow-2xl mx-4">
            <h2 className="text-xl font-semibold text-foreground">Remove line</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {removing.description} · {formatCurrency(removing.amount)}
            </p>
            <ReasonBox value={reason} onChange={setReason} placeholder="Why is this line being removed?" />
            <p className="mt-1 text-xs text-muted-foreground">The line stays on the bill&apos;s record, struck through, with this reason.</p>
            <DialogButtons
              onCancel={() => setRemoving(null)}
              onConfirm={confirmRemove}
              confirmLabel={isSaving ? "Removing..." : "Remove line"}
              disabled={isSaving || !reason.trim()}
              destructive
            />
          </div>
        </div>
      )}
    </>
  );
}

function LineFields({ form, setForm }: { form: LineForm; setForm: (f: LineForm) => void }) {
  const set = (key: keyof LineForm) => (value: string) => setForm({ ...form, [key]: value });
  return (
    // Two columns throughout, so it fits both the narrow add-items panel and the adjust dialog.
    <div className="flex flex-col gap-2">
      <input
        type="text"
        placeholder="Description"
        value={form.description}
        onChange={(e) => set("description")(e.target.value)}
        className={inputClass}
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted-foreground">Category</span>
          <SearchableSelect value={form.category} onChange={set("category")} options={CATEGORY_OPTIONS} />
        </label>
        <LabeledInput label="Qty" value={form.quantity} onChange={set("quantity")} step="1" />
        <LabeledInput label="Unit price" value={form.unitPrice} onChange={set("unitPrice")} />
        <LabeledInput label="Disc. %" value={form.discountPercent} onChange={set("discountPercent")} max={100} />
        <LabeledInput label="Tax %" value={form.taxPercent} onChange={set("taxPercent")} max={100} />
        <label className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted-foreground">SAC/HSN code</span>
          <input
            type="text"
            maxLength={20}
            placeholder="Optional"
            value={form.serviceCode}
            onChange={(e) => set("serviceCode")(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  step = "0.01",
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        step={step}
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </label>
  );
}

function ReasonBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <>
      <label className="mt-4 block text-sm font-bold text-foreground/90">Reason</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder={placeholder}
        className="mt-1 w-full resize-none rounded-lg border border-border bg-muted p-3 text-sm text-foreground outline-none focus:border-primary"
      />
    </>
  );
}

function DialogButtons({
  onCancel,
  onConfirm,
  confirmLabel,
  disabled,
  destructive,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  disabled: boolean;
  destructive?: boolean;
}) {
  return (
    <div className="mt-5 flex gap-3">
      <button
        onClick={onCancel}
        className="flex-1 rounded-md border border-border px-5 py-2.5 text-foreground hover:bg-muted transition-colors cursor-pointer"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={disabled}
        className={`flex-1 rounded-md px-5 py-2.5 font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
          destructive ? "bg-destructive text-white hover:opacity-90" : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
