"use client";

import { useEffect, useState } from "react";
import { PackageCheck, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Modal, day, primaryButton, secondaryButton, smallInputClass, stamp } from "@/components/inventory/inventoryUi";
import { PharmacyService } from "@/services/pharmacy.service";
import { apiErrorMessage } from "@/lib/apiError";
import { packLabel, packText } from "@/lib/packQuantity";
import type { DispensedType } from "@/types/pharmacy.type";

// Medicines a patient brings back after a dispense. Quantities are in each medicine's own unit -
// two strips back from a box come back as two strips, and the box's other strips stay in stock
// as they are. Sealed and fit to give again: back into the batch they came from (same expiry,
// same cost). Otherwise they're written off as they come in. The patient's bill follows either
// way: an unpaid bill goes down, a paid one gets a refund for Billing to pay out.
export default function ReturnDispensedDialog({
  sourceType,
  sourceId,
  title,
  onClose,
  onReturned,
}: {
  sourceType: "Prescription" | "Medication";
  sourceId: string;
  title: string;
  onClose: () => void;
  onReturned: () => void;
}) {
  const [dispense, setDispense] = useState<DispensedType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [reusable, setReusable] = useState(true);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    PharmacyService.getDispensed(sourceType, sourceId)
      .then((r) => setDispense(r.data))
      .catch((err) => setLoadError(apiErrorMessage(err, "Couldn't load what was dispensed")));
  }, [sourceType, sourceId]);

  const lines = dispense?.lines ?? [];
  const entered = lines
    .map((l) => ({ line: l, quantity: Number(amounts[l.issueLineId] || 0) }))
    .filter((x) => x.quantity > 0);
  const tooMuch = entered.find((x) => x.quantity > x.line.canReturn);
  const nothingLeft = lines.length > 0 && lines.every((l) => l.canReturn <= 0);

  const save = async () => {
    if (!dispense || entered.length === 0 || tooMuch) return;
    setBusy(true);
    try {
      const res = await PharmacyService.returnDispensed(dispense.issueId, {
        reason: reason.trim() || undefined,
        reusable,
        lines: entered.map((x) => ({ issueLineId: x.line.issueLineId, quantity: x.quantity })),
      });
      toast.success(res.message ?? "Return recorded");
      onReturned();
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't record the return"));
    } finally {
      setBusy(false);
    }
  };

  const billNote = !dispense?.billStatus
    ? null
    : dispense.billStatus === "Paid"
      ? "The bill is paid - what comes back is refunded (Billing pays it out)."
      : "The bill isn't paid yet - it goes down by what comes back.";

  return (
    <Modal
      title="Medicines brought back"
      subtitle={title}
      onClose={onClose}
      width="max-w-3xl"
      footer={
        dispense && !nothingLeft ? (
          <>
            <button type="button" onClick={onClose} className={secondaryButton}>
              Cancel
            </button>
            <button type="button" onClick={save} disabled={busy || entered.length === 0 || !!tooMuch} className={primaryButton}>
              <Undo2 size={15} /> {busy ? "Recording…" : "Record return"}
            </button>
          </>
        ) : undefined
      }
    >
      {loadError ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{loadError}</p>
      ) : !dispense ? (
        <LoadingSpinner />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">
            {dispense.number} · {dispense.storeName ?? "Pharmacy"} · {stamp(dispense.createdAt)}
            {dispense.issuedByName ? ` · ${dispense.issuedByName}` : ""}
          </p>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="table-compact table-no-row-hover w-full text-sm">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Given</th>
                  <th>Can come back</th>
                  <th className="w-40">Coming back</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const value = amounts[l.issueLineId] ?? "";
                  const over = Number(value || 0) > l.canReturn;
                  const pack = packLabel(l.unit, l.packUnit, l.packSize);
                  return (
                    <tr key={l.issueLineId}>
                      <td>
                        <span className="font-medium text-foreground">{l.itemName}</span>
                        <span className="block text-xs text-muted-foreground">
                          {[l.batchNumber ? `Batch ${l.batchNumber}` : null, l.expiryDate ? `exp ${day(l.expiryDate)}` : null, pack].filter(Boolean).join(" · ")}
                        </span>
                      </td>
                      <td className="whitespace-nowrap">
                        {packText(l.quantity, l.unit, l.packUnit, l.packSize)}
                        {l.returnedQuantity > 0 && (
                          <span className="block text-xs text-muted-foreground">{packText(l.returnedQuantity, l.unit, l.packUnit, l.packSize)} back already</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap">{packText(l.canReturn, l.unit, l.packUnit, l.packSize)}</td>
                      <td>
                        {l.canReturn > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              max={l.canReturn}
                              step="any"
                              value={value}
                              onChange={(e) => setAmounts((a) => ({ ...a, [l.issueLineId]: e.target.value }))}
                              aria-label={`How many ${l.unit} of ${l.itemName} are coming back`}
                              placeholder="0"
                              className={`${smallInputClass} w-20 ${over ? "border-red-500" : ""}`}
                            />
                            <span className="text-xs text-muted-foreground">{l.unit}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">All back</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {tooMuch && (
            <p className="text-xs font-semibold text-red-600">
              Only {packText(tooMuch.line.canReturn, tooMuch.line.unit, tooMuch.line.packUnit, tooMuch.line.packSize)} of {tooMuch.line.itemName} can come back.
            </p>
          )}

          {nothingLeft ? (
            <p className="text-sm text-muted-foreground">Everything dispensed here has already come back.</p>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Condition of what came back">
                <button
                  type="button"
                  aria-pressed={reusable}
                  onClick={() => setReusable(true)}
                  className={`flex items-start gap-2.5 rounded-xl border p-3 text-left text-sm transition-colors ${
                    reusable ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                  }`}
                >
                  <PackageCheck size={18} className="mt-0.5 shrink-0 text-primary" />
                  <span>
                    <span className="block font-semibold text-foreground">Back on the shelf</span>
                    <span className="block text-xs text-muted-foreground">Sealed and fit to give again - goes back into its batch.</span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-pressed={!reusable}
                  onClick={() => setReusable(false)}
                  className={`flex items-start gap-2.5 rounded-xl border p-3 text-left text-sm transition-colors ${
                    !reusable ? "border-red-500 bg-red-500/10" : "border-border hover:bg-muted"
                  }`}
                >
                  <Trash2 size={18} className="mt-0.5 shrink-0 text-red-600" />
                  <span>
                    <span className="block font-semibold text-foreground">Can&apos;t be used again</span>
                    <span className="block text-xs text-muted-foreground">Opened, damaged or not kept properly - written off.</span>
                  </span>
                </button>
              </div>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                placeholder="Why it came back (optional) - e.g. course changed"
                className="h-10 w-full rounded-lg border border-border bg-transparent px-3 text-sm"
              />
              {billNote && <p className="text-xs text-muted-foreground">{billNote}</p>}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
