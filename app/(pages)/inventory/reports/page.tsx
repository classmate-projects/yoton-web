"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import DatePicker from "@/components/DatePicker";
import SearchableSelect, { standaloneSelectClass } from "@/components/SearchableSelect";
import { InventoryService } from "@/services/inventory.service";
import { formatCurrency } from "@/lib/currency";
import { dateInputClass, day, inputClass, primaryButton, qty, stamp, todayInput, useInventory } from "@/components/inventory/inventoryUi";

type ReportKey = "valuation" | "expiry" | "consumption" | "purchases" | "movement" | "non-moving";

const TABS: { key: ReportKey; label: string; description: string; period?: boolean; days?: boolean }[] = [
  { key: "valuation", label: "Valuation", description: "Stock on hand at what each batch cost." },
  { key: "expiry", label: "Expiry", description: "Batches expiring within the window, and anything already expired.", days: true },
  { key: "consumption", label: "Consumption", description: "Stock issued for use (net of returns), by department.", period: true },
  { key: "purchases", label: "Purchases", description: "Goods received from suppliers, and returns to them.", period: true },
  { key: "movement", label: "Movement", description: "Opening stock, what came in, what went out and what's left.", period: true },
  { key: "non-moving", label: "Non-moving", description: "Stock that hasn't been used, moved or written off for a while.", days: true },
];

interface Column<T> {
  header: string;
  money?: boolean;
  number?: boolean;
  get: (row: T) => string | number | null | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

function columnsFor(key: ReportKey): Column<Row>[] {
  switch (key) {
    case "valuation":
      return [
        { header: "Store", get: (r) => r.storeName },
        { header: "Code", get: (r) => r.code },
        { header: "Item", get: (r) => r.itemName },
        { header: "Type", get: (r) => r.itemType },
        { header: "Quantity", number: true, get: (r) => r.quantity },
        { header: "Unit", get: (r) => r.unit },
        { header: "Average cost", money: true, get: (r) => r.averageCost },
        { header: "Value", money: true, get: (r) => r.value },
      ];
    case "expiry":
      return [
        { header: "Store", get: (r) => r.storeName },
        { header: "Item", get: (r) => r.itemName },
        { header: "Batch", get: (r) => r.batchNumber ?? "" },
        { header: "Expiry", get: (r) => day(r.expiryDate) },
        { header: "Days left", number: true, get: (r) => r.daysToExpiry },
        { header: "Quantity", number: true, get: (r) => r.quantity },
        { header: "Unit", get: (r) => r.unit },
        { header: "Value", money: true, get: (r) => r.value },
      ];
    case "consumption":
      return [
        { header: "Department", get: (r) => r.department },
        { header: "Code", get: (r) => r.code },
        { header: "Item", get: (r) => r.itemName },
        { header: "Quantity", number: true, get: (r) => r.quantity },
        { header: "Unit", get: (r) => r.unit },
        { header: "Value", money: true, get: (r) => r.value },
      ];
    case "purchases":
      return [
        { header: "GRN", get: (r) => r.number },
        { header: "Received", get: (r) => day(r.receivedDate) },
        { header: "Supplier", get: (r) => r.vendorName },
        { header: "Store", get: (r) => r.storeName },
        { header: "Order", get: (r) => r.purchaseOrderNumber ?? "Direct" },
        { header: "Invoice", get: (r) => r.invoiceNumber ?? "" },
        { header: "Value", money: true, get: (r) => r.subtotal },
        { header: "Tax", money: true, get: (r) => r.taxTotal },
        { header: "Total", money: true, get: (r) => r.total },
      ];
    case "movement":
      return [
        { header: "Store", get: (r) => r.storeName },
        { header: "Item", get: (r) => r.itemName },
        { header: "Unit", get: (r) => r.unit },
        { header: "Opening", number: true, get: (r) => r.openingQuantity },
        { header: "In", number: true, get: (r) => r.inQuantity },
        { header: "Out", number: true, get: (r) => r.outQuantity },
        { header: "Closing", number: true, get: (r) => r.closingQuantity },
        { header: "Opening value", money: true, get: (r) => r.openingValue },
        { header: "Closing value", money: true, get: (r) => r.closingValue },
      ];
    default:
      return [
        { header: "Store", get: (r) => r.storeName },
        { header: "Item", get: (r) => r.itemName },
        { header: "Quantity", number: true, get: (r) => r.quantity },
        { header: "Unit", get: (r) => r.unit },
        { header: "Value", money: true, get: (r) => r.value },
        { header: "Last used / moved", get: (r) => (r.lastMovedAt ? stamp(r.lastMovedAt) : "Never") },
      ];
  }
}

function ReportsInner() {
  const params = useSearchParams();
  const { myStores, lookups } = useInventory();
  const [tab, setTab] = useState<ReportKey>((params.get("tab") as ReportKey) ?? "valuation");
  const [storeId, setStoreId] = useState("");
  const firstOfMonth = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  })();
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(todayInput());
  const [days, setDays] = useState("90");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const meta = TABS.find((t) => t.key === tab)!;

  const load = useCallback(() => {
    setLoading(true);
    InventoryService.report(tab, { storeId: storeId || undefined, from: meta.period ? from : undefined, to: meta.period ? to : undefined, days: meta.days ? Number(days) || 90 : undefined })
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [tab, storeId, from, to, days, meta.period, meta.days]);
  useEffect(() => {
    load();
  }, [load]);

  const rows: Row[] = !data ? [] : Array.isArray(data) ? data : data.items ?? data.rows ?? data.receipts ?? [];
  const columns = columnsFor(tab);

  const summary: { label: string; value: string }[] = !data
    ? []
    : tab === "valuation"
      ? [{ label: "Total value", value: formatCurrency(data.totalValue) }, ...data.byStore.map((s: Row) => ({ label: s.store, value: formatCurrency(s.value) }))]
      : tab === "consumption"
        ? [{ label: "Total consumed", value: formatCurrency(data.totalValue) }, ...data.byDepartment.slice(0, 5).map((d: Row) => ({ label: d.department, value: formatCurrency(d.value) }))]
        : tab === "purchases"
          ? [
              { label: "Received", value: formatCurrency(data.total) },
              ...(data.taxTotal > 0 ? [{ label: "Of which tax", value: formatCurrency(data.taxTotal) }] : []),
              { label: "Returned to suppliers", value: formatCurrency(data.returnsTotal) },
            ]
          : tab === "non-moving"
            ? [{ label: "Value not moving", value: formatCurrency(data.totalValue) }]
            : tab === "expiry"
              ? [
                  { label: "Expired", value: formatCurrency(rows.filter((r) => r.isExpired).reduce((s, r) => s + r.value, 0)) },
                  { label: `Expiring in ${days} days`, value: formatCurrency(rows.filter((r) => !r.isExpired).reduce((s, r) => s + r.value, 0)) },
                ]
              : [];

  const exportExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const header = columns.map((c) => c.header);
      const body = rows.map((r) => columns.map((c) => (c.money || c.number ? Number(c.get(r) ?? 0) : c.get(r) ?? "")));
      const title = `${meta.label}${meta.period ? ` ${from} to ${to}` : ""}${storeId ? ` - ${myStores.find((s) => s.storeId === storeId)?.name ?? ""}` : ""}`;
      const sheet = XLSX.utils.aoa_to_sheet([[title], [], header, ...body]);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, meta.label);
      XLSX.writeFile(book, `inventory-${tab}-${todayInput()}.xlsx`);
    } catch {
      toast.error("Couldn't export the report");
    } finally {
      setExporting(false);
    }
  };

  if (lookups && !lookups.isStoreTeam) return <EmptyState illustration="chart" title="Inventory reports are for the store team" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => { setTab(t.key); setData(null); }} className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{meta.description}</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-56">
          <SearchableSelect value={storeId} onChange={setStoreId} options={[{ value: "", label: "All stores" }, ...myStores.map((s) => ({ value: s.storeId, label: s.name }))]} className={standaloneSelectClass} preserveCase />
        </div>
        {meta.period && (
          <>
            <div className="w-44">
              <DatePicker value={from} onChange={setFrom} max={to} className={dateInputClass} />
            </div>
            <div className="w-44">
              <DatePicker value={to} onChange={setTo} min={from} max={todayInput()} className={dateInputClass} />
            </div>
          </>
        )}
        {meta.days && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {tab === "expiry" ? "Expiring within" : "Not moved for"}
            <input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} className={`${inputClass} w-24`} />
            days
          </label>
        )}
        <button type="button" onClick={exportExcel} disabled={exporting || rows.length === 0} className={`${primaryButton} ml-auto`}>
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />} Export Excel
        </button>
      </div>

      {summary.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {summary.map((s) => (
            <div key={s.label} className="card p-3">
              <p className="truncate text-xs text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState illustration="chart" title="Nothing for this selection" size="compact" />
      ) : (
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.header} className={c.money || c.number ? "text-right" : ""}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={tab === "expiry" && r.isExpired ? "text-red-600" : ""}>
                  {columns.map((c) => {
                    const v = c.get(r);
                    return (
                      <td key={c.header} className={c.money || c.number ? "text-right tabular-nums" : ""}>
                        {c.money ? formatCurrency(Number(v ?? 0)) : c.number ? qty(Number(v ?? 0)) : v ?? "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function InventoryReportsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ReportsInner />
    </Suspense>
  );
}
