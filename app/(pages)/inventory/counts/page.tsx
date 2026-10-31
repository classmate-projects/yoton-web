"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Ban, Check, ClipboardCheck, CornerUpLeft, Plus, Printer, Save, Send } from "lucide-react";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import SearchableSelect, { fieldSelectClass, standaloneSelectClass } from "@/components/SearchableSelect";
import { InventoryService } from "@/services/inventory.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency } from "@/lib/currency";
import type { StockCount, StockCountSummary } from "@/types/inventory.type";
import { DocStatus, Facts, Field, Modal, PageBar, Pager, ReasonPrompt, dangerButton, day, primaryButton, qty, secondaryButton, smallInputClass, stamp, useInventory } from "@/components/inventory/inventoryUi";

function StartCount({ onClose, onStarted }: { onClose: () => void; onStarted: (id: string) => void }) {
  const { myStores, lookups } = useInventory();
  const [storeId, setStoreId] = useState(myStores[0]?.storeId ?? "");
  const [itemType, setItemType] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    try {
      const res = await InventoryService.createCount({ storeId, itemType: itemType || null, category: category || null, notes: notes || null });
      toast.success(res.message ?? "Started");
      onStarted(res.data.stockCountId);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't start the count"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Start a stock count"
      subtitle="The sheet lists every batch the store holds now; enter what's actually on the shelf."
      onClose={onClose}
      width="max-w-xl"
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={start} disabled={busy || !storeId} className={primaryButton}>
            <ClipboardCheck size={15} /> Start count
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3">
        <Field label="Store" required>
          <SearchableSelect value={storeId} onChange={setStoreId} options={myStores.map((s) => ({ value: s.storeId, label: s.name }))} className={fieldSelectClass} preserveCase />
        </Field>
        <Field label="Only this item type">
          <SearchableSelect value={itemType} onChange={setItemType} options={[{ value: "", label: "Everything" }, ...(lookups?.itemTypes ?? []).map((t) => ({ value: t, label: t }))]} className={fieldSelectClass} preserveCase />
        </Field>
        <Field label="Only this category">
          <SearchableSelect value={category} onChange={setCategory} options={[{ value: "", label: "Every category" }, ...(lookups?.categories ?? []).map((c) => ({ value: c, label: c }))]} className={fieldSelectClass} preserveCase />
        </Field>
        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} className="w-full text-sm" />
        </Field>
      </div>
    </Modal>
  );
}

function CountSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const [count, setCount] = useState<StockCount | null>(null);
  const [entries, setEntries] = useState<Record<string, { counted: string; remarks: string }>>({});
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<"sendBack" | "cancel" | null>(null);

  const load = useCallback(() => {
    InventoryService.count(id)
      .then((r) => {
        setCount(r.data);
        setEntries(Object.fromEntries(r.data.lines.map((l) => [l.stockCountLineId, { counted: l.countedQuantity == null ? "" : String(l.countedQuantity), remarks: l.remarks ?? "" }])));
      })
      .catch((err) => toast.error(apiErrorMessage(err, "Couldn't load the count")));
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  if (!count) return null;
  const editable = count.status === "InProgress";
  const counted = count.lines.filter((l) => (entries[l.stockCountLineId]?.counted ?? "") !== "").length;

  const save = async (then?: () => Promise<{ message: string }>) => {
    setBusy(true);
    try {
      await InventoryService.saveCountLines(
        count.stockCountId,
        count.lines.map((l) => ({
          stockCountLineId: l.stockCountLineId,
          countedQuantity: entries[l.stockCountLineId]?.counted === "" ? null : Number(entries[l.stockCountLineId]?.counted),
          remarks: entries[l.stockCountLineId]?.remarks || null,
        }))
      );
      if (then) toast.success((await then()).message);
      else toast.success("Counts saved");
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't save the counts"));
    } finally {
      setBusy(false);
    }
  };

  const act = async (action: () => Promise<{ message: string }>) => {
    setBusy(true);
    try {
      toast.success((await action()).message);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "That didn't work"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          {count.number} <DocStatus status={count.status} />
        </span>
      }
      subtitle={`${count.storeName}${count.itemTypeFilter ? ` · ${count.itemTypeFilter}` : ""}${count.categoryFilter ? ` · ${count.categoryFilter}` : ""} · ${counted}/${count.lines.length} counted`}
      onClose={onClose}
      width="max-w-6xl"
      footer={
        <>
          <button type="button" onClick={() => window.print()} className={`${secondaryButton} mr-auto`}>
            <Printer size={15} /> Print blank sheet
          </button>
          {(editable || count.status === "PendingApproval") && (
            <button type="button" onClick={() => setPrompt("cancel")} className={dangerButton}>
              <Ban size={15} /> Cancel count
            </button>
          )}
          {editable && (
            <>
              <button type="button" onClick={() => save()} disabled={busy} className={secondaryButton}>
                <Save size={15} /> Save counts
              </button>
              <button type="button" onClick={() => save(() => InventoryService.submitCount(count.stockCountId))} disabled={busy} className={primaryButton}>
                <Send size={15} /> Submit for approval
              </button>
            </>
          )}
          {count.status === "PendingApproval" &&
            (count.canApprove ? (
              <>
                <button type="button" onClick={() => setPrompt("sendBack")} className={secondaryButton}>
                  <CornerUpLeft size={15} /> Send back
                </button>
                <button type="button" onClick={() => act(() => InventoryService.approveCount(count.stockCountId))} disabled={busy} className={primaryButton}>
                  <Check size={15} /> Approve and post differences
                </button>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Waiting for an admin or the store&apos;s manager</span>
            ))}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {count.decisionReason && count.status === "InProgress" && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">Sent back: {count.decisionReason}</p>
        )}
        <Facts
          items={[
            { label: "Started", value: `${count.createdByName ?? "—"} · ${stamp(count.createdAt)}` },
            { label: "Submitted", value: stamp(count.submittedAt) },
            { label: count.status === "Posted" ? "Approved" : "Decided", value: count.decidedByName ? `${count.decidedByName} · ${stamp(count.decidedAt)}` : "—" },
            { label: "Posted difference", value: count.status === "Posted" ? formatCurrency(count.varianceValue) : "—" },
          ]}
        />
        <div className="overflow-x-auto">
          <table className="table-compact table-no-row-hover w-full text-sm">
            <thead>
              <tr>
                <th>Item</th>
                <th>Batch</th>
                <th>Expiry</th>
                <th className="text-right">System now</th>
                <th className="w-32">Counted</th>
                <th className="text-right">Difference</th>
                <th className="w-56">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {count.lines.map((l) => {
                const entry = entries[l.stockCountLineId] ?? { counted: "", remarks: "" };
                const posted = count.status === "Posted";
                const diff = posted ? l.variance : entry.counted === "" ? null : Number(entry.counted) - l.currentQuantity;
                return (
                  <tr key={l.stockCountLineId}>
                    <td>
                      {l.itemName}
                      <span className="block text-xs text-muted-foreground">{l.unit}</span>
                    </td>
                    <td>{l.batchNumber ?? "—"}</td>
                    <td>{day(l.expiryDate)}</td>
                    <td className="text-right tabular-nums">
                      {qty(posted ? l.systemQuantity : l.currentQuantity)}
                      {!posted && l.currentQuantity !== l.systemQuantity && <span className="block text-xs text-muted-foreground">was {qty(l.systemQuantity)} at start</span>}
                    </td>
                    <td>
                      {editable ? (
                        <input type="number" min={0} step="any" value={entry.counted} onChange={(e) => setEntries((m) => ({ ...m, [l.stockCountLineId]: { ...entry, counted: e.target.value } }))} className={smallInputClass} />
                      ) : (
                        <span className="tabular-nums">{qty(l.countedQuantity)}</span>
                      )}
                    </td>
                    <td className={`text-right tabular-nums font-semibold ${diff == null || diff === 0 ? "" : diff < 0 ? "text-red-600" : "text-green-600"}`}>
                      {diff == null ? "—" : `${diff > 0 ? "+" : ""}${qty(diff)}`}
                    </td>
                    <td>
                      {editable ? (
                        <input value={entry.remarks} onChange={(e) => setEntries((m) => ({ ...m, [l.stockCountLineId]: { ...entry, remarks: e.target.value } }))} maxLength={300} className={smallInputClass} />
                      ) : (
                        l.remarks ?? ""
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printed sheet for the counters - no system quantities (a blind count). */}
      <div className="count-print-only bg-white p-6 text-black">
        <p className="text-lg font-bold">
          Stock count {count.number} - {count.storeName}
        </p>
        <p className="mb-3 text-sm">Counted by: ____________________ Date: ______________</p>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-1">Item</th>
              <th className="py-1">Batch</th>
              <th className="py-1">Expiry</th>
              <th className="py-1">Unit</th>
              <th className="py-1">Counted</th>
            </tr>
          </thead>
          <tbody>
            {count.lines.map((l) => (
              <tr key={`p-${l.stockCountLineId}`} className="border-b border-gray-300">
                <td className="py-1.5">{l.itemName}</td>
                <td className="py-1.5">{l.batchNumber ?? "—"}</td>
                <td className="py-1.5">{day(l.expiryDate)}</td>
                <td className="py-1.5">{l.unit}</td>
                <td className="py-1.5">__________</td>
              </tr>
            ))}
          </tbody>
        </table>
        <style jsx global>{`
          .count-print-only {
            display: none;
          }
          @media print {
            body * {
              visibility: hidden;
            }
            .count-print-only,
            .count-print-only * {
              visibility: visible;
            }
            .count-print-only {
              display: block;
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
            }
          }
        `}</style>
      </div>

      {prompt && (
        <ReasonPrompt
          title={prompt === "sendBack" ? "Send back for recounting" : `Cancel ${count.number}`}
          confirmLabel={prompt === "sendBack" ? "Send back" : "Cancel count"}
          required={prompt === "sendBack"}
          danger={prompt === "cancel"}
          onClose={() => setPrompt(null)}
          onConfirm={async (reason) => {
            await act(() => (prompt === "sendBack" ? InventoryService.sendBackCount(count.stockCountId, reason) : InventoryService.cancelCount(count.stockCountId, reason)));
            setPrompt(null);
          }}
        />
      )}
    </Modal>
  );
}

function CountsInner() {
  const params = useSearchParams();
  const { lookups } = useInventory();
  const [rows, setRows] = useState<StockCountSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(params.get("open"));
  const [starting, setStarting] = useState(false);

  const load = useCallback(() => {
    InventoryService.counts({ status: status || undefined, page })
      .then((r) => {
        setRows(r.data);
        setTotal(r.total);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [status, page]);
  useEffect(() => {
    load();
  }, [load]);
  useSignalRRefetch(["inventoryChanged"], load);

  if (lookups && !lookups.isStoreTeam) return <EmptyState illustration="clipboard" title="Stock counts are handled by the store team" />;

  return (
    <div className="flex flex-col gap-4">
      <PageBar title="Stock counts" description="Physical stock verification - count the shelves, then post the differences once approved.">
        <button type="button" onClick={() => setStarting(true)} className={primaryButton}>
          <Plus size={15} /> Start a count
        </button>
      </PageBar>
      <div className="w-56">
        <SearchableSelect value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: "", label: "All counts" }, { value: "InProgress", label: "Counting" }, { value: "PendingApproval", label: "Waiting approval" }, { value: "Posted", label: "Posted" }, { value: "Cancelled", label: "Cancelled" }]} className={standaloneSelectClass} preserveCase />
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState illustration="clipboard" title="No stock counts yet" action={{ label: "Start a count", onClick: () => setStarting(true) }} />
      ) : (
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Number</th>
                <th>Store</th>
                <th>Scope</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Started</th>
                <th className="text-right">Difference</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.stockCountId} className="cursor-pointer" onClick={() => setOpenId(c.stockCountId)}>
                  <td className="font-medium text-foreground">{c.number}</td>
                  <td>{c.storeName}</td>
                  <td>{[c.itemTypeFilter, c.categoryFilter].filter(Boolean).join(" · ") || "Everything"}</td>
                  <td>
                    <DocStatus status={c.status} />
                  </td>
                  <td>
                    {c.countedLines}/{c.lineCount}
                  </td>
                  <td>
                    {c.createdByName}
                    <span className="block text-xs text-muted-foreground">{stamp(c.createdAt)}</span>
                  </td>
                  <td className="text-right tabular-nums">{c.status === "Posted" ? formatCurrency(c.varianceValue) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pageSize={50} total={total} onPage={setPage} />
      {openId && <CountSheet id={openId} onClose={() => setOpenId(null)} />}
      {starting && (
        <StartCount
          onClose={() => setStarting(false)}
          onStarted={(id) => {
            setStarting(false);
            setOpenId(id);
            load();
          }}
        />
      )}
    </div>
  );
}

export default function CountsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <CountsInner />
    </Suspense>
  );
}
