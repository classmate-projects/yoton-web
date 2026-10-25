"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import SearchableSelect, { standaloneSelectClass } from "@/components/SearchableSelect";
import { InventoryService } from "@/services/inventory.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import type { RequisitionSummary } from "@/types/inventory.type";
import { RequisitionDetail, RequisitionForm } from "@/components/inventory/Movements";
import { DocStatus, PageBar, Pager, day, primaryButton, stamp } from "@/components/inventory/inventoryUi";

const STATUS = [
  { value: "open", label: "Open" },
  { value: "", label: "All" },
  { value: "Issued", label: "Sent" },
  { value: "Rejected", label: "Declined" },
  { value: "Cancelled", label: "Cancelled" },
];

function RequisitionsInner() {
  const params = useSearchParams();
  const [rows, setRows] = useState<RequisitionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("open");
  const [direction, setDirection] = useState<"" | "incoming" | "outgoing">("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(params.get("open"));
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    InventoryService.requisitions({ status: status || undefined, direction: direction || undefined, page })
      .then((r) => {
        setRows(r.data);
        setTotal(r.total);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [status, direction, page]);
  useEffect(() => {
    load();
  }, [load]);
  useSignalRRefetch(["inventoryChanged"], load);

  return (
    <div className="flex flex-col gap-4">
      <PageBar title="Requisitions" description="Department stores asking their supplying store for stock - fulfilled with transfers.">
        <button type="button" onClick={() => setCreating(true)} className={primaryButton}>
          <Plus size={15} /> Request stock
        </button>
      </PageBar>
      <div className="flex flex-wrap gap-2">
        <div className="w-48">
          <SearchableSelect value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={STATUS} className={standaloneSelectClass} preserveCase />
        </div>
        <div className="w-56">
          <SearchableSelect
            value={direction}
            onChange={(v) => { setDirection(v as typeof direction); setPage(1); }}
            options={[{ value: "", label: "Asked of / by my stores" }, { value: "incoming", label: "Asked of my stores" }, { value: "outgoing", label: "Raised by my stores" }]}
            className={standaloneSelectClass}
            preserveCase
          />
        </div>
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState illustration="clipboard" title="No requisitions" />
      ) : (
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Number</th>
                <th>From → asked of</th>
                <th>Status</th>
                <th>Items</th>
                <th>Needed by</th>
                <th>Raised</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.requisitionId} className="cursor-pointer" onClick={() => setOpenId(r.requisitionId)}>
                  <td className="font-medium text-foreground">
                    {r.number}
                    {r.priority === "Urgent" && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">Urgent</span>}
                  </td>
                  <td>
                    {r.requestingStoreName} → {r.supplyingStoreName}
                  </td>
                  <td>
                    <DocStatus status={r.status} />
                  </td>
                  <td>{r.lineCount}</td>
                  <td>{day(r.requiredDate)}</td>
                  <td>
                    {r.requestedByName}
                    <span className="block text-xs text-muted-foreground">{stamp(r.createdAt)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pageSize={50} total={total} onPage={setPage} />
      {openId && <RequisitionDetail id={openId} onClose={() => setOpenId(null)} />}
      {creating && (
        <RequisitionForm
          onClose={() => setCreating(false)}
          onSaved={(id) => {
            setCreating(false);
            setOpenId(id);
            load();
          }}
        />
      )}
    </div>
  );
}

export default function RequisitionsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <RequisitionsInner />
    </Suspense>
  );
}
