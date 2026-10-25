"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import SearchableSelect, { standaloneSelectClass } from "@/components/SearchableSelect";
import { InventoryService } from "@/services/inventory.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { apiErrorMessage } from "@/lib/apiError";
import type { ServiceUsage, ServiceUsageSummary, StockShortfall } from "@/types/inventory.type";
import ItemPicker from "@/components/inventory/ItemPicker";
import { Modal, PageBar, Pager, ReasonPrompt, inputClass, primaryButton, qty, secondaryButton, smallInputClass, stamp, useInventory } from "@/components/inventory/inventoryUi";

const CATEGORIES = [
  { value: "", label: "All tests and procedures" },
  { value: "Lab", label: "Lab tests" },
  { value: "Radiology", label: "Scans" },
  { value: "Treatment", label: "Procedures" },
];

const PAGE_SIZE = 50;

// The supplies one test / scan / procedure uses, per order.
function UsageEditor({ listItemId, onClose, onSaved }: { listItemId: string; onClose: () => void; onSaved: () => void }) {
  const [entry, setEntry] = useState<ServiceUsage | null>(null);
  const [lines, setLines] = useState<{ itemId: string; name: string; unit: string; quantity: string; isActive: boolean }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    InventoryService.serviceUsage(listItemId)
      .then((r) => {
        setEntry(r.data);
        setLines(r.data.lines.map((l) => ({ itemId: l.itemId, name: l.name, unit: l.unit, quantity: String(l.quantity), isActive: l.isActive })));
      })
      .catch((err) => toast.error(apiErrorMessage(err, "Couldn't load it")));
  }, [listItemId]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await InventoryService.saveServiceUsage(
        listItemId,
        lines.map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity) || 0 }))
      );
      toast.success(res.message ?? "Saved");
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't save"));
    } finally {
      setSaving(false);
    }
  };

  if (!entry) return null;
  const store = entry.category === "Lab" ? "laboratory store" : entry.category === "Radiology" ? "radiology store" : "store of the department that does it";
  return (
    <Modal
      title={entry.name}
      subtitle={`${entry.code ? `${entry.code} · ` : ""}When one is finished, these come out of the ${store} (times the quantity ordered).`}
      onClose={onClose}
      width="max-w-3xl"
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving} className={primaryButton}>
            <Save size={15} /> Save
          </button>
        </>
      }
    >
      {/* Tall enough for the item search's list to open without being cut off. */}
      <div className="flex min-h-80 flex-col gap-3">
        <ItemPicker
          includeMedicines
          onPick={(item) =>
            lines.some((l) => l.itemId === item.itemId)
              ? toast.info(`${item.name} is already listed`)
              : setLines((ls) => [...ls, { itemId: item.itemId, name: item.name, unit: item.unit, quantity: "1", isActive: item.isActive }])
          }
        />
        {lines.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing yet - this one doesn&apos;t use up any stock.</p>
        ) : (
          <table className="table-compact table-no-row-hover w-full text-sm">
            <thead>
              <tr>
                <th>Item</th>
                <th className="w-40">Per order</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.itemId}>
                  <td>
                    {l.name}
                    {!l.isActive && <span className="block text-xs text-amber-600">No longer active - it won&apos;t be taken</span>}
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={l.quantity}
                        onChange={(e) => setLines((ls) => ls.map((x) => (x.itemId === l.itemId ? { ...x, quantity: e.target.value } : x)))}
                        className={smallInputClass}
                      />
                      <span className="shrink-0 text-xs text-muted-foreground">{l.unit}</span>
                    </div>
                  </td>
                  <td>
                    <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.itemId !== l.itemId))} className="rounded p-1 text-muted-foreground hover:text-red-600" aria-label={`Remove ${l.name}`}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  );
}

function SuppliesTab() {
  const [rows, setRows] = useState<ServiceUsageSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [configuredOnly, setConfiguredOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(() => {
    InventoryService.serviceUsages({ search: search.trim() || undefined, category: category || undefined, configuredOnly, page, pageSize: PAGE_SIZE })
      .then((r) => {
        setRows(r.data);
        setTotal(r.total);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [search, category, configuredOnly, page]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search test, scan or procedure…" className={`${inputClass} w-72`} />
        <div className="w-56">
          <SearchableSelect value={category} onChange={(v) => { setCategory(v); setPage(1); }} options={CATEGORIES} className={standaloneSelectClass} preserveCase />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={configuredOnly} onChange={(e) => { setConfiguredOnly(e.target.checked); setPage(1); }} className="h-4 w-4" /> Only ones that use stock
        </label>
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState illustration="clipboard" title="Nothing matches" size="compact" />
      ) : (
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Test / procedure</th>
                <th>Code</th>
                <th>Kind</th>
                <th className="text-right">Items used</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.listItemId} className="cursor-pointer" onClick={() => setEditing(r.listItemId)}>
                  <td className="font-medium text-foreground">{r.name}</td>
                  <td>{r.code ?? "—"}</td>
                  <td>{r.category === "Lab" ? "Lab test" : r.category === "Radiology" ? "Scan" : r.category === "Treatment" ? "Procedure" : r.category}</td>
                  <td className="text-right tabular-nums">{r.itemCount > 0 ? r.itemCount : <span className="text-muted-foreground">None</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
      {editing && (
        <UsageEditor
          listItemId={editing}
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

function ShortfallsTab() {
  const [rows, setRows] = useState<StockShortfall[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"open" | "checked" | "all">("open");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<StockShortfall | null>(null);

  const load = useCallback(() => {
    InventoryService.shortfalls({ status, page })
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

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Patient care never waits for stock: when a dose, test or procedure used more than a store had on record, what was there was taken and the rest is listed here.
        It usually means a delivery or transfer wasn&apos;t entered, or the count is off - correct the stock with a stock count or an adjustment, then mark it checked.
      </p>
      <div className="w-56">
        <SearchableSelect
          value={status}
          onChange={(v) => { setStatus(v as typeof status); setPage(1); }}
          options={[{ value: "open", label: "To check" }, { value: "checked", label: "Checked" }, { value: "all", label: "All" }]}
          className={standaloneSelectClass}
          preserveCase
        />
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState illustration="clipboard" title={status === "open" ? "Nothing to check" : "Nothing here"} size="compact" />
      ) : (
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>When</th>
                <th>Item</th>
                <th className="text-right">Not on record</th>
                <th>Why</th>
                <th>Used for</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.shortfallId}>
                  <td className="whitespace-nowrap">
                    {stamp(r.createdAt)}
                    <span className="block text-xs text-muted-foreground">{r.userName ?? ""}</span>
                  </td>
                  <td>
                    {r.itemName}
                    <span className="block text-xs text-muted-foreground">{r.storeName ?? "No store"}</span>
                  </td>
                  <td className="whitespace-nowrap text-right tabular-nums">
                    {qty(r.quantity)} {r.unit}
                  </td>
                  <td>{r.reason}</td>
                  <td>
                    {r.sourceLabel}
                    {r.patientName && <span className="block text-xs text-muted-foreground">{r.patientName}</span>}
                  </td>
                  <td className="text-right">
                    {r.resolvedAt ? (
                      <span className="text-xs text-muted-foreground">
                        Checked by {r.resolvedByName}
                        {r.resolutionNote && <span className="block">{r.resolutionNote}</span>}
                      </span>
                    ) : (
                      <button type="button" onClick={() => setChecking(r)} className={secondaryButton}>
                        <CheckCircle2 size={15} /> Mark checked
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pageSize={50} total={total} onPage={setPage} />
      {checking && (
        <ReasonPrompt
          title={`Checked: ${checking.itemName}`}
          description="What did you find or do? (Marking it checked doesn't change any stock.)"
          confirmLabel="Mark checked"
          required={false}
          onClose={() => setChecking(null)}
          onConfirm={async (note) => {
            try {
              await InventoryService.resolveShortfall(checking.shortfallId, note || undefined);
              toast.success("Marked as checked");
              setChecking(null);
              load();
            } catch (err) {
              toast.error(apiErrorMessage(err, "Couldn't mark it checked"));
            }
          }}
        />
      )}
    </div>
  );
}

function UsageInner() {
  const params = useSearchParams();
  const { lookups } = useInventory();
  const [tab, setTab] = useState<"supplies" | "shortfalls">(params.get("tab") === "shortfalls" ? "shortfalls" : "supplies");
  if (lookups && !lookups.isStoreTeam) return <EmptyState illustration="clipboard" title="Test supplies are set by the store team" />;
  return (
    <div className="flex flex-col gap-4">
      <PageBar
        title="Test supplies"
        description="What each lab test, scan or procedure uses up - taken automatically from the right store when one is finished. Dispensing and nurses' doses are taken automatically too."
      />
      <div className="flex flex-wrap gap-1 border-b border-border">
        {(
          [
            { key: "supplies", label: "Supplies per test" },
            { key: "shortfalls", label: "Used without stock" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "supplies" ? <SuppliesTab /> : <ShortfallsTab />}
    </div>
  );
}

export default function InventoryUsagePage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <UsageInner />
    </Suspense>
  );
}
