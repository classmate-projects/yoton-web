"use client";

import { useEffect, useState } from "react";
import { PackageCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import DatePicker from "@/components/DatePicker";
import SearchableSelect, { fieldSelectClass } from "@/components/SearchableSelect";
import { InventoryService } from "@/services/inventory.service";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency } from "@/lib/currency";
import { useRegion } from "@/lib/region";
import type { InventoryItem, InventoryVendor, PurchaseOrder } from "@/types/inventory.type";
import ItemPicker from "./ItemPicker";
import { Field, Modal, dateInputClass, inputClass, primaryButton, qty, secondaryButton, smallDateInputClass, smallInputClass, todayInput, useInventory } from "./inventoryUi";

interface Line {
  key: string;
  purchaseOrderLineId: string | null;
  itemId: string;
  itemName: string;
  unit: string;
  perUnit: number;
  baseUnit: string;
  trackBatch: boolean;
  trackExpiry: boolean;
  outstanding: number | null;
  quantity: string;
  freeQuantity: string;
  unitCost: string;
  taxPercent: string;
  batchNumber: string;
  expiryDate: string;
}

// Receiving goods into a store - against an approved purchase order (its outstanding lines are
// filled in) or directly from a supplier. Posting adds the stock as lots with their batch,
// expiry and cost.
export default function GoodsReceiptForm({ order, onClose, onPosted }: { order?: PurchaseOrder | null; onClose: () => void; onPosted: () => void }) {
  const { myStores } = useInventory();
  const region = useRegion();
  const taxApplies = region?.tax.applicable ?? false;
  const [vendors, setVendors] = useState<InventoryVendor[]>([]);
  const [vendorId, setVendorId] = useState(order?.vendorId ?? "");
  const [storeId, setStoreId] = useState(order?.storeId ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [receivedDate, setReceivedDate] = useState(todayInput());
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [itemInfo, setItemInfo] = useState<Record<string, InventoryItem>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    InventoryService.vendors().then((r) => setVendors(r.data)).catch(() => {});
  }, []);

  // From a purchase order: one line per item still outstanding (batch rules from the item).
  useEffect(() => {
    if (!order) return;
    const open = order.lines.filter((l) => l.outstanding > 0);
    Promise.all(open.map((l) => InventoryService.item(l.itemId).then((r) => r.data).catch(() => null))).then((items) => {
      const info: Record<string, InventoryItem> = {};
      items.forEach((i) => i && (info[i.itemId] = i));
      setItemInfo(info);
      setLines(
        open.map((l) => ({
          key: l.purchaseOrderLineId,
          purchaseOrderLineId: l.purchaseOrderLineId,
          itemId: l.itemId,
          itemName: l.itemName,
          unit: l.unit,
          perUnit: l.unitsPerPurchaseUnit,
          baseUnit: info[l.itemId]?.unit ?? "",
          trackBatch: info[l.itemId]?.trackBatch ?? false,
          trackExpiry: info[l.itemId]?.trackExpiry ?? false,
          outstanding: l.outstanding,
          quantity: String(l.outstanding),
          freeQuantity: "",
          unitCost: String(l.unitCost),
          taxPercent: String(l.taxPercent),
          batchNumber: "",
          expiryDate: "",
        }))
      );
    });
  }, [order]);

  const addItem = (item: InventoryItem) => {
    setItemInfo((m) => ({ ...m, [item.itemId]: item }));
    const per = item.purchaseUnit ? item.unitsPerPurchaseUnit : 1;
    setLines((ls) => [
      ...ls,
      {
        key: `${item.itemId}-${Date.now()}`,
        purchaseOrderLineId: null,
        itemId: item.itemId,
        itemName: item.name,
        unit: item.purchaseUnit ?? item.unit,
        perUnit: per,
        baseUnit: item.unit,
        trackBatch: item.trackBatch,
        trackExpiry: item.trackExpiry,
        outstanding: null,
        quantity: "",
        freeQuantity: "",
        unitCost: item.lastPurchaseCost ? String(+(item.lastPurchaseCost * per).toFixed(4)) : "",
        taxPercent: String(item.taxPercent ?? 0),
        batchNumber: "",
        expiryDate: "",
      },
    ]);
  };

  const setLine = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: string) => setLines((ls) => ls.filter((l) => l.key !== key));

  const posted = lines.filter((l) => Number(l.quantity) > 0 || Number(l.freeQuantity) > 0);
  const subtotal = posted.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitCost || 0), 0);
  const tax = posted.reduce((s, l) => s + (Number(l.quantity || 0) * Number(l.unitCost || 0) * Number(l.taxPercent || 0)) / 100, 0);

  const submit = async () => {
    if (!order && (!vendorId || !storeId)) return toast.error("Choose the supplier and the store");
    if (posted.length === 0) return toast.error("Enter the quantity received for at least one item");
    setSaving(true);
    try {
      const res = await InventoryService.createGoodsReceipt({
        purchaseOrderId: order?.purchaseOrderId ?? null,
        vendorId: order ? null : vendorId,
        storeId: order ? null : storeId,
        invoiceNumber: invoiceNumber || null,
        invoiceDate: invoiceDate || null,
        receivedDate: receivedDate || null,
        notes: notes || null,
        lines: posted.map((l) => ({
          purchaseOrderLineId: l.purchaseOrderLineId,
          itemId: l.itemId,
          quantity: Number(l.quantity) || 0,
          freeQuantity: Number(l.freeQuantity) || 0,
          unitCost: l.unitCost === "" ? null : Number(l.unitCost),
          taxPercent: taxApplies && l.taxPercent !== "" ? Number(l.taxPercent) : null,
          batchNumber: l.batchNumber || null,
          expiryDate: l.expiryDate || null,
        })),
      });
      toast.success(res.message ?? "Received");
      onPosted();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't post the receipt"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={order ? `Receive goods - ${order.number}` : "Receive goods"}
      subtitle={order ? `${order.vendorName} → ${order.storeName}` : "A delivery that isn't on a purchase order."}
      onClose={onClose}
      width="max-w-6xl"
      footer={
        <>
          <span className="mr-auto text-sm text-muted-foreground">
            Value {formatCurrency(subtotal)}
            {taxApplies && ` + ${region?.tax.name} ${formatCurrency(tax)} = ${formatCurrency(subtotal + tax)}`}
          </span>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={saving} className={primaryButton}>
            <PackageCheck size={15} /> {saving ? "Posting…" : "Post receipt"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {!order && (
            <>
              <Field label="Supplier" required>
                <SearchableSelect value={vendorId} onChange={setVendorId} options={vendors.map((v) => ({ value: v.vendorId, label: v.name }))} className={fieldSelectClass} preserveCase placeholder="Choose…" />
              </Field>
              <Field label="Into store" required>
                <SearchableSelect value={storeId} onChange={setStoreId} options={myStores.map((s) => ({ value: s.storeId, label: s.name }))} className={fieldSelectClass} preserveCase placeholder="Choose…" />
              </Field>
            </>
          )}
          <Field label="Supplier invoice / delivery note">
            <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} maxLength={100} className={inputClass} />
          </Field>
          <Field label="Invoice date">
            <DatePicker value={invoiceDate} onChange={setInvoiceDate} className={dateInputClass} />
          </Field>
          <Field label="Received on" required>
            <DatePicker value={receivedDate} onChange={setReceivedDate} max={todayInput()} className={dateInputClass} />
          </Field>
        </div>

        {!order && <ItemPicker onPick={(item) => addItem(item)} includeMedicines />}

        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">{order ? "Nothing is outstanding on this order." : "Add the items that arrived."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-compact table-no-row-hover w-full text-sm">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="w-24">Qty</th>
                  <th className="w-20">Free</th>
                  <th className="w-28">Price / unit</th>
                  {taxApplies && <th className="w-20">{region?.tax.name} %</th>}
                  <th className="w-32">Batch</th>
                  <th className="w-40">Expiry</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.key}>
                    <td>
                      <span className="font-medium text-foreground">{l.itemName}</span>
                      <span className="block text-xs text-muted-foreground">
                        per {l.unit}
                        {l.perUnit !== 1 ? ` (${qty(l.perUnit)} ${l.baseUnit})` : ""}
                        {l.outstanding != null ? ` · ${qty(l.outstanding)} outstanding` : ""}
                      </span>
                    </td>
                    <td>
                      <input type="number" min={0} step="any" value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} className={smallInputClass} />
                    </td>
                    <td>
                      <input type="number" min={0} step="any" value={l.freeQuantity} onChange={(e) => setLine(l.key, { freeQuantity: e.target.value })} className={smallInputClass} />
                    </td>
                    <td>
                      <input type="number" min={0} step="any" value={l.unitCost} disabled={!!l.purchaseOrderLineId && !itemInfo[l.itemId]} onChange={(e) => setLine(l.key, { unitCost: e.target.value })} className={smallInputClass} />
                    </td>
                    {taxApplies && (
                      <td>
                        <input type="number" min={0} max={100} step="any" value={l.taxPercent} onChange={(e) => setLine(l.key, { taxPercent: e.target.value })} className={smallInputClass} />
                      </td>
                    )}
                    <td>
                      <input value={l.batchNumber} onChange={(e) => setLine(l.key, { batchNumber: e.target.value })} maxLength={60} placeholder={l.trackBatch ? "Required" : "Optional"} className={smallInputClass} />
                    </td>
                    <td>
                      <DatePicker value={l.expiryDate} onChange={(v) => setLine(l.key, { expiryDate: v })} min={todayInput()} placeholder={l.trackExpiry ? "Required" : "Optional"} className={smallDateInputClass} />
                    </td>
                    <td>
                      <button type="button" onClick={() => removeLine(l.key)} className="rounded p-1 text-muted-foreground hover:text-red-600" aria-label="Remove line">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Field label="Notes (condition on arrival, shortages)">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} className="w-full text-sm" />
        </Field>
      </div>
    </Modal>
  );
}
