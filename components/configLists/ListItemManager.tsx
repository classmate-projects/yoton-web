"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, Plus, Trash2, Upload, X } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import ToggleButton from "@/components/ToggleButton";
import EditIcon from "@/public/icons/EditIcon";
import SearchIcon from "@/public/icons/SearchIcon";
import { ConfigListService } from "@/services/configList.service";
import { ConfigListType, ListItemType } from "@/types/configList.type";

const errorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "response" in error) {
    const resp = (error as { response?: { data?: { message?: string } } }).response;
    return resp?.data?.message || fallback;
  }
  return fallback;
};

interface ListItemManagerProps {
  listType: ConfigListType;
  // Used in UI copy: "Add to {itemLabel}", "Upload N {itemLabel}(s)", etc.
  itemLabel: string;
}

// Shared CRUD + bulk-upload widget behind every admin-managed code/picklist screen —
// used both as the tab content on the generic Configurable Lists page and standalone
// on single-purpose pages like ICD Codes. Callers own the page header/hint copy and,
// if they let the admin switch listType (like a tab bar), should mount this with
// key={listType} so each list gets a clean instance instead of carrying over another
// list's in-progress form/bulk-upload state.
export default function ListItemManager({ listType, itemLabel }: ListItemManagerProps) {
  const [items, setItems] = useState<ListItemType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [form, setForm] = useState({ name: "", code: "", sortOrder: "0" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", code: "", sortOrder: "0" });

  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkMode, setBulkMode] = useState<"paste" | "excel">("paste");
  const [bulkText, setBulkText] = useState("");
  const [isBulkUploading, setIsBulkUploading] = useState(false);

  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelRows, setExcelRows] = useState<{ name: string; code?: string }[]>([]);
  const [excelSkipped, setExcelSkipped] = useState(0);
  const [isParsingExcel, setIsParsingExcel] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const PAGE_SIZE = 100;
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Large lists (ICD codes especially) can run into the thousands, so search runs
  // server-side via the same ?search= param the doctor-workbench pickers already
  // use — debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 350);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  // A new search/list jumps back to page 1 - staying on e.g. page 40 of the old
  // result set makes no sense against a freshly filtered one.
  useEffect(() => {
    setPage(1);
  }, [listType, debouncedSearch]);

  const fetchItems = async () => {
    try {
      setIsLoading(true);
      const res = await ConfigListService.get(listType, debouncedSearch, page, PAGE_SIZE);
      setItems(res.data || []);
      setTotalCount(res.totalCount ?? 0);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load list"));
      setItems([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listType, debouncedSearch, page]);

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

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([["Code", "Description"]]);
    ws["!cols"] = [{ wch: 16 }, { wch: 60 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `${itemLabel.replace(/\s+/g, "_")}_Upload_Template.xlsx`);
  };

  const handleExcelFile = async (file: File) => {
    try {
      setIsParsingExcel(true);
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      const parsed = raw
        .map((row) => {
          const entries = Object.entries(row);
          const codeEntry = entries.find(([k]) => k.trim().toLowerCase() === "code");
          const descEntry = entries.find(([k]) => ["description", "name"].includes(k.trim().toLowerCase()));
          return {
            name: String(descEntry?.[1] ?? "").trim(),
            code: String(codeEntry?.[1] ?? "").trim() || undefined,
          };
        })
        .filter((row) => row.name);

      if (parsed.length === 0) {
        toast.error('No usable rows found — the file needs "Code" and "Description" columns');
        setExcelFile(null);
        setExcelRows([]);
        setExcelSkipped(0);
        return;
      }

      setExcelFile(file);
      setExcelRows(parsed);
      setExcelSkipped(raw.length - parsed.length);
    } catch {
      toast.error("Could not read that file — please upload a .xlsx, .xls, or .csv file");
      setExcelFile(null);
      setExcelRows([]);
      setExcelSkipped(0);
    } finally {
      setIsParsingExcel(false);
    }
  };

  const clearExcelFile = () => {
    setExcelFile(null);
    setExcelRows([]);
    setExcelSkipped(0);
  };

  // Fire-and-forget on purpose: called without awaiting so the admin can switch
  // tabs/pages immediately after clicking Upload. The floating sonner toast is
  // mounted once in the root layout, so it keeps tracking progress from wherever
  // this promise chain happens to be running, chunk by chunk, regardless of
  // whether this component instance is still mounted by the time it finishes —
  // the closing fetchItems() call just becomes a harmless no-op if it isn't.
  const uploadExcelInBackground = async (rows: { name: string; code?: string }[]) => {
    const CHUNK_SIZE = 1000;
    const toastId = `excel-upload-${listType}`;
    const total = rows.length;
    let uploaded = 0;
    let failed = 0;

    toast.loading(`Uploading ${itemLabel}… 0 / ${total}`, { id: toastId, duration: Infinity });

    for (let i = 0; i < total; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      try {
        await ConfigListService.bulkUpload(listType, { items: chunk });
        uploaded += chunk.length;
      } catch {
        failed += chunk.length;
      }
      toast.loading(`Uploading ${itemLabel}… ${uploaded + failed} / ${total}`, { id: toastId, duration: Infinity });
    }

    if (failed === 0) {
      toast.success(`${uploaded} ${itemLabel} code(s) uploaded successfully`, { id: toastId, duration: 5000 });
    } else {
      toast.error(`${uploaded} uploaded, ${failed} failed — check the file and re-upload the failed rows`, {
        id: toastId,
        duration: 8000,
      });
    }

    await fetchItems();
  };

  const runExcelUpload = () => {
    if (excelRows.length === 0) return;
    const rows = excelRows;
    clearExcelFile();
    setShowBulkUpload(false);
    void uploadExcelInBackground(rows);
  };

  return (
    <>
      <div className="card p-6 mb-6 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground/90">Add to {itemLabel}</h2>
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
          <div className="flex flex-col gap-3 border-t border-border pt-3">
            <div className="flex gap-2">
              <button
                onClick={() => setBulkMode("paste")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  bulkMode === "paste" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                Paste Text
              </button>
              <button
                onClick={() => setBulkMode("excel")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  bulkMode === "excel" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                Excel File
              </button>
            </div>

            {bulkMode === "paste" ? (
              <div className="flex flex-col gap-2">
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
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">
                  Download the template, fill in <code>Code</code> and <code>Description</code> for each{" "}
                  {itemLabel.toLowerCase()} entry, then upload it back here. Uploads run in the background — a
                  floating status indicator tracks progress while you keep working.
                </p>
                <button
                  onClick={downloadTemplate}
                  className="self-start flex items-center gap-2 rounded-lg border border-primary/30 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
                >
                  <Download size={15} /> Download Template (.xlsx)
                </button>

                <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                  <FileSpreadsheet size={22} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {isParsingExcel ? "Reading file…" : "Click to choose a filled-in .xlsx, .xls, or .csv file"}
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleExcelFile(file);
                      e.target.value = "";
                    }}
                  />
                </label>

                {excelFile && (
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
                    <div className="text-xs text-foreground/90">
                      <span className="font-semibold">{excelFile.name}</span> — {excelRows.length} row(s) ready
                      {excelSkipped > 0 && (
                        <span className="text-muted-foreground"> ({excelSkipped} skipped, missing Description)</span>
                      )}
                    </div>
                    <button onClick={clearExcelFile} title="Remove file" className="text-muted-foreground hover:text-red-500">
                      <X size={16} />
                    </button>
                  </div>
                )}

                <button
                  onClick={runExcelUpload}
                  disabled={excelRows.length === 0}
                  className="self-start flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <Upload size={15} /> Upload {excelRows.length || ""} Item(s)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground/90">{itemLabel} List</h2>
          <div className="relative w-72">
            <span className="absolute left-3 top-1/2 -translate-y-1/2">
              <SearchIcon color="#555" />
            </span>
            <input
              type="text"
              placeholder={`Search ${itemLabel}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12! pr-4 py-2 rounded-lg bg-(--color-highlight) border border-border focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>
        </div>
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
                  {debouncedSearch ? `No ${itemLabel} matches "${debouncedSearch}".` : `No items in ${itemLabel} yet.`}
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

        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border text-xs text-muted-foreground">
          <span>
            {totalCount === 0
              ? "0 results"
              : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalCount)} of ${totalCount}`}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
