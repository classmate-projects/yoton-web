"use client";

import { useCallback, useEffect, useState } from "react";
import { PackageCheck, Plus, Printer, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import SearchableSelect, { fieldSelectClass } from "@/components/SearchableSelect";
import { InventoryService } from "@/services/inventory.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency } from "@/lib/currency";
import type { GoodsReceipt, GoodsReceiptSummary, InventoryItem, InventoryVendor, PurchaseOrder, PurchaseOrderSummary, VendorReturn, VendorReturnSummary } from "@/types/inventory.type";
import GoodsReceiptForm from "@/components/inventory/GoodsReceiptForm";
import ItemPicker from "@/components/inventory/ItemPicker";
import LotSelect from "@/components/inventory/LotSelect";
import BarcodeLabels, { type InventoryLabel } from "@/components/inventory/BarcodeLabels";
import { Facts, Field, Modal, PageBar, Pager, day, inputClass, primaryButton, qty, secondaryButton, smallInputClass, stamp, useInventory } from "@/components/inventory/inventoryUi";

// ---------------- receipt detail ----------------

function ReceiptDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [receipt, setReceipt] = useState<GoodsReceipt | null>(null);
  const [labels, setLabels] = useState<InventoryLabel[] | null>(null);
  useEffect(() => {
    InventoryService.goodsReceipt(id).then((r) => setReceipt(r.data)).catch((err) => toast.error(apiErrorMessage(err, "Couldn't load the receipt")));
  }, [id]);
  if (!receipt) return null;
  const lotLabels = receipt.lines
    .filter((l) => l.batchId)
    .map((l) => ({ code: l.batchId!, title: l.itemName, lines: [`Batch ${l.batchNumber ?? "—"}${l.expiryDate ? ` · Exp ${day(l.expiryDate)}` : ""}`, `${receipt.number} · ${receipt.storeName ?? ""}`] }));
  return (
    <Modal
      title={receipt.number}
      subtitle={`${receipt.vendorName} → ${receipt.storeName}${receipt.purchaseOrderNumber ? ` · against ${receipt.purchaseOrderNumber}` : " · direct receipt"}`}
      onClose={onClose}
      width="max-w-5xl"
      footer={
        <button type="button" onClick={() => setLabels(lotLabels)} disabled={lotLabels.length === 0} className={secondaryButton}>
          <Printer size={15} /> Batch labels
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <Facts
          items={[
            { label: "Received", value: day(receipt.receivedDate) },
            { label: "Invoice", value: receipt.invoiceNumber ? `${receipt.invoiceNumber}${receipt.invoiceDate ? ` · ${day(receipt.invoiceDate)}` : ""}` : "—" },
            { label: "Total", value: formatCurrency(receipt.total) },
            { label: "Received by", value: `${receipt.receivedByName ?? "—"} · ${stamp(receipt.createdAt)}` },
          ]}
        />
        <div className="overflow-x-auto">
          <table className="table-compact w-full text-sm">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Free</th>
                <th className="text-right">Price</th>
                <th>Batch</th>
                <th>Expiry</th>
                <th className="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {receipt.lines.map((l) => (
                <tr key={l.goodsReceiptLineId}>
                  <td>
                    {l.itemName}
                    <span className="block text-xs text-muted-foreground">per {l.unit}</span>
                  </td>
                  <td className="text-right tabular-nums">{qty(l.quantity)}</td>
                  <td className="text-right tabular-nums">{l.freeQuantity ? qty(l.freeQuantity) : "—"}</td>
                  <td className="text-right tabular-nums">{formatCurrency(l.unitCost)}</td>
                  <td>{l.batchNumber ?? "—"}</td>
                  <td>{day(l.expiryDate)}</td>
                  <td className="text-right tabular-nums">{formatCurrency(l.lineValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {receipt.notes && <p className="text-sm text-muted-foreground">Notes: {receipt.notes}</p>}
      </div>
      {labels && <BarcodeLabels labels={labels} onClose={() => setLabels(null)} />}
    </Modal>
  );
}

// ---------------- choose an open purchase order ----------------

function PickOrder({ onPick, onClose }: { onPick: (o: PurchaseOrder) => void; onClose: () => void }) {
  const [orders, setOrders] = useState<PurchaseOrderSummary[] | null>(null);
  useEffect(() => {
    InventoryService.purchaseOrders({ status: "open" }).then((r) => setOrders(r.data)).catch(() => setOrders([]));
  }, []);
  const pick = async (id: string) => {
    try {
      const r = await InventoryService.purchaseOrder(id);
      onPick(r.data);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't load the order"));
    }
  };
  return (
    <Modal title="Receive against a purchase order" subtitle="Approved orders still waiting for goods." onClose={onClose} width="max-w-3xl">
      {orders == null ? (
        <LoadingSpinner />
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No approved orders are waiting for goods.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {orders.map((o) => (
            <li key={o.purchaseOrderId}>
              <button type="button" onClick={() => pick(o.purchaseOrderId)} className="flex w-full items-center justify-between gap-3 px-1 py-2 text-left text-sm hover:bg-muted/40">
                <span>
                  <span className="font-semibold text-foreground">{o.number}</span> · {o.vendorName}
                  <span className="block text-xs text-muted-foreground">
                    {o.storeName} · ordered {day(o.orderDate)}
                    {o.expectedDate ? ` · expected ${day(o.expectedDate)}` : ""}
                  </span>
                </span>
                <span className="text-xs font-semibold text-primary">Receive</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

// ---------------- supplier returns ----------------

interface ReturnLine {
  key: string;
  item: InventoryItem;
  batchId: string;
  quantity: string;
}

function VendorReturnForm({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const { myStores } = useInventory();
  const [vendors, setVendors] = useState<InventoryVendor[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [storeId, setStoreId] = useState(myStores.find((s) => s.storeType === "Main")?.storeId ?? "");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    InventoryService.vendors().then((r) => setVendors(r.data)).catch(() => {});
  }, []);

  const submit = async () => {
    if (!vendorId || !storeId || !reason.trim()) return toast.error("Choose the supplier and store, and give the reason");
    if (lines.length === 0 || lines.some((l) => !l.batchId || !(Number(l.quantity) > 0))) return toast.error("Choose the batch and quantity for every item");
    setSaving(true);
    try {
      const res = await InventoryService.createVendorReturn({ vendorId, storeId, reason: reason.trim(), notes: notes || null, lines: lines.map((l) => ({ itemId: l.item.itemId, batchId: l.batchId, quantity: Number(l.quantity) })) });
      toast.success(res.message ?? "Returned");
      onPosted();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't post the return"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Return to supplier"
      subtitle="Damaged, expired or wrong stock going back - it leaves the store when posted."
      onClose={onClose}
      width="max-w-4xl"
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={saving} className={primaryButton}>
            <Undo2 size={15} /> {saving ? "Posting…" : "Post return"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Supplier" required>
            <SearchableSelect value={vendorId} onChange={setVendorId} options={vendors.map((v) => ({ value: v.vendorId, label: v.name }))} className={fieldSelectClass} preserveCase placeholder="Choose…" />
          </Field>
          <Field label="From store" required>
            <SearchableSelect value={storeId} onChange={(v) => { setStoreId(v); setLines([]); }} options={myStores.map((s) => ({ value: s.storeId, label: s.name }))} className={fieldSelectClass} preserveCase placeholder="Choose…" />
          </Field>
          <Field label="Reason" required>
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="e.g. Damaged in transit, recalled" className={inputClass} />
          </Field>
        </div>
        {storeId && <ItemPicker onPick={(item, batchId) => setLines((ls) => [...ls, { key: `${item.itemId}-${Date.now()}`, item, batchId: batchId ?? "", quantity: "" }])} />}
        {lines.length > 0 && (
          <table className="table-compact table-no-row-hover w-full text-sm">
            <thead>
              <tr>
                <th>Item</th>
                <th className="w-80">Batch</th>
                <th className="w-28">Quantity</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key}>
                  <td>{l.item.name}</td>
                  <td>
                    <LotSelect storeId={storeId} itemId={l.item.itemId} value={l.batchId} allowAuto={false} includeExpired unit={l.item.unit} onChange={(v) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, batchId: v } : x)))} />
                  </td>
                  <td>
                    <input type="number" min={0} step="any" value={l.quantity} onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, quantity: e.target.value } : x)))} placeholder={l.item.unit} className={smallInputClass} />
                  </td>
                  <td>
                    <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="rounded p-1 text-muted-foreground hover:text-red-600" aria-label="Remove line">
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

function VendorReturnDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [ret, setRet] = useState<VendorReturn | null>(null);
  useEffect(() => {
    InventoryService.vendorReturn(id).then((r) => setRet(r.data)).catch((err) => toast.error(apiErrorMessage(err, "Couldn't load the return")));
  }, [id]);
  if (!ret) return null;
  return (
    <Modal title={ret.number} subtitle={`${ret.storeName} → ${ret.vendorName}`} onClose={onClose} width="max-w-4xl">
      <div className="flex flex-col gap-4">
        <Facts items={[{ label: "Reason", value: ret.reason }, { label: "Value", value: formatCurrency(ret.total) }, { label: "By", value: ret.createdByName }, { label: "When", value: stamp(ret.createdAt) }]} />
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
            {ret.lines.map((l) => (
              <tr key={l.vendorReturnLineId}>
                <td>{l.itemName}</td>
                <td>{l.batchNumber ?? "—"}</td>
                <td>{day(l.expiryDate)}</td>
                <td className="text-right tabular-nums">
                  {qty(l.quantity)} {l.unit}
                </td>
                <td className="text-right tabular-nums">{formatCurrency(l.lineValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

// ---------------- page ----------------

export default function ReceiptsPage() {
  const { lookups } = useInventory();
  const [tab, setTab] = useState<"receipts" | "returns">("receipts");
  const [receipts, setReceipts] = useState<GoodsReceiptSummary[]>([]);
  const [returns, setReturns] = useState<VendorReturnSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [openReceipt, setOpenReceipt] = useState<string | null>(null);
  const [openReturn, setOpenReturn] = useState<string | null>(null);
  const [receiving, setReceiving] = useState<PurchaseOrder | "direct" | null>(null);
  const [picking, setPicking] = useState(false);
  const [returning, setReturning] = useState(false);

  const load = useCallback(() => {
    const req =
      tab === "receipts"
        ? InventoryService.goodsReceipts({ search: search.trim() || undefined, page }).then((r) => {
            setReceipts(r.data);
            setTotal(r.total);
          })
        : InventoryService.vendorReturns({ page }).then((r) => {
            setReturns(r.data);
            setTotal(r.total);
          });
    req.catch(() => {}).finally(() => setLoading(false));
  }, [tab, search, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);
  useSignalRRefetch(["inventoryChanged"], load);

  if (lookups && !lookups.isStoreTeam) return <EmptyState illustration="clipboard" title="Receiving is handled by the store team" />;

  return (
    <div className="flex flex-col gap-4">
      <PageBar title="Goods receipts" description="Deliveries posted into stores, and stock sent back to suppliers.">
        {tab === "receipts" ? (
          <>
            <button type="button" onClick={() => setReceiving("direct")} className={secondaryButton}>
              <Plus size={15} /> Direct receipt
            </button>
            <button type="button" onClick={() => setPicking(true)} className={primaryButton}>
              <PackageCheck size={15} /> Receive against an order
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setReturning(true)} className={primaryButton}>
            <Undo2 size={15} /> Return to supplier
          </button>
        )}
      </PageBar>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {(["receipts", "returns"] as const).map((t) => (
            <button key={t} type="button" onClick={() => { setTab(t); setPage(1); setLoading(true); }} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              {t === "receipts" ? "Receipts" : "Supplier returns"}
            </button>
          ))}
        </div>
        {tab === "receipts" && <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search GRN, PO, invoice or supplier…" className={`${inputClass} w-80`} />}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : tab === "receipts" ? (
        receipts.length === 0 ? (
          <EmptyState illustration="documents" title="No goods received yet" />
        ) : (
          <div className="card">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Received</th>
                  <th>Supplier</th>
                  <th>Store</th>
                  <th>Order</th>
                  <th>Invoice</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.goodsReceiptId} className="cursor-pointer" onClick={() => setOpenReceipt(r.goodsReceiptId)}>
                    <td className="font-medium text-foreground">{r.number}</td>
                    <td>{day(r.receivedDate)}</td>
                    <td>{r.vendorName}</td>
                    <td>{r.storeName}</td>
                    <td>{r.purchaseOrderNumber ?? "Direct"}</td>
                    <td>{r.invoiceNumber ?? "—"}</td>
                    <td className="text-right tabular-nums">{formatCurrency(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : returns.length === 0 ? (
        <EmptyState illustration="documents" title="No returns to suppliers" />
      ) : (
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Number</th>
                <th>When</th>
                <th>Supplier</th>
                <th>Store</th>
                <th>Reason</th>
                <th className="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((r) => (
                <tr key={r.vendorReturnId} className="cursor-pointer" onClick={() => setOpenReturn(r.vendorReturnId)}>
                  <td className="font-medium text-foreground">{r.number}</td>
                  <td>{stamp(r.createdAt)}</td>
                  <td>{r.vendorName}</td>
                  <td>{r.storeName}</td>
                  <td>{r.reason}</td>
                  <td className="text-right tabular-nums">{formatCurrency(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pageSize={50} total={total} onPage={setPage} />

      {openReceipt && <ReceiptDetail id={openReceipt} onClose={() => setOpenReceipt(null)} />}
      {openReturn && <VendorReturnDetail id={openReturn} onClose={() => setOpenReturn(null)} />}
      {picking && (
        <PickOrder
          onClose={() => setPicking(false)}
          onPick={(o) => {
            setPicking(false);
            setReceiving(o);
          }}
        />
      )}
      {receiving && (
        <GoodsReceiptForm
          order={receiving === "direct" ? null : receiving}
          onClose={() => setReceiving(null)}
          onPosted={() => {
            setReceiving(null);
            load();
          }}
        />
      )}
      {returning && (
        <VendorReturnForm
          onClose={() => setReturning(false)}
          onPosted={() => {
            setReturning(false);
            load();
          }}
        />
      )}
    </div>
  );
}
