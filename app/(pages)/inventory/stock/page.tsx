"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import SearchableSelect, { standaloneSelectClass } from "@/components/SearchableSelect";
import { InventoryService } from "@/services/inventory.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { formatCurrency } from "@/lib/currency";
import { packText } from "@/lib/packQuantity";
import type { StockRow } from "@/types/inventory.type";
import ItemStockDetail from "@/components/inventory/ItemStockDetail";
import { PageBar, day, inputClass, qty, useInventory } from "@/components/inventory/inventoryUi";

const FILTERS = [
  { value: "", label: "All items" },
  { value: "inStock", label: "In stock" },
  { value: "low", label: "Below reorder level" },
  { value: "expiring", label: "Expiring / expired" },
];

function StockPageInner() {
  const params = useSearchParams();
  const { myStores, lookups } = useInventory();
  const [storeId, setStoreId] = useState("");
  const [search, setSearch] = useState("");
  const [itemType, setItemType] = useState("");
  const [filter, setFilter] = useState(params.get("filter") ?? "");
  const [rows, setRows] = useState<StockRow[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<StockRow | null>(null);

  // Default to the first store (main store first) once the stores load.
  useEffect(() => {
    if (!storeId && myStores.length > 0) setStoreId(myStores[0].storeId);
  }, [myStores, storeId]);

  const load = useCallback(() => {
    if (!storeId) return;
    setLoading(true);
    InventoryService.stock({ storeId, search: search.trim() || undefined, itemType: itemType || undefined, filter: filter || undefined })
      .then((r) => {
        setRows(r.data);
        setTotalValue(r.totalValue);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [storeId, search, itemType, filter]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);
  useSignalRRefetch(["inventoryChanged"], load);

  return (
    <div className="flex flex-col gap-4">
      <PageBar title="Stock" description="What each store holds, its value at cost, reorder status and nearest expiry. Click an item for its batches and item card." />
      <div className="flex flex-wrap gap-2">
        <div className="w-60">
          <SearchableSelect value={storeId} onChange={setStoreId} options={myStores.map((s) => ({ value: s.storeId, label: s.name }))} className={standaloneSelectClass} preserveCase placeholder="Store" />
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search item or code…" className={`${inputClass} w-64`} />
        <div className="w-48">
          <SearchableSelect value={itemType} onChange={setItemType} options={[{ value: "", label: "All types" }, ...(lookups?.itemTypes ?? []).map((t) => ({ value: t, label: t }))]} className={standaloneSelectClass} preserveCase />
        </div>
        <div className="w-56">
          <SearchableSelect value={filter} onChange={setFilter} options={FILTERS} className={standaloneSelectClass} preserveCase />
        </div>
        <span className="ml-auto self-center text-sm text-muted-foreground">
          Value: <span className="font-semibold text-foreground">{formatCurrency(totalValue)}</span>
        </span>
      </div>

      {loading && rows.length === 0 ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState illustration="pharmacy" title="Nothing to show" description={myStores.length === 0 ? "You don't have access to any store yet." : "No items match - or this store holds no stock yet."} />
      ) : (
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Item</th>
                <th>Type</th>
                <th className="text-right">In stock</th>
                <th className="text-right">Value</th>
                <th className="text-right">Reorder level</th>
                <th>Nearest expiry</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.itemId} className="cursor-pointer" onClick={() => setOpen(r)}>
                  <td>
                    <span className="font-medium text-foreground">{r.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {r.code}
                      {r.category ? ` · ${r.category}` : ""}
                    </span>
                  </td>
                  <td>{r.itemType}</td>
                  <td className="text-right tabular-nums">
                    <span className={r.isLow ? "font-semibold text-amber-600" : ""} title={`${qty(r.quantity)} ${r.unit}`}>
                      {packText(r.quantity, r.unit, r.packUnit, r.packSize)}
                    </span>
                    {r.lotCount > 1 && <span className="block text-xs text-muted-foreground">{r.lotCount} batches</span>}
                  </td>
                  <td className="text-right tabular-nums">{formatCurrency(r.value)}</td>
                  <td className="text-right tabular-nums">
                    {r.reorderLevel > 0 ? qty(r.reorderLevel) : "—"}
                    {r.isLow && <span className="block text-xs font-semibold text-amber-600">Reorder</span>}
                  </td>
                  <td>
                    {r.expiredQuantity > 0 && <span className="block text-xs font-semibold text-red-600">{qty(r.expiredQuantity)} expired</span>}
                    {r.nextExpiry ? day(r.nextExpiry) : r.expiredQuantity > 0 ? "" : "—"}
                    {r.expiringQuantity > 0 && <span className="block text-xs text-amber-600">{qty(r.expiringQuantity)} expiring soon</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <ItemStockDetail itemId={open.itemId} row={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

export default function InventoryStockPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <StockPageInner />
    </Suspense>
  );
}
