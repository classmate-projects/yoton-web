"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Save } from "lucide-react";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import { InventoryService } from "@/services/inventory.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { apiErrorMessage } from "@/lib/apiError";
import { useRegion } from "@/lib/region";
import type { InventoryVendor, SaveInventoryVendorPayload } from "@/types/inventory.type";
import { Field, Modal, PageBar, inputClass, primaryButton, secondaryButton, useInventory } from "@/components/inventory/inventoryUi";

const empty: SaveInventoryVendorPayload = {
  name: "",
  code: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  taxRegistrationNumber: "",
  paymentTermsDays: null,
  notes: "",
  isActive: true,
};

function VendorForm({ vendor, onClose, onSaved }: { vendor: InventoryVendor | null; onClose: () => void; onSaved: () => void }) {
  const region = useRegion();
  const [form, setForm] = useState<SaveInventoryVendorPayload>(() => (vendor ? { ...vendor } : { ...empty }));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof SaveInventoryVendorPayload>(k: K, v: SaveInventoryVendorPayload[K]) => setForm((f) => ({ ...f, [k]: v }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = vendor ? await InventoryService.updateVendor(vendor.vendorId, form) : await InventoryService.createVendor(form);
      toast.success(res.message ?? "Saved");
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't save the supplier"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title={vendor ? `Edit ${vendor.name}` : "Add supplier"}
      onClose={onClose}
      width="max-w-3xl"
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" form="vendor-form" disabled={saving} className={primaryButton}>
            <Save size={15} /> Save supplier
          </button>
        </>
      }
    >
      <form id="vendor-form" onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name" required>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={200} className={inputClass} />
        </Field>
        <Field label="Supplier code">
          <input value={form.code ?? ""} onChange={(e) => set("code", e.target.value)} maxLength={50} className={inputClass} />
        </Field>
        <Field label="Contact person">
          <input value={form.contactPerson ?? ""} onChange={(e) => set("contactPerson", e.target.value)} maxLength={200} className={inputClass} />
        </Field>
        <Field label="Phone">
          <input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} maxLength={50} className={inputClass} />
        </Field>
        <Field label="Email">
          <input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} maxLength={200} className={inputClass} />
        </Field>
        <Field label="Payment terms (days)">
          <input type="number" min={0} max={365} value={form.paymentTermsDays ?? ""} onChange={(e) => set("paymentTermsDays", e.target.value === "" ? null : Number(e.target.value))} className={inputClass} />
        </Field>
        {region?.tax.applicable && region.tax.registrationLabel && (
          <Field label={`Supplier's ${region.tax.registrationLabel}`}>
            <input value={form.taxRegistrationNumber ?? ""} onChange={(e) => set("taxRegistrationNumber", e.target.value)} maxLength={50} className={inputClass} />
          </Field>
        )}
        <Field label="Address" className="sm:col-span-2">
          <input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} maxLength={500} className={inputClass} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={2} maxLength={1000} className="w-full text-sm" />
        </Field>
        <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4" /> Active (new orders can be raised)
        </label>
      </form>
    </Modal>
  );
}

export default function SuppliersPage() {
  const { lookups } = useInventory();
  const [vendors, setVendors] = useState<InventoryVendor[]>([]);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<InventoryVendor | "new" | null>(null);

  const load = useCallback(() => {
    InventoryService.vendors({ includeInactive: showInactive, search: search.trim() || undefined })
      .then((r) => setVendors(r.data))
      .catch(() => setVendors([]))
      .finally(() => setLoading(false));
  }, [showInactive, search]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);
  useSignalRRefetch(["inventoryChanged"], load);

  const canEdit = lookups?.isStoreTeam ?? false;

  return (
    <div className="flex flex-col gap-4">
      <PageBar title="Suppliers" description="Who the hospital buys from.">
        {canEdit && (
          <button type="button" onClick={() => setEditing("new")} className={primaryButton}>
            <Plus size={15} /> Add supplier
          </button>
        )}
      </PageBar>
      <div className="flex flex-wrap items-center gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search supplier…" className={`${inputClass} w-72`} />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="h-4 w-4" /> Show inactive
        </label>
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : vendors.length === 0 ? (
        <EmptyState illustration="building" title="No suppliers yet" action={canEdit ? { label: "Add supplier", onClick: () => setEditing("new") } : undefined} />
      ) : (
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Terms</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.vendorId} className={`${canEdit ? "cursor-pointer" : ""} ${v.isActive ? "" : "opacity-60"}`} onClick={() => canEdit && setEditing(v)}>
                  <td>
                    <span className="font-medium text-foreground">{v.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {v.code ?? ""}
                      {!v.isActive ? " inactive" : ""}
                    </span>
                  </td>
                  <td>{v.contactPerson ?? "—"}</td>
                  <td>{v.phone ?? "—"}</td>
                  <td>{v.email ?? "—"}</td>
                  <td>{v.paymentTermsDays != null ? `${v.paymentTermsDays} days` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <VendorForm
          vendor={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
