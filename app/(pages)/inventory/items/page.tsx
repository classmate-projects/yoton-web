"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Printer, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import SearchableSelect, { fieldSelectClass, standaloneSelectClass } from "@/components/SearchableSelect";
import { InventoryService } from "@/services/inventory.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency } from "@/lib/currency";
import { useRegion } from "@/lib/region";
import type { InventoryItem, InventoryVendor, SaveInventoryItemPayload } from "@/types/inventory.type";
import BarcodeLabels, { type InventoryLabel } from "@/components/inventory/BarcodeLabels";
import ItemStockDetail from "@/components/inventory/ItemStockDetail";
import { Field, Modal, PageBar, Pager, dangerButton, inputClass, primaryButton, qty, secondaryButton, useInventory } from "@/components/inventory/inventoryUi";

const PAGE_SIZE = 50;

const emptyItem = (): SaveInventoryItemPayload => ({
  code: "",
  name: "",
  itemType: "Consumable",
  category: "",
  description: "",
  unit: "Piece",
  purchaseUnit: "",
  unitsPerPurchaseUnit: 1,
  trackBatch: false,
  trackExpiry: false,
  barcode: "",
  reorderLevel: 0,
  reorderQuantity: 0,
  defaultVendorId: null,
  sellingPrice: 0,
  taxPercent: 0,
  isBillable: false,
  serviceCode: "",
  isActive: true,
});

function ItemForm({ item, vendors, onClose, onSaved }: { item: InventoryItem | null; vendors: InventoryVendor[]; onClose: () => void; onSaved: () => void }) {
  const { lookups } = useInventory();
  const region = useRegion();
  const [form, setForm] = useState<SaveInventoryItemPayload>(() => (item ? { ...item, category: item.category ?? "", description: item.description ?? "", purchaseUnit: item.purchaseUnit ?? "", barcode: item.barcode ?? "", serviceCode: item.serviceCode ?? "" } : emptyItem()));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof SaveInventoryItemPayload>(key: K, value: SaveInventoryItemPayload[K]) => setForm((f) => ({ ...f, [key]: value }));
  const num = (v: string) => (v === "" ? 0 : Number(v));
  // A Pharmacy medicine's name, type and price are Pharmacy's (the API keeps them as they are).
  const fromPharmacy = !!item?.medicineId;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, purchaseUnit: form.purchaseUnit || null, defaultVendorId: form.defaultVendorId || null };
      const res = item ? await InventoryService.updateItem(item.itemId, payload) : await InventoryService.createItem(payload);
      toast.success(res.message ?? "Saved");
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't save the item"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!item) return;
    setSaving(true);
    try {
      const res = await InventoryService.deleteItem(item.itemId);
      toast.success(res.message);
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't delete the item"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={item ? `Edit ${item.name}` : "Add item"}
      subtitle={item ? `${item.code} · ${qty(item.totalStock)} ${item.unit} in stock` : "Leave the code empty to number it automatically."}
      onClose={onClose}
      footer={
        <>
          {item && (
            <button type="button" onClick={remove} disabled={saving} className={`${dangerButton} mr-auto`}>
              <Trash2 size={15} /> Delete
            </button>
          )}
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" form="item-form" disabled={saving} className={primaryButton}>
            <Save size={15} /> {saving ? "Saving…" : "Save item"}
          </button>
        </>
      }
    >
      <form id="item-form" onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fromPharmacy && (
          <p className="rounded-lg bg-primary/5 px-3 py-2 text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            This is a Pharmacy medicine: its name and price are changed in Pharmacy, and it&apos;s charged through prescriptions and medication orders.
          </p>
        )}
        <Field label="Item name" required className="sm:col-span-2">
          <input value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={200} disabled={fromPharmacy} className={inputClass} />
        </Field>
        <Field label="Code / SKU">
          <input value={form.code} onChange={(e) => set("code", e.target.value)} maxLength={50} placeholder="Automatic" className={inputClass} />
        </Field>
        <Field label="Type" required>
          <SearchableSelect value={form.itemType} onChange={(v) => set("itemType", v as SaveInventoryItemPayload["itemType"])} options={(lookups?.itemTypes ?? []).map((t) => ({ value: t, label: t }))} disabled={fromPharmacy} className={fieldSelectClass} preserveCase />
        </Field>
        <Field label="Category">
          <input value={form.category ?? ""} onChange={(e) => set("category", e.target.value)} list="inventory-categories" maxLength={100} placeholder="e.g. Syringes, Reagents" className={inputClass} />
          <datalist id="inventory-categories">
            {(lookups?.categories ?? []).map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Barcode (manufacturer)" hint="Optional - scanning it finds the item.">
          <input value={form.barcode ?? ""} onChange={(e) => set("barcode", e.target.value)} maxLength={64} className={inputClass} />
        </Field>

        <Field label="Stock unit" required hint="What stock is counted and issued in.">
          <input value={form.unit} onChange={(e) => set("unit", e.target.value)} required maxLength={30} placeholder="Piece, Tablet, ml" className={inputClass} />
        </Field>
        <Field label="Bought in" hint="Leave empty if bought in the stock unit.">
          <input value={form.purchaseUnit ?? ""} onChange={(e) => set("purchaseUnit", e.target.value)} maxLength={30} placeholder="e.g. Box" className={inputClass} />
        </Field>
        <Field label={form.purchaseUnit ? `${form.unit || "Units"} per ${form.purchaseUnit}` : "Units per purchase unit"}>
          <input type="number" min={0} step="any" disabled={!form.purchaseUnit} value={form.purchaseUnit ? form.unitsPerPurchaseUnit : 1} onChange={(e) => set("unitsPerPurchaseUnit", num(e.target.value))} className={inputClass} />
        </Field>

        <Field label={`Reorder level (${form.unit || "units"})`} hint="Main stores flag the item at or below this.">
          <input type="number" min={0} step="any" value={form.reorderLevel} onChange={(e) => set("reorderLevel", num(e.target.value))} className={inputClass} />
        </Field>
        <Field label={`Reorder quantity (${form.unit || "units"})`}>
          <input type="number" min={0} step="any" value={form.reorderQuantity} onChange={(e) => set("reorderQuantity", num(e.target.value))} className={inputClass} />
        </Field>
        <Field label="Default supplier" hint="Used when reorder suggestions become purchase orders.">
          <SearchableSelect value={form.defaultVendorId ?? ""} onChange={(v) => set("defaultVendorId", v || null)} options={[{ value: "", label: "None" }, ...vendors.map((v) => ({ value: v.vendorId, label: v.name }))]} className={fieldSelectClass} preserveCase />
        </Field>

        <Field label={`Selling price per ${form.unit || "unit"}`} hint="Charged when used on a patient (billable items).">
          <input type="number" min={0} step="any" value={form.sellingPrice} onChange={(e) => set("sellingPrice", num(e.target.value))} disabled={fromPharmacy} className={inputClass} />
        </Field>
        {region?.tax.applicable && (
          <Field label={`${region.tax.name} %`}>
            <input type="number" min={0} max={100} step="any" value={form.taxPercent} onChange={(e) => set("taxPercent", num(e.target.value))} className={inputClass} />
          </Field>
        )}
        {region?.tax.serviceCodeLabel && (
          <Field label={region.tax.serviceCodeLabel}>
            <input value={form.serviceCode ?? ""} onChange={(e) => set("serviceCode", e.target.value)} maxLength={30} className={inputClass} />
          </Field>
        )}

        <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-3">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={form.trackBatch} onChange={(e) => set("trackBatch", e.target.checked)} className="h-4 w-4" />
            Track batch / lot numbers
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={form.trackExpiry} onChange={(e) => set("trackExpiry", e.target.checked)} className="h-4 w-4" />
            Track expiry dates (issued first-expiry-first-out; expired stock can&apos;t be issued)
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={form.isBillable} onChange={(e) => set("isBillable", e.target.checked)} disabled={fromPharmacy} className="h-4 w-4" />
            Billable - charged to the patient when used on them
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4" />
            Active (can be ordered, requested and issued)
          </label>
        </div>
        <Field label="Description / specification" className="sm:col-span-2 lg:col-span-3">
          <textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={2} maxLength={1000} className="w-full text-sm" />
        </Field>
      </form>
    </Modal>
  );
}

export default function InventoryItemsPage() {
  const { lookups } = useInventory();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [itemType, setItemType] = useState("");
  const [category, setCategory] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<InventoryVendor[]>([]);
  const [editing, setEditing] = useState<InventoryItem | "new" | null>(null);
  const [viewing, setViewing] = useState<InventoryItem | null>(null);
  const [labels, setLabels] = useState<InventoryLabel[] | null>(null);
  const isStoreTeam = lookups?.isStoreTeam ?? false;

  const load = useCallback(() => {
    InventoryService.items({ search: search.trim() || undefined, itemType: itemType || undefined, category: category || undefined, includeInactive: showInactive, page, pageSize: PAGE_SIZE })
      .then((r) => {
        setItems(r.data);
        setTotal(r.total);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [search, itemType, category, showInactive, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => {
    InventoryService.vendors().then((r) => setVendors(r.data)).catch(() => {});
  }, []);
  useSignalRRefetch(["inventoryChanged"], load);

  return (
    <div className="flex flex-col gap-4">
      <PageBar title="Items" description="Everything the hospital stocks - units, batch and expiry rules, reorder levels and suppliers.">
        <button type="button" onClick={() => setLabels(items.map((i) => ({ code: i.code, title: i.name, lines: [i.code, i.unit] })))} disabled={items.length === 0} className={secondaryButton}>
          <Printer size={15} /> Labels for this page
        </button>
        {isStoreTeam && (
          <button type="button" onClick={() => setEditing("new")} className={primaryButton}>
            <Plus size={15} /> Add item
          </button>
        )}
      </PageBar>
      <div className="flex flex-wrap items-center gap-2">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, code or barcode…" className={`${inputClass} w-72`} />
        <div className="w-48">
          <SearchableSelect value={itemType} onChange={(v) => { setItemType(v); setPage(1); }} options={[{ value: "", label: "All types" }, ...(lookups?.itemTypes ?? []).map((t) => ({ value: t, label: t }))]} className={standaloneSelectClass} preserveCase />
        </div>
        <div className="w-48">
          <SearchableSelect value={category} onChange={(v) => { setCategory(v); setPage(1); }} options={[{ value: "", label: "All categories" }, ...(lookups?.categories ?? []).map((c) => ({ value: c, label: c }))]} className={standaloneSelectClass} preserveCase />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={showInactive} onChange={(e) => { setShowInactive(e.target.checked); setPage(1); }} className="h-4 w-4" /> Show inactive
        </label>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <EmptyState
          illustration="pharmacy"
          title="No items yet"
          description={isStoreTeam ? "Add the items your stores keep - then receive or enter their opening stock." : "No items match."}
          action={isStoreTeam ? { label: "Add item", onClick: () => setEditing("new") } : undefined}
        />
      ) : (
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Item</th>
                <th>Type</th>
                <th>Units</th>
                <th className="text-right">Reorder level</th>
                <th className="text-right">In stock</th>
                <th>Supplier</th>
                <th className="text-right">Last cost</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.itemId} className={`cursor-pointer ${i.isActive ? "" : "opacity-60"}`} onClick={() => (isStoreTeam ? setEditing(i) : setViewing(i))}>
                  <td>
                    <span className="font-medium text-foreground">{i.name}</span>
                    {i.medicineId && <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Pharmacy</span>}
                    <span className="block text-xs text-muted-foreground">
                      {i.code}
                      {i.category ? ` · ${i.category}` : ""}
                      {!i.isActive ? " · inactive" : ""}
                      {i.trackExpiry ? " · expiry" : ""}
                      {i.trackBatch ? " · batch" : ""}
                    </span>
                  </td>
                  <td>{i.itemType}</td>
                  <td>{i.purchaseUnit ? `${i.unit} (${i.purchaseUnit} of ${qty(i.unitsPerPurchaseUnit)})` : i.unit}</td>
                  <td className="text-right tabular-nums">{i.reorderLevel > 0 ? qty(i.reorderLevel) : "—"}</td>
                  <td className="text-right tabular-nums">
                    <button type="button" onClick={(e) => { e.stopPropagation(); setViewing(i); }} className="font-semibold text-primary hover:underline">
                      {qty(i.totalStock)} {i.unit}
                    </button>
                  </td>
                  <td>{i.defaultVendorName ?? "—"}</td>
                  <td className="text-right tabular-nums">{i.lastPurchaseCost ? formatCurrency(i.lastPurchaseCost) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />

      {editing && (
        <ItemForm
          item={editing === "new" ? null : editing}
          vendors={vendors}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {viewing && <ItemStockDetail itemId={viewing.itemId} onClose={() => setViewing(null)} />}
      {labels && <BarcodeLabels labels={labels} onClose={() => setLabels(null)} />}
    </div>
  );
}
