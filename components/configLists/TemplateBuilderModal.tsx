"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, History, Plus, Save, Trash2, X } from "lucide-react";
import { ListTemplateService } from "@/services/configList.service";
import {
  ColumnDataType,
  ListTemplate,
  ListTemplateColumn,
  ListTemplateSnapshot,
  MappedField,
  SaveListTemplatePayload,
} from "@/types/configList.type";

const DATA_TYPES: { value: ColumnDataType; label: string }[] = [
  { value: "Text", label: "Text" },
  { value: "Number", label: "Number" },
  { value: "Date", label: "Date" },
  { value: "Boolean", label: "Yes / No" },
  { value: "Dropdown", label: "Dropdown" },
];

const MAPPED_FIELDS: { value: string; label: string }[] = [
  { value: "null", label: "Custom (extra data)" },
  { value: "name", label: "Name (required field)" },
  { value: "code", label: "Code" },
  { value: "department", label: "Department" },
  { value: "cashPrice", label: "Cash Price" },
];

interface DraftColumn {
  id: string;
  columnName: string;
  label: string;
  dataType: ColumnDataType;
  isRequired: boolean;
  sortOrder: number;
  dropdownOptionsJson: string;
  mappedField: MappedField;
}

interface TemplateBuilderModalProps {
  listType: string;
  listLabel: string;
  onClose: () => void;
  onSaved: () => void;
}

function newDraft(sortOrder: number): DraftColumn {
  return {
    id: crypto.randomUUID(),
    columnName: "",
    label: "",
    dataType: "Text",
    isRequired: false,
    sortOrder,
    dropdownOptionsJson: "",
    mappedField: null,
  };
}

function fromExisting(col: ListTemplateColumn): DraftColumn {
  return {
    id: col.listTemplateColumnId,
    columnName: col.columnName,
    label: col.label,
    dataType: col.dataType,
    isRequired: col.isRequired,
    sortOrder: col.sortOrder,
    dropdownOptionsJson: col.dropdownOptionsJson ?? "",
    mappedField: col.mappedField ?? null,
  };
}

function getDefaultColumns(listType: string): DraftColumn[] {
  if (listType === "Procedure") {
    return [
      { id: "d0", columnName: "department", label: "Department", dataType: "Text", isRequired: false, sortOrder: 0, dropdownOptionsJson: "", mappedField: "department" },
      { id: "d1", columnName: "code", label: "CPT Code", dataType: "Text", isRequired: false, sortOrder: 1, dropdownOptionsJson: "", mappedField: "code" },
      { id: "d2", columnName: "name", label: "Service Description", dataType: "Text", isRequired: true, sortOrder: 2, dropdownOptionsJson: "", mappedField: "name" },
      { id: "d3", columnName: "cashPrice", label: "Cash Price", dataType: "Number", isRequired: false, sortOrder: 3, dropdownOptionsJson: "", mappedField: "cashPrice" },
    ];
  }
  return [
    { id: "d0", columnName: "code", label: "Code", dataType: "Text", isRequired: false, sortOrder: 0, dropdownOptionsJson: "", mappedField: "code" },
    { id: "d1", columnName: "name", label: "Description", dataType: "Text", isRequired: true, sortOrder: 1, dropdownOptionsJson: "", mappedField: "name" },
  ];
}

export default function TemplateBuilderModal({ listType, listLabel, onClose, onSaved }: TemplateBuilderModalProps) {
  const [columns, setColumns] = useState<DraftColumn[]>([newDraft(0)]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ListTemplateSnapshot[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [expandedSnapshot, setExpandedSnapshot] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const res = await ListTemplateService.get(listType);
        const tpl: ListTemplate | null = res.data;
        if (tpl && tpl.columns.length > 0) {
          setColumns(tpl.columns.map(fromExisting));
          setCurrentVersion(tpl.version);
        } else {
          setColumns(getDefaultColumns(listType));
          setCurrentVersion(null);
        }
      } catch {
        toast.error("Failed to load template");
        setColumns(getDefaultColumns(listType));
      } finally {
        setIsLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listType]);

  const loadHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const res = await ListTemplateService.getHistory(listType);
      setHistory(res.data || []);
    } catch {
      toast.error("Failed to load template history");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const toggleHistory = () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next && history.length === 0) loadHistory();
  };

  const addColumn = () =>
    setColumns((prev) => [...prev, newDraft(prev.length)]);

  const removeColumn = (id: string) => {
    setColumns((prev) => {
      if (prev.length <= 1) { toast.error("A template needs at least one column"); return prev; }
      return prev.filter((c) => c.id !== id).map((c, i) => ({ ...c, sortOrder: i }));
    });
  };

  const updateColumn = (id: string, patch: Partial<DraftColumn>) =>
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setColumns((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next.map((c, i) => ({ ...c, sortOrder: i }));
    });
  };

  const moveDown = (idx: number) => {
    setColumns((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next.map((c, i) => ({ ...c, sortOrder: i }));
    });
  };

  const save = async () => {
    for (const col of columns) {
      if (!col.label.trim()) { toast.error("Every column must have a title"); return; }
      if (col.dataType === "Dropdown" && !col.dropdownOptionsJson.trim()) {
        toast.error(`Column "${col.label}" is Dropdown but has no options`); return;
      }
    }
    if (!columns.some((c) => c.mappedField === "name")) {
      toast.error('At least one column must map to "Name (required field)"'); return;
    }

    const payload: SaveListTemplatePayload = {
      columns: columns.map((c, i) => ({
        columnName: c.columnName.trim() || undefined,
        label: c.label.trim(),
        dataType: c.dataType,
        isRequired: c.isRequired,
        sortOrder: i,
        dropdownOptionsJson: c.dataType === "Dropdown" ? c.dropdownOptionsJson : null,
        mappedField: c.mappedField,
      })),
    };

    try {
      setIsSaving(true);
      const res = await ListTemplateService.save(listType, payload);
      const saved: ListTemplate = res.data;
      setCurrentVersion(saved.version);
      toast.success(`Template saved (version ${saved.version})`);
      onSaved();
    } catch {
      toast.error("Failed to save template");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-xl bg-card shadow-xl border border-border">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Configure Excel Template</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {listLabel} — define columns for bulk upload
              {currentVersion != null && (
                <span className="ml-2 bg-muted rounded-full px-2 py-0.5 text-[10px] text-muted-foreground">
                  v{currentVersion}
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Loading…</div>
          ) : (
            <>
              {/* Grid table */}
              <div className="rounded-lg border border-border overflow-hidden">
                {/* Column headers */}
                <div className="grid bg-muted/60 border-b border-border px-3 py-2.5 text-xs font-semibold text-muted-foreground"
                  style={{ gridTemplateColumns: "28px 1fr 140px 160px 60px 32px" }}>
                  <span></span>
                  <span>Title</span>
                  <span>Data Type</span>
                  <span>Maps To</span>
                  <span className="text-center">Not Null</span>
                  <span></span>
                </div>

                {/* Rows */}
                {columns.map((col, idx) => (
                  <div key={col.id} className="flex flex-col border-b border-border last:border-0">
                    <div
                      className="grid items-center gap-2 px-3 py-2 hover:bg-muted/20 transition-colors"
                      style={{ gridTemplateColumns: "28px 1fr 140px 160px 60px 32px" }}
                    >
                      {/* Order arrows */}
                      <div className="flex flex-col items-center gap-0">
                        <button
                          onClick={() => moveUp(idx)}
                          disabled={idx === 0}
                          className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-25 transition-colors"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          onClick={() => moveDown(idx)}
                          disabled={idx === columns.length - 1}
                          className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-25 transition-colors"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>

                      {/* Title */}
                      <input
                        placeholder="Column title"
                        value={col.label}
                        onChange={(e) => updateColumn(col.id, { label: e.target.value })}
                        className="h-8 text-xs w-full"
                      />

                      {/* Data type */}
                      <select
                        value={col.dataType}
                        onChange={(e) => updateColumn(col.id, { dataType: e.target.value as ColumnDataType })}
                        className="h-8 text-xs"
                      >
                        {DATA_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>

                      {/* Maps to */}
                      <select
                        value={col.mappedField ?? "null"}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateColumn(col.id, { mappedField: v === "null" ? null : (v as MappedField) });
                        }}
                        className="h-8 text-xs"
                      >
                        {MAPPED_FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>

                      {/* Not null / mandatory */}
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={col.isRequired}
                          onChange={(e) => updateColumn(col.id, { isRequired: e.target.checked })}
                          className="w-4 h-4 accent-primary cursor-pointer"
                          title="Mandatory (not null)"
                        />
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => removeColumn(col.id)}
                        className="flex items-center justify-center rounded p-1 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Dropdown options row — only shown for Dropdown type */}
                    {col.dataType === "Dropdown" && (
                      <div className="px-3 pb-2">
                        <input
                          placeholder='Options as JSON array, e.g. ["Option A","Option B"]'
                          value={col.dropdownOptionsJson}
                          onChange={(e) => updateColumn(col.id, { dropdownOptionsJson: e.target.value })}
                          className="h-8 text-xs font-mono w-full"
                        />
                      </div>
                    )}
                  </div>
                ))}

                {/* Add row */}
                <button
                  onClick={addColumn}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-xs text-primary hover:bg-primary/5 transition-colors border-t border-border"
                >
                  <Plus size={13} /> Add Column
                </button>
              </div>

              <p className="text-[11px] text-muted-foreground">
                <strong>Maps To</strong> connects the Excel column to a standard database field.
                Use <em>Custom (extra data)</em> for additional columns specific to your workflow.
                At least one column must map to <em>Name</em>.
              </p>

              {/* Version history */}
              {currentVersion != null && (
                <div className="border-t border-border pt-3">
                  <button
                    onClick={toggleHistory}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <History size={13} />
                    Version History
                    {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>

                  {showHistory && (
                    <div className="mt-3 flex flex-col gap-2">
                      {isLoadingHistory && <p className="text-xs text-muted-foreground">Loading…</p>}
                      {!isLoadingHistory && history.length === 0 && (
                        <p className="text-xs text-muted-foreground">No previous versions yet.</p>
                      )}
                      {history.map((snap) => (
                        <div key={snap.snapshotId} className="rounded-lg border border-border bg-muted/20 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground/80">Version {snap.version}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(snap.savedAt).toLocaleString()}
                            </span>
                          </div>
                          <button
                            onClick={() => setExpandedSnapshot(expandedSnapshot === snap.snapshotId ? null : snap.snapshotId)}
                            className="mt-1 text-[10px] text-primary hover:underline"
                          >
                            {expandedSnapshot === snap.snapshotId ? "Hide schema" : "View schema"}
                          </button>
                          {expandedSnapshot === snap.snapshotId && (
                            <pre className="mt-2 text-[10px] text-muted-foreground bg-muted/50 rounded p-2 overflow-x-auto max-h-40">
                              {JSON.stringify(JSON.parse(snap.schemaJson), null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={isSaving || isLoading}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Save size={14} />
            {isSaving ? "Saving…" : "Save Template"}
          </button>
        </div>
      </div>
    </div>
  );
}
