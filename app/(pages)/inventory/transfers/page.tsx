"use client";

import { useCallback, useEffect, useState } from "react";
import { Truck } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import SearchableSelect, { standaloneSelectClass } from "@/components/SearchableSelect";
import { InventoryService } from "@/services/inventory.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { formatCurrency } from "@/lib/currency";
import type { TransferSummary } from "@/types/inventory.type";
import { TransferDetail, TransferForm } from "@/components/inventory/Movements";
import { DocStatus, PageBar, Pager, primaryButton, stamp, useInventory } from "@/components/inventory/inventoryUi";

export default function TransfersPage() {
  const { lookups } = useInventory();
  const [rows, setRows] = useState<TransferSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    InventoryService.transfers({ status: status || undefined, page })
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
      <PageBar title="Transfers" description="Stock moving between stores - it leaves on dispatch and arrives when the receiving store confirms.">
        {lookups?.isStoreTeam && (
          <button type="button" onClick={() => setCreating(true)} className={primaryButton}>
            <Truck size={15} /> New transfer
          </button>
        )}
      </PageBar>
      <div className="w-56">
        <SearchableSelect
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
          options={[{ value: "", label: "All transfers" }, { value: "InTransit", label: "In transit" }, { value: "Received", label: "Received" }, { value: "Cancelled", label: "Called back" }]}
          className={standaloneSelectClass}
          preserveCase
        />
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState illustration="clipboard" title="No transfers" />
      ) : (
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Number</th>
                <th>From → to</th>
                <th>Status</th>
                <th>Requisition</th>
                <th>Dispatched</th>
                <th className="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.transferId} className="cursor-pointer" onClick={() => setOpenId(t.transferId)}>
                  <td className="font-medium text-foreground">
                    {t.number}
                    {t.isReturn && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Return</span>}
                  </td>
                  <td>
                    {t.fromStoreName} → {t.toStoreName}
                  </td>
                  <td>
                    <DocStatus status={t.status} />
                    {t.canReceive && <span className="block text-xs font-semibold text-primary">Waiting for you</span>}
                  </td>
                  <td>{t.requisitionNumber ?? "—"}</td>
                  <td>
                    {t.dispatchedByName}
                    <span className="block text-xs text-muted-foreground">{stamp(t.dispatchedAt)}</span>
                  </td>
                  <td className="text-right tabular-nums">{formatCurrency(t.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pageSize={50} total={total} onPage={setPage} />
      {openId && <TransferDetail id={openId} onClose={() => setOpenId(null)} />}
      {creating && (
        <TransferForm
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
