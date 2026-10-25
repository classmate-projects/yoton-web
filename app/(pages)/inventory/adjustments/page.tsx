"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Ban, Check, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import DatePicker from "@/components/DatePicker";
import SearchableSelect, { fieldSelectClass, standaloneSelectClass } from "@/components/SearchableSelect";
import { InventoryService } from "@/services/inventory.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency } from "@/lib/currency";
import { getUserDetail } from "@/lib/userDetail";
import type { Adjustment, AdjustmentKind, AdjustmentSummary, InventoryItem } from "@/types/inventory.type";
import ItemPicker from "@/components/inventory/ItemPicker";
import LotSelect from "@/components/inventory/LotSelect";
import { DocStatus, Facts, Field, Modal, PageBar, Pager, ReasonPrompt, dangerButton, day, inputClass, primaryButton, qty, secondaryButton, smallDateInputClass, smallInputClass, stamp, useInventory } from "@/components/inventory/inventoryUi";

const KIND_LABELS: Record<AdjustmentKind, string> = { Opening: "Opening stock", Adjustment: "Adjustment", WriteOff: "Write-off" };
const REASONS: Record<AdjustmentKind, string[]> = {
  Opening: ["Opening balance"],
  Adjustment: ["Found", "Lost / missing", "Data correction", "Damaged", "Other"],
  WriteOff: ["Expired", "Damaged", "Recalled", "Contaminated", "Other"],
};

interface Line {
  key: string;
  item: InventoryItem;
  direction: "in" | "out";
  batchId: string;
  quantity: string;
  batchNumber: string;
  expiryDate: string;
  unitCost: string;
}

function AdjustmentForm({ kind, onClose, onSaved }: { kind: AdjustmentKind; onClose: () => void; onSaved: (id: string) => void }) {
  const { myStores } = useInventory();
  const [storeId, setStoreId] = useState(myStores[0]?.storeId ?? "");
  const [reason, setReason] = useState(REASONS[kind][0]);
  const [disposalMethod, setDisposalMethod] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);
  const patch = (key: string, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));

  const addItem = (item: InventoryItem, batchId?: string | null) =>
    setLines((ls) => [
      ...ls,
      {
        key: `${item.itemId}-${Date.now()}`,
        item,
        direction: kind === "WriteOff" ? "out" : "in",
        batchId: kind === "Opening" ? "" : batchId ?? "",
        quantity: "",
        batchNumber: "",
        expiryDate: "",
        unitCost: item.lastPurchaseCost ? String(item.lastPurchaseCost) : "",
      },
    ]);

  const save = async () => {
    if (!storeId) return toast.error("Choose the store");
    if (lines.length === 0) return toast.error("Add at least one line");
    setSaving(true);
    try {
      const res = await InventoryService.createAdjustment({
        storeId,
        kind,
        reason,
        disposalMethod: disposalMethod || null,
        witnessName: witnessName || null,
        notes: notes || null,
        lines: lines.map((l) => {
          const q = Number(l.quantity) || 0;
          const newLot = l.direction === "in" && !l.batchId;
          return {
            itemId: l.item.itemId,
            batchId: l.batchId || null,
            quantityChange: l.direction === "out" ? -q : q,
            batchNumber: newLot ? l.batchNumber || null : null,
            expiryDate: newLot ? l.expiryDate || null : null,
            unitCost: newLot && l.unitCost !== "" ? Number(l.unitCost) : null,
          };
        }),
      });
      toast.success(res.message ?? "Sent for approval");
      onSaved(res.data.adjustmentId);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't save"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`New ${KIND_LABELS[kind].toLowerCase()}`}
      subtitle={
        kind === "Opening"
          ? "Stock already on the shelves when the store starts using the system - each line starts a batch."
          : kind === "WriteOff"
            ? "Expired or damaged stock taken out and disposed of. Takes effect once approved."
            : "A correction to the store's stock. Takes effect once approved."
      }
      onClose={onClose}
      width="max-w-6xl"
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving} className={primaryButton}>
            <Send size={15} /> {saving ? "Saving…" : "Send for approval"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Store" required>
            <SearchableSelect value={storeId} onChange={(v) => { setStoreId(v); setLines([]); }} options={myStores.map((s) => ({ value: s.storeId, label: s.name }))} className={fieldSelectClass} preserveCase />
          </Field>
          <Field label="Reason" required>
            <SearchableSelect value={reason} onChange={setReason} options={REASONS[kind].map((r) => ({ value: r, label: r }))} className={fieldSelectClass} preserveCase />
          </Field>
          {kind === "WriteOff" && (
            <>
              <Field label="Disposal method">
                <input value={disposalMethod} onChange={(e) => setDisposalMethod(e.target.value)} maxLength={200} placeholder="e.g. Incineration" className={inputClass} />
              </Field>
              <Field label="Witness">
                <input value={witnessName} onChange={(e) => setWitnessName(e.target.value)} maxLength={200} className={inputClass} />
              </Field>
            </>
          )}
        </div>
        {storeId && <ItemPicker onPick={addItem} includeMedicines={kind === "Opening"} />}
        {lines.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table-compact table-no-row-hover w-full text-sm">
              <thead>
                <tr>
                  <th>Item</th>
                  {kind === "Adjustment" && <th className="w-28">Change</th>}
                  <th className="w-72">Batch</th>
                  <th className="w-28">Quantity</th>
                  <th className="w-32">New batch no.</th>
                  <th className="w-40">Expiry</th>
                  <th className="w-28">Unit cost</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const newLot = l.direction === "in" && !l.batchId;
                  return (
                    <tr key={l.key}>
                      <td>
                        {l.item.name}
                        <span className="block text-xs text-muted-foreground">{l.item.unit}</span>
                      </td>
                      {kind === "Adjustment" && (
                        <td>
                          <SearchableSelect value={l.direction} onChange={(v) => patch(l.key, { direction: v as Line["direction"], batchId: "" })} options={[{ value: "in", label: "Add (+)" }, { value: "out", label: "Remove (−)" }]} className={fieldSelectClass} preserveCase />
                        </td>
                      )}
                      <td>
                        {kind === "Opening" ? (
                          <span className="text-xs text-muted-foreground">New batch</span>
                        ) : l.direction === "out" ? (
                          <LotSelect storeId={storeId} itemId={l.item.itemId} value={l.batchId} allowAuto={false} includeExpired unit={l.item.unit} onChange={(v) => patch(l.key, { batchId: v })} />
                        ) : (
                          <LotSelect storeId={storeId} itemId={l.item.itemId} value={l.batchId} includeExpired unit={l.item.unit} onChange={(v) => patch(l.key, { batchId: v })} />
                        )}
                      </td>
                      <td>
                        <input type="number" min={0} step="any" value={l.quantity} onChange={(e) => patch(l.key, { quantity: e.target.value })} className={smallInputClass} />
                      </td>
                      <td>{newLot && <input value={l.batchNumber} onChange={(e) => patch(l.key, { batchNumber: e.target.value })} maxLength={60} placeholder={l.item.trackBatch ? "Required" : "Optional"} className={smallInputClass} />}</td>
                      <td>{newLot && <DatePicker value={l.expiryDate} onChange={(v) => patch(l.key, { expiryDate: v })} placeholder={l.item.trackExpiry ? "Required" : "Optional"} className={smallDateInputClass} />}</td>
                      <td>{newLot && <input type="number" min={0} step="any" value={l.unitCost} onChange={(e) => patch(l.key, { unitCost: e.target.value })} className={smallInputClass} />}</td>
                      <td>
                        <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="rounded p-1 text-muted-foreground hover:text-red-600" aria-label="Remove line">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {kind === "Adjustment" && <p className="mt-1 text-xs text-muted-foreground">Adding stock without choosing a batch starts a new one - enter its batch, expiry and cost.</p>}
          </div>
        )}
        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} className="w-full text-sm" />
        </Field>
      </div>
    </Modal>
  );
}

function AdjustmentDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [adj, setAdj] = useState<Adjustment | null>(null);
  const [prompt, setPrompt] = useState<"decline" | "cancel" | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    InventoryService.adjustment(id).then((r) => setAdj(r.data)).catch((err) => toast.error(apiErrorMessage(err, "Couldn't load it")));
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  useSignalRRefetch(["inventoryChanged"], load);
  if (!adj) return null;
  const pending = adj.status === "PendingApproval";
  const mine = adj.createdByUserId === getUserDetail()?.userId;

  const approve = async () => {
    setBusy(true);
    try {
      const res = await InventoryService.approveAdjustment(adj.adjustmentId);
      toast.success(res.message);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't approve it"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          {adj.number} <DocStatus status={adj.status} />
        </span>
      }
      subtitle={`${KIND_LABELS[adj.kind]} · ${adj.storeName} · ${adj.reason}`}
      onClose={onClose}
      width="max-w-5xl"
      footer={
        pending && (
          <>
            {(mine || adj.canApprove) && (
              <button type="button" onClick={() => setPrompt("cancel")} className={`${secondaryButton} mr-auto`}>
                <Ban size={15} /> Cancel
              </button>
            )}
            {adj.canApprove ? (
              <>
                <button type="button" onClick={() => setPrompt("decline")} className={dangerButton}>
                  <Ban size={15} /> Decline
                </button>
                <button type="button" onClick={approve} disabled={busy} className={primaryButton}>
                  <Check size={15} /> Approve and post
                </button>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Waiting for an admin or the store&apos;s manager</span>
            )}
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <Facts
          items={[
            { label: "Raised by", value: `${adj.createdByName ?? "—"} · ${stamp(adj.createdAt)}` },
            { label: "Value change", value: formatCurrency(adj.total) },
            { label: adj.status === "Posted" ? "Approved by" : "Decided by", value: adj.decidedByName ? `${adj.decidedByName} · ${stamp(adj.decidedAt)}` : "—" },
            { label: "Decision note", value: adj.decisionReason ?? "—" },
          ]}
        />
        {adj.kind === "WriteOff" && (adj.disposalMethod || adj.witnessName) && (
          <p className="text-sm text-muted-foreground">
            Disposal: {adj.disposalMethod ?? "—"} · Witness: {adj.witnessName ?? "—"}
          </p>
        )}
        <table className="table-compact w-full text-sm">
          <thead>
            <tr>
              <th>Item</th>
              <th>Batch</th>
              <th>Expiry</th>
              <th className="text-right">Change</th>
              <th className="text-right">Unit cost</th>
              <th className="text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {adj.lines.map((l) => (
              <tr key={l.adjustmentLineId}>
                <td>{l.itemName}</td>
                <td>{l.batchNumber ?? (l.batchId ? "—" : "New batch")}</td>
                <td>{day(l.expiryDate)}</td>
                <td className={`text-right tabular-nums font-semibold ${l.quantityChange < 0 ? "text-red-600" : "text-green-600"}`}>
                  {l.quantityChange > 0 ? "+" : ""}
                  {qty(l.quantityChange)} {l.unit}
                </td>
                <td className="text-right tabular-nums">{formatCurrency(l.unitCost)}</td>
                <td className="text-right tabular-nums">{formatCurrency(l.lineValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {adj.notes && <p className="text-sm text-muted-foreground">Notes: {adj.notes}</p>}
      </div>
      {prompt && (
        <ReasonPrompt
          title={prompt === "decline" ? `Decline ${adj.number}` : `Cancel ${adj.number}`}
          confirmLabel={prompt === "decline" ? "Decline" : "Cancel it"}
          required={prompt === "decline"}
          danger
          onClose={() => setPrompt(null)}
          onConfirm={async (reason) => {
            try {
              const res = prompt === "decline" ? await InventoryService.declineAdjustment(adj.adjustmentId, reason) : await InventoryService.cancelAdjustment(adj.adjustmentId, reason);
              toast.success(res.message);
              setPrompt(null);
              load();
            } catch (err) {
              toast.error(apiErrorMessage(err, "That didn't work"));
            }
          }}
        />
      )}
    </Modal>
  );
}

function AdjustmentsInner() {
  const params = useSearchParams();
  const { lookups } = useInventory();
  const [rows, setRows] = useState<AdjustmentSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(params.get("open"));
  const [creating, setCreating] = useState<AdjustmentKind | null>(null);

  const load = useCallback(() => {
    InventoryService.adjustments({ status: status || undefined, kind: kind || undefined, page })
      .then((r) => {
        setRows(r.data);
        setTotal(r.total);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [status, kind, page]);
  useEffect(() => {
    load();
  }, [load]);
  useSignalRRefetch(["inventoryChanged"], load);

  if (lookups && !lookups.isStoreTeam) return <EmptyState illustration="clipboard" title="Adjustments are handled by the store team" />;

  return (
    <div className="flex flex-col gap-4">
      <PageBar title="Adjustments" description="Opening stock, corrections and write-offs - each takes effect when an admin or the store's manager approves it.">
        <button type="button" onClick={() => setCreating("Opening")} className={secondaryButton}>
          <Plus size={15} /> Opening stock
        </button>
        <button type="button" onClick={() => setCreating("Adjustment")} className={secondaryButton}>
          <Plus size={15} /> Adjustment
        </button>
        <button type="button" onClick={() => setCreating("WriteOff")} className={primaryButton}>
          <Plus size={15} /> Write-off
        </button>
      </PageBar>
      <div className="flex flex-wrap gap-2">
        <div className="w-56">
          <SearchableSelect value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: "", label: "All statuses" }, { value: "PendingApproval", label: "Waiting approval" }, { value: "Posted", label: "Posted" }, { value: "Rejected", label: "Declined" }, { value: "Cancelled", label: "Cancelled" }]} className={standaloneSelectClass} preserveCase />
        </div>
        <div className="w-48">
          <SearchableSelect value={kind} onChange={(v) => { setKind(v); setPage(1); }} options={[{ value: "", label: "All kinds" }, ...Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }))]} className={standaloneSelectClass} preserveCase />
        </div>
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState illustration="clipboard" title="No adjustments" />
      ) : (
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Number</th>
                <th>Kind</th>
                <th>Store</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Raised</th>
                <th className="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.adjustmentId} className="cursor-pointer" onClick={() => setOpenId(a.adjustmentId)}>
                  <td className="font-medium text-foreground">{a.number}</td>
                  <td>{KIND_LABELS[a.kind]}</td>
                  <td>{a.storeName}</td>
                  <td>{a.reason}</td>
                  <td>
                    <DocStatus status={a.status} />
                  </td>
                  <td>
                    {a.createdByName}
                    <span className="block text-xs text-muted-foreground">{stamp(a.createdAt)}</span>
                  </td>
                  <td className={`text-right tabular-nums ${a.total < 0 ? "text-red-600" : ""}`}>{formatCurrency(a.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pageSize={50} total={total} onPage={setPage} />
      {openId && <AdjustmentDetail id={openId} onClose={() => setOpenId(null)} />}
      {creating && (
        <AdjustmentForm
          kind={creating}
          onClose={() => setCreating(null)}
          onSaved={(id) => {
            setCreating(null);
            setOpenId(id);
            load();
          }}
        />
      )}
    </div>
  );
}

export default function AdjustmentsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <AdjustmentsInner />
    </Suspense>
  );
}
