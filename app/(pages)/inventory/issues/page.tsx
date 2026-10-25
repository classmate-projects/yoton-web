"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import SearchableSelect, { standaloneSelectClass } from "@/components/SearchableSelect";
import { InventoryService } from "@/services/inventory.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { formatCurrency } from "@/lib/currency";
import type { IssueSummary } from "@/types/inventory.type";
import { IssueDetail, IssueForm } from "@/components/inventory/Movements";
import { PageBar, Pager, primaryButton, stamp, useInventory } from "@/components/inventory/inventoryUi";

const KINDS = [
  { value: "", label: "All issues" },
  { value: "department", label: "Department use" },
  { value: "patient", label: "Used on patients / dispensed" },
];

export default function IssuesPage() {
  const { myStores, lookups } = useInventory();
  const [rows, setRows] = useState<IssueSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [storeId, setStoreId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [kind, setKind] = useState<"" | "department" | "patient">("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    InventoryService.issues({ storeId: storeId || undefined, departmentId: departmentId || undefined, kind: kind || undefined, page })
      .then((r) => {
        setRows(r.data);
        setTotal(r.total);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [storeId, departmentId, kind, page]);
  useEffect(() => {
    load();
  }, [load]);
  useSignalRRefetch(["inventoryChanged"], load);

  return (
    <div className="flex flex-col gap-4">
      <PageBar title="Issues" description="Stock used up: issued to departments, used on patients or dispensed by Pharmacy - with any unused stock returned.">
        <button type="button" onClick={() => setCreating(true)} className={primaryButton}>
          <Plus size={15} /> Issue stock
        </button>
      </PageBar>
      <div className="flex flex-wrap gap-2">
        <div className="w-56">
          <SearchableSelect value={storeId} onChange={(v) => { setStoreId(v); setPage(1); }} options={[{ value: "", label: "All my stores" }, ...myStores.map((s) => ({ value: s.storeId, label: s.name }))]} className={standaloneSelectClass} preserveCase />
        </div>
        <div className="w-56">
          <SearchableSelect value={departmentId} onChange={(v) => { setDepartmentId(v); setPage(1); }} options={[{ value: "", label: "All departments" }, ...(lookups?.departments ?? []).map((d) => ({ value: d.departmentId, label: d.name }))]} className={standaloneSelectClass} preserveCase />
        </div>
        <div className="w-60">
          <SearchableSelect value={kind} onChange={(v) => { setKind(v as typeof kind); setPage(1); }} options={KINDS} className={standaloneSelectClass} preserveCase />
        </div>
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState illustration="clipboard" title="Nothing issued yet" />
      ) : (
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Number</th>
                <th>Store</th>
                <th>For</th>
                <th>What</th>
                <th>Issued</th>
                <th className="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.issueId} className="cursor-pointer" onClick={() => setOpenId(i.issueId)}>
                  <td className="whitespace-nowrap font-medium text-foreground">{i.number}</td>
                  <td>{i.storeName}</td>
                  <td>
                    {i.patientName ?? i.departmentName ?? "—"}
                    {i.patientName ? (
                      i.departmentName && <span className="block text-xs text-muted-foreground">{i.departmentName}</span>
                    ) : (
                      i.issuedTo && <span className="block text-xs text-muted-foreground">Handed to {i.issuedTo}</span>
                    )}
                  </td>
                  <td>
                    {i.sourceLabel}
                    {i.purpose && i.purpose !== i.sourceLabel && <span className="line-clamp-2 text-xs text-muted-foreground">{i.purpose}</span>}
                  </td>
                  <td>
                    {i.issuedByName}
                    <span className="block text-xs text-muted-foreground">{stamp(i.createdAt)}</span>
                  </td>
                  <td className="text-right tabular-nums">{formatCurrency(i.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pageSize={50} total={total} onPage={setPage} />
      {openId && <IssueDetail id={openId} onClose={() => setOpenId(null)} />}
      {creating && (
        <IssueForm
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
