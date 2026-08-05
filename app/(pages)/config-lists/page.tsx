"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ListPlus, Plus, Trash2, Upload } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import ToggleButton from "@/components/ToggleButton";
import EditIcon from "@/public/icons/EditIcon";
import { ConfigListService } from "@/services/configList.service";
import { ConfigListType, ListItemType } from "@/types/configList.type";

const LIST_TYPES: { value: ConfigListType; label: string; hint: string }[] = [
  { value: "Diagnosis", label: "Diagnosis", hint: "Searchable in the doctor workbench's Diagnosis section" },
  { value: "Investigation", label: "Investigation", hint: "Searchable when ordering lab/radiology investigations" },
  { value: "Treatment", label: "Treatment", hint: "Searchable in the doctor workbench's Treatment section" },
  { value: "OrderType", label: "Order Type", hint: "Regular, Stat, PRN, IV Push, Oral, Vaginal, Rectal, etc." },
  { value: "Route", label: "Route of Administration", hint: "Oral, Dental, and other routes" },
  { value: "DosageUnit", label: "Dosage Unit", hint: "ml, mg, tablet, capsule, vial, bottle, puff, drops" },
  { value: "Frequency", label: "Frequency", hint: "e.g. Once daily, Twice daily — Code can hold a session pattern like 1111" },
];

const errorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "response" in error) {
    const resp = (error as { response?: { data?: { message?: string } } }).response;
    return resp?.data?.message || fallback;
  }
  return fallback;
};

export default function ConfigListsPage() {
  const [listType, setListType] = useState<ConfigListType>("Diagnosis");
  const [items, setItems] = useState<ListItemType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [form, setForm] = useState({ name: "", code: "", sortOrder: "0" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", code: "", sortOrder: "0" });

  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [isBulkUploading, setIsBulkUploading] = useState(false);

  const fetchItems = async () => {
    try {
      setIsLoading(true);
      const res = await ConfigListService.get(listType);
      setItems(res.data || []);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load list"));
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    setEditingId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listType]);

  const addItem = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      setIsSubmitting(true);
      await ConfigListService.create(listType, {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        sortOrder: form.sortOrder ? Number(form.sortOrder) : 0,
      });
      toast.success("Item added");
      setForm({ name: "", code: "", sortOrder: "0" });
      await fetchItems();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to add item"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (item: ListItemType) => {
    setEditingId(item.listItemId);
    setEditForm({ name: item.name, code: item.code || "", sortOrder: String(item.sortOrder) });
  };

  const saveEdit = async (id: string) => {
    if (!editForm.name.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      await ConfigListService.update(id, {
        name: editForm.name.trim(),
        code: editForm.code.trim() || undefined,
        sortOrder: editForm.sortOrder ? Number(editForm.sortOrder) : 0,
      });
      toast.success("Item updated");
      setEditingId(null);
      await fetchItems();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update item"));
    }
  };

  const toggleActive = async (item: ListItemType) => {
    try {
      await ConfigListService.setActive(item.listItemId, !item.isActive);
      setItems((prev) => prev.map((i) => (i.listItemId === item.listItemId ? { ...i, isActive: !i.isActive } : i)));
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update status"));
    }
  };

  const removeItem = async (id: string, name: string) => {
    toast(
      <span>
        Delete <b className="text-red-500 ml-1">{name}</b> from this list?
      </span>,
      {
        action: {
          label: "Delete",
          onClick: async () => {
            try {
              await ConfigListService.remove(id);
              toast.success("Item deleted");
              await fetchItems();
            } catch (error) {
              toast.error(errorMessage(error, "Failed to delete item"));
            }
          },
        },
        duration: 10000,
        closeButton: true,
      }
    );
  };

  const runBulkUpload = async () => {
    const rows = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, code] = line.split(",").map((part) => part.trim());
        return { name, code: code || undefined };
      })
      .filter((row) => row.name);

    if (rows.length === 0) {
      toast.error("Enter at least one row as \"Name\" or \"Name, Code\"");
      return;
    }

    try {
      setIsBulkUploading(true);
      const res = await ConfigListService.bulkUpload(listType, { items: rows });
      toast.success(res.message || `${rows.length} item(s) uploaded`);
      setBulkText("");
      setShowBulkUpload(false);
      await fetchItems();
    } catch (error) {
      toast.error(errorMessage(error, "Bulk upload failed"));
    } finally {
      setIsBulkUploading(false);
    }
  };

  const activeType = LIST_TYPES.find((t) => t.value === listType)!;

  return (
    <div className="py-8 px-10 h-full overflow-y-auto">
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
          <ListPlus className="text-primary" /> Configurable Lists
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage the picklists used across the doctor workbench — diagnoses, investigations, treatments,
          medication order types, routes, dosage units, and frequencies.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {LIST_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setListType(t.value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              listType === t.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mb-4">{activeType.hint}</p>

      <div className="card p-6 mb-6 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground/90">Add to {activeType.label}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className="h-10 text-sm sm:col-span-2"
          />
          <input
            type="text"
            placeholder="Code (optional)"
            value={form.code}
            onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
            className="h-10 text-sm"
          />
          <input
            type="number"
            placeholder="Sort order"
            value={form.sortOrder}
            onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))}
            className="h-10 text-sm"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={addItem}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Plus size={15} /> Add Item
          </button>
          <button
            onClick={() => setShowBulkUpload((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-primary/30 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
          >
            <Upload size={15} /> Bulk Upload
          </button>
        </div>

        {showBulkUpload && (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              One item per line, as <code>Name</code> or <code>Name, Code</code>.
            </p>
            <textarea
              placeholder={"Hypertension, I10\nType 2 Diabetes, E11.9"}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="w-full min-h-24 text-sm font-mono"
            />
            <button
              onClick={runBulkUpload}
              disabled={isBulkUploading}
              className="self-start flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Upload size={15} /> Upload {bulkText.split("\n").filter((l) => l.trim()).length || ""} Item(s)
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Sort Order</th>
              <th className="text-center">Active</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-16 text-center">
                  <LoadingSpinner />
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-16 text-center text-muted-foreground">
                  No items in {activeType.label} yet.
                </td>
              </tr>
            ) : (
              items.map((item) =>
                editingId === item.listItemId ? (
                  <tr key={item.listItemId}>
                    <td>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                        className="h-9 text-sm"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={editForm.code}
                        onChange={(e) => setEditForm((p) => ({ ...p, code: e.target.value }))}
                        className="h-9 text-sm w-24"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={editForm.sortOrder}
                        onChange={(e) => setEditForm((p) => ({ ...p, sortOrder: e.target.value }))}
                        className="h-9 text-sm w-20"
                      />
                    </td>
                    <td className="text-center text-muted-foreground text-xs">—</td>
                    <td className="text-center">
                      <div className="flex justify-center items-center gap-2">
                        <button
                          onClick={() => saveEdit(item.listItemId)}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs font-semibold text-muted-foreground hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={item.listItemId}>
                    <td className="font-semibold">{item.name}</td>
                    <td>{item.code || "—"}</td>
                    <td>{item.sortOrder}</td>
                    <td className="text-center">
                      <div className="flex justify-center">
                        <ToggleButton checked={item.isActive} onChange={() => toggleActive(item)} />
                      </div>
                    </td>
                    <td className="text-center">
                      <div className="flex justify-center items-center">
                        <button
                          onClick={() => removeItem(item.listItemId, item.name)}
                          title="Delete"
                          className="hover:bg-red-100 ring-transparent hover:ring-red-200 transition-colors duration-150 rounded-full p-2 cursor-pointer mr-2"
                        >
                          <Trash2 size={18} className="text-red-500" />
                        </button>
                        <button
                          title="Edit"
                          onClick={() => startEdit(item)}
                          className="hover:bg-blue-100 ring-transparent hover:ring-blue-200 transition-colors duration-150 rounded-full p-2 cursor-pointer"
                        >
                          <EditIcon color="blue" size={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
