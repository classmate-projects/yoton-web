"use client";

import { useCallback, useEffect, useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import DatePicker from "@/components/DatePicker";
import SearchableSelect, { standaloneSelectClass } from "@/components/SearchableSelect";
import { AssetsService } from "@/services/assets.service";
import { formatCurrency } from "@/lib/currency";
import type { AssetCategory, AssetStatus, WorkOrderKind } from "@/types/assets.type";
import { CATEGORY_LABELS, KIND_LABELS, useAssets } from "@/components/assets/assetsUi";
import { dateInputClass, day, primaryButton, stamp, todayInput } from "@/components/inventory/inventoryUi";

type ReportKey = "register" | "maintenance";

interface RegisterRow {
  assetTag: string;
  name: string;
  category: AssetCategory;
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  department: string | null;
  location: string | null;
  status: AssetStatus;
  purchaseDate: string | null;
  purchaseCost: number;
  accumulatedDepreciation: number;
  bookValue: number;
  warrantyEndDate: string | null;
  nextMaintenanceDue: string | null;
  nextCalibrationDue: string | null;
}

interface MaintenanceRow {
  number: string;
  completedAt: string;
  kind: WorkOrderKind;
  assetTag: string | null;
  assetName: string | null;
  department: string | null;
  outcome: string | null;
  serviceCost: number;
  partsCost: number;
  totalCost: number;
  downtimeHours: number;
}

interface RegisterReport {
  totalCost: number;
  totalDepreciation: number;
  totalBookValue: number;
  byCategory: { category: AssetCategory; count: number; bookValue: number }[];
  rows: RegisterRow[];
}

interface MaintenanceReport {
  totalCost: number;
  byKind: { kind: WorkOrderKind; count: number; cost: number }[];
  rows: MaintenanceRow[];
}

export default function AssetReportsPage() {
  const { lookups } = useAssets();
  const [tab, setTab] = useState<ReportKey>("register");
  const [category, setCategory] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [from, setFrom] = useState(() => `${todayInput().slice(0, 8)}01`);
  const [to, setTo] = useState(todayInput());
  const [register, setRegister] = useState<RegisterReport | null>(null);
  const [maintenance, setMaintenance] = useState<MaintenanceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const request =
      tab === "register"
        ? AssetsService.report<RegisterReport>("register", { category: category || undefined, departmentId: departmentId || undefined }).then((r) => setRegister(r.data))
        : AssetsService.report<MaintenanceReport>("maintenance", { from, to }).then((r) => setMaintenance(r.data));
    request.catch(() => toast.error("Couldn't load the report")).finally(() => setLoading(false));
  }, [tab, category, departmentId, from, to]);
  useEffect(() => {
    if (lookups?.isAssetTeam) load();
  }, [lookups, load]);

  const exportExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const sheet =
        tab === "register"
          ? XLSX.utils.aoa_to_sheet([
              ["Asset register and value", `as of ${todayInput()}`],
              [],
              ["Tag", "Asset", "Category", "Make", "Model", "Serial", "Department", "Location", "Status", "Bought", "Cost", "Depreciation", "Value now", "Warranty ends", "Next servicing", "Next calibration"],
              ...(register?.rows ?? []).map((r) => [
                r.assetTag, r.name, CATEGORY_LABELS[r.category], r.make ?? "", r.model ?? "", r.serialNumber ?? "", r.department ?? "", r.location ?? "", r.status,
                r.purchaseDate ?? "", r.purchaseCost, r.accumulatedDepreciation, r.bookValue, r.warrantyEndDate ?? "", r.nextMaintenanceDue ?? "", r.nextCalibrationDue ?? "",
              ]),
            ])
          : XLSX.utils.aoa_to_sheet([
              ["Maintenance costs", `${from} to ${to}`],
              [],
              ["Work order", "Completed", "Kind", "Tag", "Asset", "Department", "Outcome", "Service", "Parts", "Total", "Hours from report to done"],
              ...(maintenance?.rows ?? []).map((r) => [r.number, r.completedAt, KIND_LABELS[r.kind], r.assetTag ?? "", r.assetName ?? "", r.department ?? "", r.outcome ?? "", r.serviceCost, r.partsCost, r.totalCost, r.downtimeHours]),
            ]);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, tab === "register" ? "Register" : "Maintenance");
      XLSX.writeFile(book, `assets-${tab}-${todayInput()}.xlsx`);
    } catch {
      toast.error("Couldn't export the report");
    } finally {
      setExporting(false);
    }
  };

  if (lookups && !lookups.isAssetTeam) return <EmptyState illustration="chart" title="Asset reports are for the maintenance team" />;
  const rowCount = tab === "register" ? register?.rows.length ?? 0 : maintenance?.rows.length ?? 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1 border-b border-border">
        {(
          [
            { key: "register", label: "Register and value" },
            { key: "maintenance", label: "Maintenance costs" },
          ] as const
        ).map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {tab === "register" ? (
          <>
            <div className="w-52">
              <SearchableSelect value={category} onChange={setCategory} options={[{ value: "", label: "All categories" }, ...(lookups?.categories ?? []).map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))]} className={standaloneSelectClass} preserveCase />
            </div>
            <div className="w-56">
              <SearchableSelect value={departmentId} onChange={setDepartmentId} options={[{ value: "", label: "All departments" }, ...(lookups?.departments ?? []).map((d) => ({ value: d.departmentId, label: d.name }))]} className={standaloneSelectClass} preserveCase />
            </div>
          </>
        ) : (
          <>
            <div className="w-44">
              <DatePicker value={from} onChange={setFrom} max={to} className={dateInputClass} />
            </div>
            <div className="w-44">
              <DatePicker value={to} onChange={setTo} min={from} max={todayInput()} className={dateInputClass} />
            </div>
          </>
        )}
        <button type="button" onClick={exportExcel} disabled={exporting || rowCount === 0} className={`${primaryButton} ml-auto`}>
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />} Export Excel
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : tab === "register" && register ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Cost", value: formatCurrency(register.totalCost) },
              { label: "Depreciation so far", value: formatCurrency(register.totalDepreciation) },
              { label: "Value now", value: formatCurrency(register.totalBookValue) },
              ...register.byCategory.slice(0, 3).map((c) => ({ label: `${CATEGORY_LABELS[c.category]} (${c.count})`, value: formatCurrency(c.bookValue) })),
            ].map((s) => (
              <div key={s.label} className="card p-3">
                <p className="truncate text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold text-foreground">{s.value}</p>
              </div>
            ))}
          </div>
          {register.rows.length === 0 ? (
            <EmptyState illustration="chart" title="Nothing for this selection" size="compact" />
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Tag</th>
                    <th>Asset</th>
                    <th>Department</th>
                    <th>Bought</th>
                    <th className="text-right">Cost</th>
                    <th className="text-right">Depreciation</th>
                    <th className="text-right">Value now</th>
                  </tr>
                </thead>
                <tbody>
                  {register.rows.map((r) => (
                    <tr key={r.assetTag}>
                      <td className="whitespace-nowrap font-medium text-foreground">{r.assetTag}</td>
                      <td>
                        {r.name}
                        <span className="block text-xs text-muted-foreground">{CATEGORY_LABELS[r.category]}</span>
                      </td>
                      <td>{r.department ?? "—"}</td>
                      <td className="whitespace-nowrap">{day(r.purchaseDate)}</td>
                      <td className="whitespace-nowrap text-right tabular-nums">{formatCurrency(r.purchaseCost)}</td>
                      <td className="whitespace-nowrap text-right tabular-nums">{formatCurrency(r.accumulatedDepreciation)}</td>
                      <td className="whitespace-nowrap text-right tabular-nums">{formatCurrency(r.bookValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : tab === "maintenance" && maintenance ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[{ label: "Total", value: formatCurrency(maintenance.totalCost) }, ...maintenance.byKind.map((k) => ({ label: `${KIND_LABELS[k.kind]} (${k.count})`, value: formatCurrency(k.cost) }))].map((s) => (
              <div key={s.label} className="card p-3">
                <p className="truncate text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold text-foreground">{s.value}</p>
              </div>
            ))}
          </div>
          {maintenance.rows.length === 0 ? (
            <EmptyState illustration="chart" title="No work finished in this period" size="compact" />
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Work order</th>
                    <th>Asset</th>
                    <th>Kind</th>
                    <th>Completed</th>
                    <th className="text-right">Service</th>
                    <th className="text-right">Parts</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenance.rows.map((r) => (
                    <tr key={r.number}>
                      <td className="whitespace-nowrap font-medium text-foreground">{r.number}</td>
                      <td>
                        {r.assetName}
                        <span className="block text-xs text-muted-foreground">
                          {r.assetTag}
                          {r.department ? ` · ${r.department}` : ""}
                        </span>
                      </td>
                      <td>{KIND_LABELS[r.kind]}</td>
                      <td className="whitespace-nowrap">{stamp(r.completedAt)}</td>
                      <td className="whitespace-nowrap text-right tabular-nums">{formatCurrency(r.serviceCost)}</td>
                      <td className="whitespace-nowrap text-right tabular-nums">{formatCurrency(r.partsCost)}</td>
                      <td className="whitespace-nowrap text-right tabular-nums">{formatCurrency(r.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
