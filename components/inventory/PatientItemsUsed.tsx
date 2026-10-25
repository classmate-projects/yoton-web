"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PackagePlus, Search, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import SearchableSelect, { fieldSelectClass } from "@/components/SearchableSelect";
import { InventoryService } from "@/services/inventory.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency } from "@/lib/currency";
import type { PatientUseItem, PatientUseRecord, PatientUseStore } from "@/types/inventory.type";
import { Field, Modal, primaryButton, qty, secondaryButton, smallInputClass, stamp } from "./inventoryUi";

interface Line {
  item: PatientUseItem;
  quantity: string;
}

// What the store has, searched as you type.
function StoreItemSearch({ storeId, onPick }: { storeId: string; onPick: (item: PatientUseItem) => void }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<PatientUseItem[]>([]);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    const handle = setTimeout(() => {
      InventoryService.patientUseItems(storeId, term.trim() || undefined)
        .then((r) => mine === seq.current && setResults(r.data))
        .catch(() => mine === seq.current && setResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [storeId, term]);

  return (
    <div className="relative" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOpen(false)}>
      <div className="flex h-10 items-center gap-2 rounded-lg border border-border bg-transparent px-3 focus-within:ring-2 focus-within:ring-primary">
        <Search size={15} className="shrink-0 text-muted-foreground" />
        <input
          type="text"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search what this store has…"
          className="h-full min-h-0! flex-1 border-0! bg-transparent! p-0! text-sm! shadow-none! focus-visible:ring-0! focus-visible:ring-offset-0!"
        />
      </div>
      {open && (
        <ul className="absolute z-[90] mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-xl">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">{term.trim() ? `Nothing in stock matches "${term.trim()}"` : "This store has nothing in stock"}</li>
          ) : (
            results.map((r) => (
              <li key={r.itemId}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onPick(r);
                    setTerm("");
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{r.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {r.code}
                      {r.isBillable ? ` · charged ${formatCurrency(r.sellingPrice)} per ${r.unit}` : " · not charged"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {qty(r.quantity)} {r.unit}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

// One earlier record, with returning unused items.
function UsedRecord({ record, onChanged }: { record: PatientUseRecord; onChanged: () => void }) {
  const [returning, setReturning] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const saveReturn = async () => {
    const lines = Object.entries(amounts)
      .map(([issueLineId, v]) => ({ issueLineId, quantity: Number(v) || 0 }))
      .filter((l) => l.quantity > 0);
    if (lines.length === 0) return toast.error("Enter how many are coming back");
    setBusy(true);
    try {
      const res = await InventoryService.returnPatientUse(record.issueId, lines);
      toast.success(res.message ?? "Returned");
      setReturning(false);
      setAmounts({});
      onChanged();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't record the return"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {record.sourceLabel} <span className="font-normal text-muted-foreground">· {record.storeName}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {stamp(record.createdAt)}
            {record.issuedByName ? ` · ${record.issuedByName}` : ""} · {record.number}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {record.charge > 0 && (
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {formatCurrency(record.charge)}
              <span className="block text-right text-[11px] font-normal text-muted-foreground">{record.billId ? `On bill ${record.billId}` : "Not billed yet"}</span>
            </span>
          )}
          {record.canReturn && !returning && (
            <button type="button" onClick={() => setReturning(true)} className={secondaryButton}>
              <Undo2 size={14} /> Return unused
            </button>
          )}
        </div>
      </div>
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {record.lines.map((l) => (
          <li key={l.issueLineId} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-foreground">
              {l.itemName}
              {l.batchNumber && <span className="text-xs text-muted-foreground"> · batch {l.batchNumber}</span>}
            </span>
            <span className="flex items-center gap-2 tabular-nums text-muted-foreground">
              {qty(l.quantity - l.returnedQuantity)} {l.unit}
              {l.returnedQuantity > 0 && <span className="text-xs">({qty(l.returnedQuantity)} returned)</span>}
              {returning && l.quantity > l.returnedQuantity && (
                <input
                  type="number"
                  min={0}
                  max={l.quantity - l.returnedQuantity}
                  step="any"
                  value={amounts[l.issueLineId] ?? ""}
                  onChange={(e) => setAmounts((m) => ({ ...m, [l.issueLineId]: e.target.value }))}
                  placeholder="Back"
                  aria-label={`How many ${l.itemName} are coming back`}
                  className={`${smallInputClass} w-20`}
                />
              )}
            </span>
          </li>
        ))}
      </ul>
      {returning && (
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={() => setReturning(false)} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={saveReturn} disabled={busy} className={primaryButton}>
            <Undo2 size={14} /> Record return
          </button>
        </div>
      )}
    </li>
  );
}

// Items used on a patient: taken from the nurse's own department store and - for billable ones -
// charged to the visit's bill. Also lists everything else the patient's care took from stock
// (medicines dispensed, doses from ward stock, test and procedure supplies).
export default function PatientItemsUsedModal({ patientId, patientName, visitId, onClose }: { patientId: string; patientName: string; visitId?: string | null; onClose: () => void }) {
  const [stores, setStores] = useState<PatientUseStore[] | null>(null);
  const [storeId, setStoreId] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");
  const [records, setRecords] = useState<PatientUseRecord[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    InventoryService.patientUseStores()
      .then((r) => {
        setStores(r.data);
        setStoreId((current) => current || r.data[0]?.storeId || "");
      })
      .catch(() => setStores([]));
  }, []);

  const loadRecords = useCallback(() => {
    InventoryService.patientUse(patientId, visitId)
      .then((r) => setRecords(r.data))
      .catch(() => setRecords([]));
  }, [patientId, visitId]);
  useEffect(() => {
    loadRecords();
  }, [loadRecords]);
  useSignalRRefetch(["inventoryChanged"], loadRecords);

  const charge = lines.reduce((sum, l) => sum + (l.item.isBillable ? (Number(l.quantity) || 0) * l.item.sellingPrice : 0), 0);

  const save = async () => {
    const payload = lines.map((l) => ({ itemId: l.item.itemId, quantity: Number(l.quantity) || 0 }));
    if (payload.length === 0) return toast.error("Add what was used");
    if (payload.some((l) => l.quantity <= 0)) return toast.error("Enter how many of each were used");
    setSaving(true);
    try {
      const res = await InventoryService.recordPatientUse({ storeId, patientId, visitId: visitId ?? null, notes: notes.trim() || null, lines: payload });
      toast.success(res.message ?? "Recorded");
      setLines([]);
      setNotes("");
      loadRecords();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't record it"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Items used" subtitle={`${patientName}${visitId ? " · this visit" : ""} - taken from your store; billable items go on the patient's bill.`} onClose={onClose} width="max-w-3xl">
      {/* Tall enough for the item search's list to open without being cut off. */}
      <div className="flex min-h-96 flex-col gap-5">
        {stores === null ? null : stores.length === 0 ? (
          <p className="rounded-lg bg-muted px-3 py-3 text-sm text-muted-foreground">
            You don&apos;t run a store yet. Ask the store team to set one up for your department (Inventory → Stores), and it will appear here.
          </p>
        ) : (
          <section className="flex flex-col gap-3">
            {stores.length > 1 && (
              <Field label="From store">
                <SearchableSelect
                  value={storeId}
                  onChange={(v) => {
                    setStoreId(v);
                    setLines([]);
                  }}
                  options={stores.map((s) => ({ value: s.storeId, label: s.name }))}
                  className={fieldSelectClass}
                  preserveCase
                />
              </Field>
            )}
            {storeId && (
              <StoreItemSearch
                storeId={storeId}
                onPick={(item) =>
                  lines.some((l) => l.item.itemId === item.itemId)
                    ? toast.info(`${item.name} is already listed`)
                    : setLines((ls) => [...ls, { item, quantity: "1" }])
                }
              />
            )}
            {lines.length > 0 && (
              <>
                <table className="table-compact table-no-row-hover w-full text-sm">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="w-36">Used</th>
                      <th className="text-right">Charged</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.item.itemId}>
                        <td>
                          {l.item.name}
                          <span className="block text-xs text-muted-foreground">
                            {qty(l.item.quantity)} {l.item.unit} in the store
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              max={l.item.quantity}
                              step="any"
                              value={l.quantity}
                              onChange={(e) => setLines((ls) => ls.map((x) => (x.item.itemId === l.item.itemId ? { ...x, quantity: e.target.value } : x)))}
                              aria-label={`How many ${l.item.name} were used`}
                              className={smallInputClass}
                            />
                            <span className="shrink-0 text-xs text-muted-foreground">{l.item.unit}</span>
                          </div>
                        </td>
                        <td className="text-right tabular-nums">{l.item.isBillable ? formatCurrency((Number(l.quantity) || 0) * l.item.sellingPrice) : "—"}</td>
                        <td>
                          <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.item.itemId !== l.item.itemId))} className="rounded p-1 text-muted-foreground hover:text-red-600" aria-label={`Remove ${l.item.name}`}>
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Note (optional) - e.g. wound dressing" className="h-10 w-full rounded-lg border border-border bg-transparent px-3 text-sm" />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">{charge > 0 ? `${formatCurrency(charge)} goes on the bill` : "Nothing here is charged"}</span>
                  <button type="button" onClick={save} disabled={saving} className={primaryButton}>
                    <PackagePlus size={15} /> Record
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{visitId ? "Taken from stock this visit" : "Taken from stock"}</h3>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {records.map((r) => (
                <UsedRecord key={r.issueId} record={r} onChanged={loadRecords} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}
