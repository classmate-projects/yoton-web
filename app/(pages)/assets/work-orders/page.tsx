"use client";

import { useCallback, useEffect, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import SearchableSelect, { standaloneSelectClass } from "@/components/SearchableSelect";
import { AssetsService } from "@/services/assets.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { formatCurrency } from "@/lib/currency";
import type { WorkOrder } from "@/types/assets.type";
import { WorkOrderDetail } from "@/components/assets/AssetDialogs";
import { KIND_LABELS, StatusBadge, useAssets } from "@/components/assets/assetsUi";
import { PageBar, Pager, day, inputClass, stamp } from "@/components/inventory/inventoryUi";

export default function WorkOrdersPage() {
  const { lookups } = useAssets();
  const [rows, setRows] = useState<WorkOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("open");
  const [kind, setKind] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    AssetsService.workOrders({ status: status || undefined, kind: kind || undefined, search: search.trim() || undefined, page })
      .then((r) => {
        setRows(r.data);
        setTotal(r.total);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [status, kind, search, page]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);
  useSignalRRefetch(["assetsChanged"], load);

  if (lookups && !lookups.isAssetTeam) return <EmptyState illustration="clipboard" title="Work orders are run by the maintenance team" />;
  return (
    <div className="flex flex-col gap-4">
      <PageBar title="Work orders" description="Servicing, repairs and calibration - raised from an asset, a due list or a department's fault report." />
      <div className="flex flex-wrap items-center gap-2">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Number, asset or problem…" className={`${inputClass} w-72`} />
        <div className="w-44">
          <SearchableSelect
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            options={[{ value: "open", label: "Open" }, { value: "Completed", label: "Completed" }, { value: "Cancelled", label: "Cancelled" }, { value: "", label: "All" }]}
            className={standaloneSelectClass}
            preserveCase
          />
        </div>
        <div className="w-44">
          <SearchableSelect value={kind} onChange={(v) => { setKind(v); setPage(1); }} options={[{ value: "", label: "All kinds" }, { value: "Preventive", label: "Servicing" }, { value: "Repair", label: "Repairs" }, { value: "Calibration", label: "Calibration" }]} className={standaloneSelectClass} preserveCase />
        </div>
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState illustration="clipboard" title={status === "open" ? "No open work orders" : "Nothing here"} size="compact" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Number</th>
                <th>Asset</th>
                <th>Job</th>
                <th>Status</th>
                <th>Planned</th>
                <th>Raised</th>
                <th className="text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.workOrderId} className="cursor-pointer" onClick={() => setOpenId(w.workOrderId)}>
                  <td className="whitespace-nowrap font-medium text-foreground">{w.number}</td>
                  <td>
                    {w.assetName}
                    <span className="block text-xs text-muted-foreground">
                      {w.assetTag}
                      {w.departmentName ? ` · ${w.departmentName}` : ""}
                    </span>
                  </td>
                  <td>
                    {KIND_LABELS[w.kind]}
                    {w.priority === "Urgent" && <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">Urgent</span>}
                    <span className="line-clamp-2 text-xs text-muted-foreground">{w.problem}</span>
                  </td>
                  <td>
                    <StatusBadge status={w.status} />
                    {(w.assignedToName || w.vendorName) && <span className="block text-xs text-muted-foreground">{w.assignedToName ?? w.vendorName}</span>}
                  </td>
                  <td className="whitespace-nowrap">{day(w.scheduledFor)}</td>
                  <td className="whitespace-nowrap">
                    {w.reportedByName}
                    <span className="block text-xs text-muted-foreground">{stamp(w.createdAt)}</span>
                  </td>
                  <td className="whitespace-nowrap text-right tabular-nums">{w.status === "Completed" ? formatCurrency(w.totalCost) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pageSize={50} total={total} onPage={setPage} />
      {openId && <WorkOrderDetail id={openId} onClose={() => { setOpenId(null); load(); }} />}
    </div>
  );
}
