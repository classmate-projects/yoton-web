"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Check, PackageCheck, Send, Trash2, Truck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import DatePicker from "@/components/DatePicker";
import SearchableSelect, { fieldSelectClass } from "@/components/SearchableSelect";
import { InventoryService } from "@/services/inventory.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency } from "@/lib/currency";
import type { InventoryItem, InventoryStore, Issue, Requisition, Transfer } from "@/types/inventory.type";
import ItemPicker from "./ItemPicker";
import LotSelect from "./LotSelect";
import { DocStatus, Facts, Field, Modal, ReasonPrompt, dangerButton, dateInputClass, day, inputClass, primaryButton, qty, secondaryButton, smallInputClass, stamp, todayInput, useInventory } from "./inventoryUi";

// Requisitions, transfers and issues - shared by the Inventory module (store team) and the
// Store Requests page (department staff, for their own department's stores).

interface QtyLine {
  key: string;
  item: InventoryItem;
  batchId: string;
  quantity: string;
  requisitionLineId?: string | null;
  outstanding?: number;
}

const removeLine = (lines: QtyLine[], key: string) => lines.filter((l) => l.key !== key);
const patchLine = (lines: QtyLine[], key: string, patch: Partial<QtyLine>) => lines.map((l) => (l.key === key ? { ...l, ...patch } : l));

// ================= REQUISITIONS =================

export function RequisitionForm({ requestingStore, onClose, onSaved }: { requestingStore?: InventoryStore | null; onClose: () => void; onSaved: (id: string) => void }) {
  const { myStores, stores } = useInventory();
  const requestable = myStores.filter((s) => s.supplyingStoreId);
  const [storeId, setStoreId] = useState(requestingStore?.storeId ?? requestable[0]?.storeId ?? "");
  const [priority, setPriority] = useState("Normal");
  const [requiredDate, setRequiredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<QtyLine[]>([]);
  const [saving, setSaving] = useState(false);
  const store = stores.find((s) => s.storeId === storeId);

  // Pre-fill what's below this store's own reorder levels.
  const fillFromLevels = async () => {
    if (!storeId) return;
    try {
      const res = await InventoryService.reorder(storeId);
      if (res.data.length === 0) return toast.info("Nothing in this store is below its reorder level");
      const items = await Promise.all(res.data.map((s) => InventoryService.item(s.itemId).then((r) => ({ item: r.data, suggested: s.suggestedQuantity }))));
      setLines(items.map(({ item, suggested }) => ({ key: item.itemId, item, batchId: "", quantity: String(suggested) })));
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't load the suggestions"));
    }
  };

  const save = async () => {
    if (!storeId) return toast.error("Choose the store asking for stock");
    if (lines.length === 0 || lines.some((l) => !(Number(l.quantity) > 0))) return toast.error("Enter a quantity for every item");
    setSaving(true);
    try {
      const res = await InventoryService.createRequisition({
        requestingStoreId: storeId,
        priority,
        requiredDate: requiredDate || null,
        notes: notes || null,
        lines: lines.map((l) => ({ itemId: l.item.itemId, quantity: Number(l.quantity) })),
      });
      toast.success(res.message ?? "Sent");
      onSaved(res.data.requisitionId);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't send the requisition"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Request stock"
      subtitle={store?.supplyingStoreName ? `${store.name} asks ${store.supplyingStoreName}` : "Ask the supplying store for items."}
      onClose={onClose}
      width="max-w-4xl"
      footer={
        <>
          <button type="button" onClick={fillFromLevels} className={`${secondaryButton} mr-auto`}>
            Fill from reorder levels
          </button>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving} className={primaryButton}>
            <Send size={15} /> {saving ? "Sending…" : "Send request"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="For store" required>
            <SearchableSelect value={storeId} onChange={setStoreId} options={requestable.map((s) => ({ value: s.storeId, label: s.name }))} className={fieldSelectClass} preserveCase placeholder="Choose…" />
          </Field>
          <Field label="Priority">
            <SearchableSelect value={priority} onChange={setPriority} options={[{ value: "Normal", label: "Normal" }, { value: "Urgent", label: "Urgent" }]} className={fieldSelectClass} preserveCase />
          </Field>
          <Field label="Needed by">
            <DatePicker value={requiredDate} onChange={setRequiredDate} min={todayInput()} className={dateInputClass} />
          </Field>
        </div>
        <ItemPicker onPick={(item) => (lines.some((l) => l.item.itemId === item.itemId) ? toast.info(`${item.name} is already listed`) : setLines((ls) => [...ls, { key: item.itemId, item, batchId: "", quantity: "" }]))} />
        {lines.length > 0 && (
          <table className="table-compact table-no-row-hover w-full text-sm">
            <thead>
              <tr>
                <th>Item</th>
                <th className="w-40">Quantity</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key}>
                  <td>{l.item.name}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} step="any" value={l.quantity} onChange={(e) => setLines((ls) => patchLine(ls, l.key, { quantity: e.target.value }))} className={smallInputClass} />
                      <span className="text-xs text-muted-foreground">{l.item.unit}</span>
                    </div>
                  </td>
                  <td>
                    <button type="button" onClick={() => setLines((ls) => removeLine(ls, l.key))} className="rounded p-1 text-muted-foreground hover:text-red-600" aria-label="Remove line">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} className="w-full text-sm" />
        </Field>
      </div>
    </Modal>
  );
}

export function RequisitionDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [req, setReq] = useState<Requisition | null>(null);
  const [prompt, setPrompt] = useState<"cancel" | "decline" | null>(null);
  const [sending, setSending] = useState(false);
  const load = useCallback(() => {
    InventoryService.requisition(id).then((r) => setReq(r.data)).catch((err) => toast.error(apiErrorMessage(err, "Couldn't load the requisition")));
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  useSignalRRefetch(["inventoryChanged"], load);
  if (!req) return null;
  const partly = req.lines.some((l) => l.issuedQuantity > 0);
  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          {req.number} <DocStatus status={req.status} />
          {req.priority === "Urgent" && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">Urgent</span>}
        </span>
      }
      subtitle={`${req.requestingStoreName} asks ${req.supplyingStoreName}`}
      onClose={onClose}
      width="max-w-4xl"
      footer={
        <>
          {req.canCancel && (
            <button type="button" onClick={() => setPrompt("cancel")} className={`${dangerButton} mr-auto`}>
              <Ban size={15} /> Cancel request
            </button>
          )}
          {req.canSupply && (
            <>
              <button type="button" onClick={() => setPrompt("decline")} className={secondaryButton}>
                <Ban size={15} /> {partly ? "Close the rest" : "Decline"}
              </button>
              <button type="button" onClick={() => setSending(true)} className={primaryButton}>
                <Truck size={15} /> Send stock
              </button>
            </>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Facts
          items={[
            { label: "Requested by", value: `${req.requestedByName ?? "—"} · ${stamp(req.createdAt)}` },
            { label: "Needed by", value: day(req.requiredDate) },
            ...(req.closedByName ? [{ label: req.status === "Rejected" ? "Declined by" : "Cancelled by", value: `${req.closedByName}${req.closeReason ? ` · ${req.closeReason}` : ""}` }] : []),
            { label: "Transfers", value: req.transfers.map((t) => t.number).join(", ") || "—" },
          ]}
        />
        <table className="table-compact w-full text-sm">
          <thead>
            <tr>
              <th>Item</th>
              <th className="text-right">Asked</th>
              <th className="text-right">Sent</th>
              <th className="text-right">Outstanding</th>
              {req.canSupply && <th className="text-right">In {req.supplyingStoreName}</th>}
            </tr>
          </thead>
          <tbody>
            {req.lines.map((l) => (
              <tr key={l.requisitionLineId}>
                <td>{l.itemName}</td>
                <td className="text-right tabular-nums">
                  {qty(l.requestedQuantity)} {l.unit}
                </td>
                <td className="text-right tabular-nums">{qty(l.issuedQuantity)}</td>
                <td className="text-right tabular-nums">{qty(l.outstanding)}</td>
                {req.canSupply && <td className={`text-right tabular-nums ${l.availableAtSupplier < l.outstanding ? "text-amber-600" : ""}`}>{qty(l.availableAtSupplier)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {req.notes && <p className="text-sm text-muted-foreground">Notes: {req.notes}</p>}
      </div>
      {prompt && (
        <ReasonPrompt
          title={prompt === "cancel" ? `Cancel ${req.number}` : partly ? `Close the rest of ${req.number}` : `Decline ${req.number}`}
          confirmLabel={prompt === "cancel" ? "Cancel request" : partly ? "Close" : "Decline"}
          required={prompt === "decline"}
          danger
          onClose={() => setPrompt(null)}
          onConfirm={async (reason) => {
            try {
              const res = prompt === "cancel" ? await InventoryService.cancelRequisition(req.requisitionId, reason) : await InventoryService.declineRequisition(req.requisitionId, reason);
              toast.success(res.message);
              setPrompt(null);
              load();
            } catch (err) {
              toast.error(apiErrorMessage(err, "That didn't work"));
            }
          }}
        />
      )}
      {sending && (
        <TransferForm
          requisition={req}
          onClose={() => setSending(false)}
          onSaved={() => {
            setSending(false);
            load();
          }}
        />
      )}
    </Modal>
  );
}

// ================= TRANSFERS =================

// Dispatch stock to another store - from a requisition (its outstanding lines), freely
// (store team), or as a department sending stock back to its supplying store (isReturn).
export function TransferForm({
  requisition,
  fromStore,
  isReturn = false,
  onClose,
  onSaved,
}: {
  requisition?: Requisition | null;
  fromStore?: InventoryStore | null;
  isReturn?: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { myStores, stores } = useInventory();
  const [fromId, setFromId] = useState(requisition?.supplyingStoreId ?? fromStore?.storeId ?? myStores[0]?.storeId ?? "");
  const from = stores.find((s) => s.storeId === fromId);
  const [toId, setToId] = useState(requisition?.requestingStoreId ?? (isReturn ? from?.supplyingStoreId ?? "" : ""));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<QtyLine[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!requisition) return;
    const open = requisition.lines.filter((l) => l.outstanding > 0);
    Promise.all(open.map((l) => InventoryService.item(l.itemId).then((r) => r.data))).then((items) =>
      setLines(
        open.map((l, i) => ({
          key: l.requisitionLineId,
          item: items[i],
          batchId: "",
          quantity: String(Math.min(l.outstanding, l.availableAtSupplier)),
          requisitionLineId: l.requisitionLineId,
          outstanding: l.outstanding,
        }))
      )
    ).catch(() => toast.error("Couldn't load the requested items"));
  }, [requisition]);

  useEffect(() => {
    if (isReturn && from?.supplyingStoreId) setToId(from.supplyingStoreId);
  }, [isReturn, from?.supplyingStoreId]);

  const save = async () => {
    const sending = lines.filter((l) => Number(l.quantity) > 0);
    if (!fromId || !toId) return toast.error("Choose both stores");
    if (sending.length === 0) return toast.error("Enter a quantity to send");
    setSaving(true);
    try {
      const res = await InventoryService.createTransfer({
        fromStoreId: fromId,
        toStoreId: toId,
        requisitionId: requisition?.requisitionId ?? null,
        isReturn,
        notes: notes || null,
        lines: sending.map((l) => ({ itemId: l.item.itemId, batchId: l.batchId || null, quantity: Number(l.quantity), requisitionLineId: l.requisitionLineId ?? null })),
      });
      toast.success(res.message ?? "Dispatched");
      onSaved(res.data.transferId);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't dispatch the transfer"));
    } finally {
      setSaving(false);
    }
  };

  const destinations = isReturn ? stores.filter((s) => s.storeId === from?.supplyingStoreId) : stores.filter((s) => s.isActive && s.storeId !== fromId);

  return (
    <Modal
      title={requisition ? `Send stock for ${requisition.number}` : isReturn ? "Return stock" : "Transfer stock"}
      subtitle="Stock leaves the sending store now and arrives when the other store confirms it. Batches are picked first-expiry-first unless you choose one."
      onClose={onClose}
      width="max-w-5xl"
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving} className={primaryButton}>
            <Truck size={15} /> {saving ? "Dispatching…" : "Dispatch"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="From store" required>
            <SearchableSelect value={fromId} onChange={(v) => { setFromId(v); if (!requisition) setLines([]); }} options={myStores.map((s) => ({ value: s.storeId, label: s.name }))} disabled={!!requisition} className={fieldSelectClass} preserveCase placeholder="Choose…" />
          </Field>
          <Field label="To store" required>
            <SearchableSelect value={toId} onChange={setToId} options={destinations.map((s) => ({ value: s.storeId, label: s.name }))} disabled={!!requisition || isReturn} className={fieldSelectClass} preserveCase placeholder="Choose…" />
          </Field>
        </div>
        {!requisition && fromId && <ItemPicker onPick={(item, batchId) => setLines((ls) => [...ls, { key: `${item.itemId}-${Date.now()}`, item, batchId: batchId ?? "", quantity: "" }])} />}
        {lines.length > 0 && (
          <table className="table-compact table-no-row-hover w-full text-sm">
            <thead>
              <tr>
                <th>Item</th>
                <th className="w-80">Batch</th>
                <th className="w-40">Quantity</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key}>
                  <td>
                    {l.item.name}
                    {l.outstanding != null && <span className="block text-xs text-muted-foreground">{qty(l.outstanding)} {l.item.unit} outstanding</span>}
                  </td>
                  <td>
                    <LotSelect storeId={fromId} itemId={l.item.itemId} value={l.batchId} includeExpired={isReturn} unit={l.item.unit} onChange={(v) => setLines((ls) => patchLine(ls, l.key, { batchId: v }))} />
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} step="any" value={l.quantity} onChange={(e) => setLines((ls) => patchLine(ls, l.key, { quantity: e.target.value }))} className={smallInputClass} />
                      <span className="text-xs text-muted-foreground">{l.item.unit}</span>
                    </div>
                  </td>
                  <td>
                    <button type="button" onClick={() => setLines((ls) => removeLine(ls, l.key))} className="rounded p-1 text-muted-foreground hover:text-red-600" aria-label="Remove line">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} className="w-full text-sm" />
        </Field>
      </div>
    </Modal>
  );
}

export function TransferDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const load = useCallback(() => {
    InventoryService.transfer(id).then((r) => setTransfer(r.data)).catch((err) => toast.error(apiErrorMessage(err, "Couldn't load the transfer")));
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  useSignalRRefetch(["inventoryChanged"], load);
  if (!transfer) return null;

  const receive = async () => {
    setBusy(true);
    try {
      const res = await InventoryService.receiveTransfer(transfer.transferId);
      toast.success(res.message);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't receive the transfer"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          {transfer.number} <DocStatus status={transfer.status} />
          {transfer.isReturn && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Return</span>}
        </span>
      }
      subtitle={`${transfer.fromStoreName} → ${transfer.toStoreName}${transfer.requisitionNumber ? ` · for ${transfer.requisitionNumber}` : ""}`}
      onClose={onClose}
      width="max-w-4xl"
      footer={
        <>
          {transfer.canCancel && (
            <button type="button" onClick={() => setCancelling(true)} className={`${dangerButton} mr-auto`}>
              <Undo2 size={15} /> Call back
            </button>
          )}
          {transfer.canReceive && (
            <button type="button" onClick={receive} disabled={busy} className={primaryButton}>
              <PackageCheck size={15} /> Confirm received
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Facts
          items={[
            { label: "Dispatched", value: `${transfer.dispatchedByName ?? "—"} · ${stamp(transfer.dispatchedAt)}` },
            { label: transfer.status === "Cancelled" ? "Called back" : "Received", value: transfer.completedByName ? `${transfer.completedByName} · ${stamp(transfer.completedAt)}` : "—" },
            { label: "Value", value: formatCurrency(transfer.total) },
            { label: "Reason", value: transfer.cancelReason ?? transfer.notes ?? "—" },
          ]}
        />
        <table className="table-compact w-full text-sm">
          <thead>
            <tr>
              <th>Item</th>
              <th>Batch</th>
              <th>Expiry</th>
              <th className="text-right">Quantity</th>
              <th className="text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {transfer.lines.map((l) => (
              <tr key={l.transferLineId}>
                <td>{l.itemName}</td>
                <td>{l.batchNumber ?? "—"}</td>
                <td>{day(l.expiryDate)}</td>
                <td className="text-right tabular-nums">
                  {qty(l.quantity)} {l.unit}
                </td>
                <td className="text-right tabular-nums">{formatCurrency(l.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cancelling && (
        <ReasonPrompt
          title={`Call back ${transfer.number}`}
          description="The stock goes back into the sending store."
          confirmLabel="Call back"
          danger
          onClose={() => setCancelling(false)}
          onConfirm={async (reason) => {
            try {
              const res = await InventoryService.cancelTransfer(transfer.transferId, reason);
              toast.success(res.message);
              setCancelling(false);
              load();
            } catch (err) {
              toast.error(apiErrorMessage(err, "Couldn't call it back"));
            }
          }}
        />
      )}
    </Modal>
  );
}

// ================= ISSUES =================

export function IssueForm({ store, onClose, onSaved }: { store?: InventoryStore | null; onClose: () => void; onSaved: (id: string) => void }) {
  const { myStores, stores, lookups } = useInventory();
  const [storeId, setStoreId] = useState(store?.storeId ?? myStores[0]?.storeId ?? "");
  const current = stores.find((s) => s.storeId === storeId);
  const [departmentId, setDepartmentId] = useState(current?.departmentId ?? "");
  const [issuedTo, setIssuedTo] = useState("");
  const [purpose, setPurpose] = useState("");
  const [lines, setLines] = useState<QtyLine[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDepartmentId(current?.departmentId ?? "");
  }, [current?.departmentId]);

  const save = async () => {
    if (!storeId) return toast.error("Choose the store");
    if (lines.length === 0 || lines.some((l) => !(Number(l.quantity) > 0))) return toast.error("Enter a quantity for every item");
    setSaving(true);
    try {
      const res = await InventoryService.createIssue({
        storeId,
        departmentId: departmentId || null,
        issuedTo: issuedTo || null,
        purpose: purpose || null,
        lines: lines.map((l) => ({ itemId: l.item.itemId, batchId: l.batchId || null, quantity: Number(l.quantity) })),
      });
      toast.success(res.message ?? "Issued");
      onSaved(res.data.issueId);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't issue the stock"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Issue stock for use"
      subtitle="Stock used up by a department (consumption). Batches are picked first-expiry-first unless you choose one; unused stock can be returned later."
      onClose={onClose}
      width="max-w-5xl"
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving} className={primaryButton}>
            <Check size={15} /> {saving ? "Issuing…" : "Issue"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="From store" required>
            <SearchableSelect value={storeId} onChange={(v) => { setStoreId(v); setLines([]); }} options={myStores.map((s) => ({ value: s.storeId, label: s.name }))} className={fieldSelectClass} preserveCase placeholder="Choose…" />
          </Field>
          <Field label="For department">
            <SearchableSelect value={departmentId} onChange={setDepartmentId} options={[{ value: "", label: "Not specified" }, ...(lookups?.departments ?? []).map((d) => ({ value: d.departmentId, label: d.name }))]} className={fieldSelectClass} preserveCase />
          </Field>
          <Field label="Handed to">
            <input value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)} maxLength={200} placeholder="Name" className={inputClass} />
          </Field>
          <Field label="Purpose">
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={500} placeholder="e.g. Ward daily use" className={inputClass} />
          </Field>
        </div>
        {storeId && <ItemPicker onPick={(item, batchId) => setLines((ls) => [...ls, { key: `${item.itemId}-${Date.now()}`, item, batchId: batchId ?? "", quantity: "" }])} />}
        {lines.length > 0 && (
          <table className="table-compact table-no-row-hover w-full text-sm">
            <thead>
              <tr>
                <th>Item</th>
                <th className="w-80">Batch</th>
                <th className="w-40">Quantity</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key}>
                  <td>{l.item.name}</td>
                  <td>
                    <LotSelect storeId={storeId} itemId={l.item.itemId} value={l.batchId} unit={l.item.unit} onChange={(v) => setLines((ls) => patchLine(ls, l.key, { batchId: v }))} />
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} step="any" value={l.quantity} onChange={(e) => setLines((ls) => patchLine(ls, l.key, { quantity: e.target.value }))} className={smallInputClass} />
                      <span className="text-xs text-muted-foreground">{l.item.unit}</span>
                    </div>
                  </td>
                  <td>
                    <button type="button" onClick={() => setLines((ls) => removeLine(ls, l.key))} className="rounded p-1 text-muted-foreground hover:text-red-600" aria-label="Remove line">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  );
}

export function IssueDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [returning, setReturning] = useState(false);
  const [returnQty, setReturnQty] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    InventoryService.issue(id).then((r) => setIssue(r.data)).catch((err) => toast.error(apiErrorMessage(err, "Couldn't load the issue")));
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  if (!issue) return null;
  // A return would change a patient's bill while one depends on it - Billing removes the line first.
  const canReturn = issue.lines.some((l) => l.quantity > l.returnedQuantity) && !issue.billId;

  const saveReturn = async () => {
    const lines = Object.entries(returnQty)
      .map(([issueLineId, v]) => ({ issueLineId, quantity: Number(v) || 0 }))
      .filter((l) => l.quantity > 0);
    if (lines.length === 0) return toast.error("Enter the quantity coming back");
    setBusy(true);
    try {
      const res = await InventoryService.returnIssue(issue.issueId, lines);
      toast.success(res.message ?? "Recorded");
      setReturning(false);
      setReturnQty({});
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't record the return"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={issue.number}
      subtitle={
        issue.patientName
          ? `${issue.storeName} → ${issue.patientName} · ${issue.sourceLabel}`
          : `${issue.storeName} → ${issue.departmentName ?? "use"}${issue.issuedTo ? ` (${issue.issuedTo})` : ""}`
      }
      onClose={onClose}
      width="max-w-4xl"
      footer={
        canReturn &&
        (returning ? (
          <>
            <button type="button" onClick={() => setReturning(false)} className={secondaryButton}>
              Cancel
            </button>
            <button type="button" onClick={saveReturn} disabled={busy} className={primaryButton}>
              <Undo2 size={15} /> Record return
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setReturning(true)} className={secondaryButton}>
            <Undo2 size={15} /> Return unused stock
          </button>
        ))
      }
    >
      <div className="flex flex-col gap-4">
        <Facts items={[{ label: "Issued by", value: issue.issuedByName }, { label: "When", value: stamp(issue.createdAt) }, { label: "Value (net)", value: formatCurrency(issue.total) }, { label: "Purpose", value: issue.purpose ?? "—" }]} />
        {issue.billId && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            On bill {issue.billId} ({issue.billStatus}) - nothing can come back until Billing removes it from the bill.
          </p>
        )}
        <table className="table-compact table-no-row-hover w-full text-sm">
          <thead>
            <tr>
              <th>Item</th>
              <th>Batch</th>
              <th className="text-right">Issued</th>
              <th className="text-right">Returned</th>
              {issue.patientId && issue.lines.some((l) => l.isBillable) && <th className="text-right">Charged</th>}
              {returning && <th className="w-32">Coming back</th>}
            </tr>
          </thead>
          <tbody>
            {issue.lines.map((l) => (
              <tr key={l.issueLineId}>
                <td>{l.itemName}</td>
                <td>{l.batchNumber ?? "—"}</td>
                <td className="text-right tabular-nums">
                  {qty(l.quantity)} {l.unit}
                </td>
                <td className="text-right tabular-nums">{l.returnedQuantity ? qty(l.returnedQuantity) : "—"}</td>
                {issue.patientId && issue.lines.some((x) => x.isBillable) && (
                  <td className="text-right tabular-nums">{l.isBillable ? formatCurrency((l.quantity - l.returnedQuantity) * l.unitPrice) : "—"}</td>
                )}
                {returning && (
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={l.quantity - l.returnedQuantity}
                      step="any"
                      disabled={l.quantity <= l.returnedQuantity}
                      value={returnQty[l.issueLineId] ?? ""}
                      onChange={(e) => setReturnQty((m) => ({ ...m, [l.issueLineId]: e.target.value }))}
                      className={smallInputClass}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
