"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Ban, Check, CornerUpLeft, Lock, PackageCheck, Pencil, Plus, Printer, RefreshCcw, Save, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import DatePicker from "@/components/DatePicker";
import SearchableSelect, { fieldSelectClass, standaloneSelectClass } from "@/components/SearchableSelect";
import { InventoryService } from "@/services/inventory.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency } from "@/lib/currency";
import { useRegion } from "@/lib/region";
import { getUserDetail } from "@/lib/userDetail";
import type { InventoryItem, InventoryVendor, PurchaseOrder, PurchaseOrderSummary, ReorderSuggestion } from "@/types/inventory.type";
import ItemPicker from "@/components/inventory/ItemPicker";
import GoodsReceiptForm from "@/components/inventory/GoodsReceiptForm";
import {
  DocStatus,
  Facts,
  Field,
  Modal,
  PageBar,
  Pager,
  ReasonPrompt,
  dangerButton,
  dateInputClass,
  day,
  inputClass,
  primaryButton,
  qty,
  secondaryButton,
  smallInputClass,
  stamp,
  todayInput,
  useInventory,
} from "@/components/inventory/inventoryUi";

const STATUS_FILTERS = [
  { value: "", label: "All orders" },
  { value: "Draft", label: "Drafts" },
  { value: "PendingApproval", label: "Waiting approval" },
  { value: "open", label: "Open (to receive)" },
  { value: "Received", label: "Received" },
  { value: "Closed", label: "Closed" },
  { value: "Cancelled", label: "Cancelled" },
];

interface FormLine {
  key: string;
  itemId: string;
  itemName: string;
  unit: string;
  quantity: string;
  unitCost: string;
  taxPercent: string;
}

// ---------------- form ----------------

function PurchaseOrderForm({ order, onClose, onSaved }: { order: PurchaseOrder | null; onClose: () => void; onSaved: (id: string) => void }) {
  const { myStores } = useInventory();
  const region = useRegion();
  const taxApplies = region?.tax.applicable ?? false;
  const [vendors, setVendors] = useState<InventoryVendor[]>([]);
  const [vendorId, setVendorId] = useState(order?.vendorId ?? "");
  const [storeId, setStoreId] = useState(order?.storeId ?? myStores.find((s) => s.storeType === "Main")?.storeId ?? "");
  const [orderDate, setOrderDate] = useState(order?.orderDate ?? todayInput());
  const [expectedDate, setExpectedDate] = useState(order?.expectedDate ?? "");
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [lines, setLines] = useState<FormLine[]>(
    () =>
      order?.lines.map((l) => ({ key: l.purchaseOrderLineId, itemId: l.itemId, itemName: l.itemName, unit: l.unit, quantity: String(l.quantity), unitCost: String(l.unitCost), taxPercent: String(l.taxPercent) })) ?? []
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    InventoryService.vendors().then((r) => setVendors(r.data)).catch(() => {});
  }, []);

  const addItem = (item: InventoryItem) => {
    if (lines.some((l) => l.itemId === item.itemId)) return toast.info(`${item.name} is already on the order`);
    const per = item.purchaseUnit ? item.unitsPerPurchaseUnit : 1;
    setLines((ls) => [
      ...ls,
      {
        key: item.itemId,
        itemId: item.itemId,
        itemName: item.name,
        unit: item.purchaseUnit ?? item.unit,
        quantity: "",
        unitCost: item.lastPurchaseCost ? String(+(item.lastPurchaseCost * per).toFixed(4)) : "",
        taxPercent: String(item.taxPercent ?? 0),
      },
    ]);
    if (!vendorId && item.defaultVendorId) setVendorId(item.defaultVendorId);
  };
  const setLine = (key: string, patch: Partial<FormLine>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const subtotal = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitCost || 0), 0);
  const tax = lines.reduce((s, l) => s + (Number(l.quantity || 0) * Number(l.unitCost || 0) * Number(l.taxPercent || 0)) / 100, 0);

  const save = async (submit: boolean) => {
    if (!vendorId || !storeId) return toast.error("Choose the supplier and the store");
    if (lines.length === 0) return toast.error("Add at least one item");
    setSaving(true);
    try {
      const payload = {
        vendorId,
        storeId,
        orderDate: orderDate || null,
        expectedDate: expectedDate || null,
        notes: notes || null,
        submit,
        lines: lines.map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity) || 0, unitCost: Number(l.unitCost) || 0, taxPercent: taxApplies ? Number(l.taxPercent) || 0 : 0 })),
      };
      const res = order ? await InventoryService.updatePurchaseOrder(order.purchaseOrderId, payload) : await InventoryService.createPurchaseOrder(payload);
      toast.success(res.message ?? "Saved");
      onSaved(res.data.purchaseOrderId);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't save the purchase order"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={order ? `Edit ${order.number}` : "New purchase order"}
      subtitle={order?.rejectionReason ? `Sent back: ${order.rejectionReason}` : "Quantities and prices are per purchase unit (e.g. per box)."}
      onClose={onClose}
      width="max-w-5xl"
      footer={
        <>
          <span className="mr-auto text-sm text-muted-foreground">
            {formatCurrency(subtotal)}
            {taxApplies && ` + ${region?.tax.name} ${formatCurrency(tax)} = ${formatCurrency(subtotal + tax)}`}
          </span>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={() => save(false)} disabled={saving} className={secondaryButton}>
            <Save size={15} /> Save draft
          </button>
          <button type="button" onClick={() => save(true)} disabled={saving} className={primaryButton}>
            <Send size={15} /> Send for approval
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Supplier" required>
            <SearchableSelect value={vendorId} onChange={setVendorId} options={vendors.map((v) => ({ value: v.vendorId, label: v.name }))} className={fieldSelectClass} preserveCase placeholder="Choose…" />
          </Field>
          <Field label="Deliver to" required>
            <SearchableSelect value={storeId} onChange={setStoreId} options={myStores.map((s) => ({ value: s.storeId, label: s.name }))} className={fieldSelectClass} preserveCase placeholder="Choose…" />
          </Field>
          <Field label="Order date">
            <DatePicker value={orderDate} onChange={setOrderDate} className={dateInputClass} />
          </Field>
          <Field label="Expected delivery">
            <DatePicker value={expectedDate} onChange={setExpectedDate} min={orderDate || undefined} className={dateInputClass} />
          </Field>
        </div>
        <ItemPicker onPick={(item) => addItem(item)} includeMedicines />
        {lines.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table-compact table-no-row-hover w-full text-sm">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="w-28">Quantity</th>
                  <th className="w-32">Price / unit</th>
                  {taxApplies && <th className="w-24">{region?.tax.name} %</th>}
                  <th className="w-32 text-right">Value</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.key}>
                    <td>
                      <span className="font-medium text-foreground">{l.itemName}</span>
                      <span className="block text-xs text-muted-foreground">per {l.unit}</span>
                    </td>
                    <td>
                      <input type="number" min={0} step="any" value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} className={smallInputClass} />
                    </td>
                    <td>
                      <input type="number" min={0} step="any" value={l.unitCost} onChange={(e) => setLine(l.key, { unitCost: e.target.value })} className={smallInputClass} />
                    </td>
                    {taxApplies && (
                      <td>
                        <input type="number" min={0} max={100} step="any" value={l.taxPercent} onChange={(e) => setLine(l.key, { taxPercent: e.target.value })} className={smallInputClass} />
                      </td>
                    )}
                    <td className="text-right tabular-nums">{formatCurrency(Number(l.quantity || 0) * Number(l.unitCost || 0))}</td>
                    <td>
                      <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="rounded p-1 text-muted-foreground hover:text-red-600" aria-label="Remove line">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Field label="Notes for the supplier">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} className="w-full text-sm" />
        </Field>
      </div>
    </Modal>
  );
}

// ---------------- printout ----------------

function PurchaseOrderPrintout({ order }: { order: PurchaseOrder }) {
  const company = getUserDetail()?.companyName ?? "";
  return (
    <div className="po-print-only bg-white p-8 text-black">
      <div className="flex items-start justify-between border-b-2 border-black pb-3">
        <div>
          <p className="text-xl font-bold">{company}</p>
          <p className="text-sm">Purchase order {order.number}</p>
        </div>
        <div className="text-right text-sm">
          <p>Date: {day(order.orderDate)}</p>
          {order.expectedDate && <p>Expected: {day(order.expectedDate)}</p>}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <p>
          <span className="font-semibold">Supplier:</span> {order.vendorName}
        </p>
        <p>
          <span className="font-semibold">Deliver to:</span> {order.storeName}
        </p>
      </div>
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-1 pr-2">#</th>
            <th className="py-1 pr-2">Item</th>
            <th className="py-1 pr-2 text-right">Qty</th>
            <th className="py-1 pr-2">Unit</th>
            <th className="py-1 pr-2 text-right">Price</th>
            <th className="py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((l, i) => (
            <tr key={l.purchaseOrderLineId} className="border-b border-gray-300">
              <td className="py-1 pr-2">{i + 1}</td>
              <td className="py-1 pr-2">{l.itemName}</td>
              <td className="py-1 pr-2 text-right">{qty(l.quantity)}</td>
              <td className="py-1 pr-2">{l.unit}</td>
              <td className="py-1 pr-2 text-right">{formatCurrency(l.unitCost)}</td>
              <td className="py-1 text-right">{formatCurrency(l.lineValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ml-auto mt-3 w-64 text-sm">
        <p className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatCurrency(order.subtotal)}</span>
        </p>
        {order.taxTotal > 0 && (
          <p className="flex justify-between">
            <span>Tax</span>
            <span>{formatCurrency(order.taxTotal)}</span>
          </p>
        )}
        <p className="flex justify-between border-t-2 border-black pt-1 font-bold">
          <span>Total</span>
          <span>{formatCurrency(order.total)}</span>
        </p>
      </div>
      {order.notes && <p className="mt-4 text-sm">Notes: {order.notes}</p>}
      <p className="mt-10 text-sm">
        Prepared by {order.createdByName ?? "—"} · Approved by {order.approvedByName ?? "—"} {order.approvedAt ? `on ${stamp(order.approvedAt)}` : ""}
      </p>
      <style jsx global>{`
        .po-print-only {
          display: none;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          .po-print-only,
          .po-print-only * {
            visibility: visible;
          }
          .po-print-only {
            display: block;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

// ---------------- detail ----------------

type Prompt = "sendBack" | "cancel" | "close" | null;

function PurchaseOrderDetail({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (o: PurchaseOrder) => void }) {
  const { lookups } = useInventory();
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [receiving, setReceiving] = useState(false);

  const load = useCallback(() => {
    InventoryService.purchaseOrder(id).then((r) => setOrder(r.data)).catch((err) => toast.error(apiErrorMessage(err, "Couldn't load the order")));
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  useSignalRRefetch(["inventoryChanged"], load);

  const run = async (action: () => Promise<{ message: string }>) => {
    setBusy(true);
    try {
      const res = await action();
      toast.success(res.message);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "That didn't work"));
    } finally {
      setBusy(false);
    }
  };

  if (!order) return null;
  const canEdit = order.status === "Draft";
  const open = order.status === "Approved" || order.status === "PartiallyReceived";

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          {order.number} <DocStatus status={order.status} />
        </span>
      }
      subtitle={`${order.vendorName} → ${order.storeName}`}
      onClose={onClose}
      width="max-w-5xl"
      footer={
        <>
          <button type="button" onClick={() => window.print()} className={`${secondaryButton} mr-auto`}>
            <Printer size={15} /> Print
          </button>
          {canEdit && (
            <>
              <button type="button" disabled={busy} onClick={() => setPrompt("cancel")} className={dangerButton}>
                <Ban size={15} /> Cancel order
              </button>
              <button type="button" disabled={busy} onClick={() => onEdit(order)} className={secondaryButton}>
                <Pencil size={15} /> Edit
              </button>
              <button type="button" disabled={busy} onClick={() => run(() => InventoryService.submitPurchaseOrder(order.purchaseOrderId))} className={primaryButton}>
                <Send size={15} /> Send for approval
              </button>
            </>
          )}
          {order.status === "PendingApproval" && order.canApprove && (
            <>
              <button type="button" disabled={busy} onClick={() => setPrompt("sendBack")} className={secondaryButton}>
                <CornerUpLeft size={15} /> Send back
              </button>
              <button type="button" disabled={busy} onClick={() => run(() => InventoryService.approvePurchaseOrder(order.purchaseOrderId))} className={primaryButton}>
                <Check size={15} /> Approve
              </button>
            </>
          )}
          {order.status === "PendingApproval" && !order.canApprove && (
            <span className="text-sm text-muted-foreground">Waiting for {lookups?.isAdmin ? "another approver" : "an admin or the store's manager"}</span>
          )}
          {(order.status === "PendingApproval" || order.status === "Approved") && order.canApprove && (
            <button type="button" disabled={busy} onClick={() => setPrompt("cancel")} className={dangerButton}>
              <Ban size={15} /> Cancel order
            </button>
          )}
          {order.status === "PartiallyReceived" && (
            <button type="button" disabled={busy} onClick={() => setPrompt("close")} className={secondaryButton}>
              <Lock size={15} /> Close (no more deliveries)
            </button>
          )}
          {open && (
            <button type="button" disabled={busy} onClick={() => setReceiving(true)} className={primaryButton}>
              <PackageCheck size={15} /> Receive goods
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {order.rejectionReason && order.status === "Draft" && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            Sent back: {order.rejectionReason}
          </p>
        )}
        <Facts
          items={[
            { label: "Order date", value: day(order.orderDate) },
            { label: "Expected", value: day(order.expectedDate) },
            { label: "Total", value: formatCurrency(order.total) },
            { label: "Prepared by", value: `${order.createdByName ?? "—"}` },
            { label: "Approved by", value: order.approvedByName ? `${order.approvedByName} · ${stamp(order.approvedAt)}` : "—" },
            { label: order.status === "Cancelled" ? "Cancelled by" : "Closed by", value: order.closedByName ? `${order.closedByName} · ${order.closeReason ?? ""}` : "—" },
          ]}
        />
        <div className="overflow-x-auto">
          <table className="table-compact w-full text-sm">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">Ordered</th>
                <th className="text-right">Received</th>
                <th className="text-right">Outstanding</th>
                <th className="text-right">Price</th>
                <th className="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((l) => (
                <tr key={l.purchaseOrderLineId}>
                  <td>
                    {l.itemName}
                    <span className="block text-xs text-muted-foreground">per {l.unit}</span>
                  </td>
                  <td className="text-right tabular-nums">{qty(l.quantity)}</td>
                  <td className="text-right tabular-nums">{qty(l.receivedQuantity)}</td>
                  <td className={`text-right tabular-nums ${l.outstanding > 0 && open ? "font-semibold text-amber-600" : ""}`}>{qty(l.outstanding)}</td>
                  <td className="text-right tabular-nums">{formatCurrency(l.unitCost)}</td>
                  <td className="text-right tabular-nums">{formatCurrency(l.lineValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {order.notes && <p className="text-sm text-muted-foreground">Notes: {order.notes}</p>}
        {order.receipts.length > 0 && (
          <div>
            <h4 className="mb-1 text-sm font-semibold text-foreground">Deliveries</h4>
            <ul className="text-sm text-muted-foreground">
              {order.receipts.map((r) => (
                <li key={r.goodsReceiptId}>
                  {r.number} · {day(r.receivedDate)} · {formatCurrency(r.total)} · {r.receivedByName}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <PurchaseOrderPrintout order={order} />
      {prompt && (
        <ReasonPrompt
          title={prompt === "sendBack" ? "Send back to the preparer" : prompt === "cancel" ? `Cancel ${order.number}` : `Close ${order.number}`}
          description={prompt === "close" ? "Nothing more will be received against this order." : undefined}
          confirmLabel={prompt === "sendBack" ? "Send back" : prompt === "cancel" ? "Cancel order" : "Close order"}
          danger={prompt === "cancel"}
          onClose={() => setPrompt(null)}
          onConfirm={async (reason) => {
            const action =
              prompt === "sendBack"
                ? () => InventoryService.sendBackPurchaseOrder(order.purchaseOrderId, reason)
                : prompt === "cancel"
                  ? () => InventoryService.cancelPurchaseOrder(order.purchaseOrderId, reason)
                  : () => InventoryService.closePurchaseOrder(order.purchaseOrderId, reason);
            await run(action);
            setPrompt(null);
          }}
        />
      )}
      {receiving && (
        <GoodsReceiptForm
          order={order}
          onClose={() => setReceiving(false)}
          onPosted={() => {
            setReceiving(false);
            load();
          }}
        />
      )}
    </Modal>
  );
}

// ---------------- reorder ----------------

function ReorderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { myStores } = useInventory();
  const mainStores = myStores.filter((s) => s.storeType === "Main");
  const [storeId, setStoreId] = useState(mainStores[0]?.storeId ?? "");
  const [rows, setRows] = useState<ReorderSuggestion[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    setRows(null);
    InventoryService.reorder(storeId)
      .then((r) => {
        setRows(r.data);
        setPicked(new Set(r.data.filter((x) => x.defaultVendorId).map((x) => x.itemId)));
      })
      .catch(() => setRows([]));
  }, [storeId]);

  const create = async () => {
    setBusy(true);
    try {
      const res = await InventoryService.purchaseOrdersFromReorder(storeId, [...picked]);
      toast.success(res.message ?? "Created");
      onCreated();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't create the orders"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Reorder suggestions"
      subtitle="Items at or below their reorder level. One draft order is raised per default supplier."
      onClose={onClose}
      width="max-w-4xl"
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Close
          </button>
          <button type="button" onClick={create} disabled={busy || picked.size === 0} className={primaryButton}>
            <Plus size={15} /> Create draft orders ({picked.size})
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="w-64">
          <SearchableSelect value={storeId} onChange={setStoreId} options={mainStores.map((s) => ({ value: s.storeId, label: s.name }))} className={standaloneSelectClass} preserveCase />
        </div>
        {rows == null ? (
          <LoadingSpinner />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing in this store is at its reorder level.</p>
        ) : (
          <table className="table-compact w-full text-sm">
            <thead>
              <tr>
                <th />
                <th>Item</th>
                <th className="text-right">In stock</th>
                <th className="text-right">Level</th>
                <th className="text-right">Order</th>
                <th>Supplier</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.itemId}>
                  <td>
                    <input
                      type="checkbox"
                      disabled={!r.defaultVendorId}
                      checked={picked.has(r.itemId)}
                      onChange={(e) =>
                        setPicked((p) => {
                          const n = new Set(p);
                          if (e.target.checked) n.add(r.itemId);
                          else n.delete(r.itemId);
                          return n;
                        })
                      }
                      className="h-4 w-4"
                    />
                  </td>
                  <td>
                    {r.name}
                    <span className="block text-xs text-muted-foreground">{r.code}</span>
                  </td>
                  <td className="text-right tabular-nums">
                    {qty(r.quantity)} {r.unit}
                  </td>
                  <td className="text-right tabular-nums">{qty(r.reorderLevel)}</td>
                  <td className="text-right tabular-nums">
                    {qty(r.suggestedPurchaseQuantity)} {r.purchaseUnit ?? r.unit}
                  </td>
                  <td>{r.defaultVendorName ?? <span className="text-amber-600">No default supplier</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  );
}

// ---------------- page ----------------

function PurchaseOrdersInner() {
  const params = useSearchParams();
  const { lookups } = useInventory();
  const [rows, setRows] = useState<PurchaseOrderSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(params.get("open"));
  const [editing, setEditing] = useState<PurchaseOrder | "new" | null>(null);
  const [reorder, setReorder] = useState(params.get("reorder") === "1");

  const load = useCallback(() => {
    InventoryService.purchaseOrders({ status: status || undefined, search: search.trim() || undefined, page })
      .then((r) => {
        setRows(r.data);
        setTotal(r.total);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [status, search, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);
  useSignalRRefetch(["inventoryChanged"], load);

  if (lookups && !lookups.isStoreTeam) return <EmptyState illustration="clipboard" title="Purchasing is handled by the store team" />;

  return (
    <div className="flex flex-col gap-4">
      <PageBar title="Purchase orders" description="Orders to suppliers - prepared, approved, then received into a store.">
        <button type="button" onClick={() => setReorder(true)} className={secondaryButton}>
          <RefreshCcw size={15} /> Reorder suggestions
        </button>
        <button type="button" onClick={() => setEditing("new")} className={primaryButton}>
          <Plus size={15} /> New purchase order
        </button>
      </PageBar>
      <div className="flex flex-wrap gap-2">
        <div className="w-56">
          <SearchableSelect value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={STATUS_FILTERS} className={standaloneSelectClass} preserveCase />
        </div>
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search number or supplier…" className={`${inputClass} w-72`} />
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState illustration="documents" title="No purchase orders" action={{ label: "New purchase order", onClick: () => setEditing("new") }} />
      ) : (
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Number</th>
                <th>Supplier</th>
                <th>Store</th>
                <th>Date</th>
                <th>Status</th>
                <th className="text-right">Total</th>
                <th>Prepared by</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.purchaseOrderId} className="cursor-pointer" onClick={() => setOpenId(r.purchaseOrderId)}>
                  <td className="font-medium text-foreground">{r.number}</td>
                  <td>{r.vendorName}</td>
                  <td>{r.storeName}</td>
                  <td>{day(r.orderDate)}</td>
                  <td>
                    <DocStatus status={r.status} />
                  </td>
                  <td className="text-right tabular-nums">{formatCurrency(r.total)}</td>
                  <td>{r.createdByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pageSize={50} total={total} onPage={setPage} />
      {openId && !editing && <PurchaseOrderDetail id={openId} onClose={() => setOpenId(null)} onEdit={(o) => setEditing(o)} />}
      {editing && (
        <PurchaseOrderForm
          order={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(id) => {
            setEditing(null);
            setOpenId(id);
            load();
          }}
        />
      )}
      {reorder && (
        <ReorderModal
          onClose={() => setReorder(false)}
          onCreated={() => {
            setReorder(false);
            setStatus("Draft");
            load();
          }}
        />
      )}
    </div>
  );
}

export default function PurchaseOrdersPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PurchaseOrdersInner />
    </Suspense>
  );
}
