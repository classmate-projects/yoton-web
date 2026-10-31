"use client";

import { useState } from "react";
import { Plus, Save } from "lucide-react";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import SearchableSelect, { fieldSelectClass } from "@/components/SearchableSelect";
import { InventoryService } from "@/services/inventory.service";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency } from "@/lib/currency";
import type { InventoryStore, SaveInventoryStorePayload } from "@/types/inventory.type";
import { Field, Modal, PageBar, STORE_TYPE_LABELS, inputClass, primaryButton, secondaryButton, useInventory } from "@/components/inventory/inventoryUi";

function StoreForm({ store, onClose, onSaved }: { store: InventoryStore | null; onClose: () => void; onSaved: () => void }) {
  const { lookups, stores } = useInventory();
  const [form, setForm] = useState<SaveInventoryStorePayload>(() =>
    store
      ? { name: store.name, storeType: store.storeType, branchId: store.branchId, departmentId: store.departmentId, supplyingStoreId: store.supplyingStoreId, managerUserId: store.managerUserId, isActive: store.isActive }
      : { name: "", storeType: "Ward", branchId: lookups?.branches.find((b) => b.isMain)?.branchId ?? null, departmentId: null, supplyingStoreId: stores.find((s) => s.storeType === "Main" && s.isActive)?.storeId ?? null, managerUserId: null, isActive: true }
  );
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof SaveInventoryStorePayload>(k: K, v: SaveInventoryStorePayload[K]) => setForm((f) => ({ ...f, [k]: v }));
  const isMain = form.storeType === "Main";

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, supplyingStoreId: isMain ? null : form.supplyingStoreId };
      const res = store ? await InventoryService.updateStore(store.storeId, payload) : await InventoryService.createStore(payload);
      toast.success(res.message ?? "Saved");
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't save the store"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={store ? `Edit ${store.name}` : "Add store"}
      subtitle="Department stores ask their supplying store for stock; their department's staff run them from Store Requests."
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" form="store-form" disabled={saving} className={primaryButton}>
            <Save size={15} /> Save store
          </button>
        </>
      }
    >
      <form id="store-form" onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name" required>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={100} placeholder="e.g. Ward A store" className={inputClass} />
        </Field>
        <Field label="Type" required>
          <SearchableSelect value={form.storeType} onChange={(v) => set("storeType", v as SaveInventoryStorePayload["storeType"])} options={(lookups?.storeTypes ?? []).map((t) => ({ value: t, label: STORE_TYPE_LABELS[t] ?? t }))} className={fieldSelectClass} preserveCase />
        </Field>
        <Field label="Branch">
          <SearchableSelect value={form.branchId ?? ""} onChange={(v) => set("branchId", v || null)} options={[{ value: "", label: "—" }, ...(lookups?.branches ?? []).map((b) => ({ value: b.branchId, label: b.name }))]} className={fieldSelectClass} preserveCase />
        </Field>
        <Field label="Department" hint="Its staff (with Store Requests) run this store.">
          <SearchableSelect value={form.departmentId ?? ""} onChange={(v) => set("departmentId", v || null)} options={[{ value: "", label: "None" }, ...(lookups?.departments ?? []).map((d) => ({ value: d.departmentId, label: d.name }))]} className={fieldSelectClass} preserveCase />
        </Field>
        {!isMain && (
          <Field label="Supplied by" required>
            <SearchableSelect value={form.supplyingStoreId ?? ""} onChange={(v) => set("supplyingStoreId", v || null)} options={stores.filter((s) => s.isActive && s.storeId !== store?.storeId).map((s) => ({ value: s.storeId, label: s.name }))} className={fieldSelectClass} preserveCase placeholder="Choose…" />
          </Field>
        )}
        <Field label="Store manager" hint="Approves this store's orders, adjustments and counts (admin always can).">
          <SearchableSelect value={form.managerUserId ?? ""} onChange={(v) => set("managerUserId", v || null)} options={[{ value: "", label: "None" }, ...(lookups?.staff ?? []).map((u) => ({ value: u.userId, label: `${u.name} (${u.role})` }))]} className={fieldSelectClass} preserveCase />
        </Field>
        <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4" /> In use
        </label>
      </form>
    </Modal>
  );
}

export default function StoresPage() {
  const { stores, lookups, reload } = useInventory();
  const [editing, setEditing] = useState<InventoryStore | "new" | null>(null);
  const canEdit = lookups?.isStoreTeam ?? false;

  return (
    <div className="flex flex-col gap-4">
      <PageBar title="Stores" description="Each branch's main store and the department stores it supplies.">
        {canEdit && (
          <button type="button" onClick={() => setEditing("new")} className={primaryButton}>
            <Plus size={15} /> Add store
          </button>
        )}
      </PageBar>
      {stores.length === 0 ? (
        <EmptyState illustration="building" title="No stores yet" />
      ) : (
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Store</th>
                <th>Type</th>
                <th>Branch</th>
                <th>Department</th>
                <th>Supplied by</th>
                <th>Manager</th>
                <th className="text-right">Stock value</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => (
                <tr key={s.storeId} className={`${canEdit ? "cursor-pointer" : ""} ${s.isActive ? "" : "opacity-60"}`} onClick={() => canEdit && setEditing(s)}>
                  <td className="font-medium text-foreground">
                    {s.name}
                    {!s.isActive && <span className="block text-xs text-muted-foreground">not in use</span>}
                  </td>
                  <td>{STORE_TYPE_LABELS[s.storeType] ?? s.storeType}</td>
                  <td>{s.branchName ?? "—"}</td>
                  <td>{s.departmentName ?? "—"}</td>
                  <td>{s.supplyingStoreName ?? (s.storeType === "Main" ? "Suppliers" : "—")}</td>
                  <td>{s.managerName ?? "—"}</td>
                  <td className="text-right tabular-nums">{formatCurrency(s.stockValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <StoreForm
          store={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
