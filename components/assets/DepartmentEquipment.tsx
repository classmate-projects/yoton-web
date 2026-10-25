"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import { AssetsService } from "@/services/assets.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import type { Asset } from "@/types/assets.type";
import { inputClass, secondaryButton } from "@/components/inventory/inventoryUi";
import { AssetDetail, FaultDialog } from "./AssetDialogs";
import { AssetsProvider, CATEGORY_LABELS, StatusBadge } from "./assetsUi";

// A department's own equipment (Store Requests → Equipment): see what's there and report a
// fault, which the maintenance team picks up as a repair work order.
function EquipmentList({ departmentId }: { departmentId: string }) {
  const [rows, setRows] = useState<Asset[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reporting, setReporting] = useState<Asset | null>(null);

  const load = useCallback(() => {
    AssetsService.assets({ departmentId, pageSize: 200 })
      .then((r) => setRows(r.data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [departmentId]);
  useEffect(() => {
    load();
  }, [load]);
  useSignalRRefetch(["assetsChanged"], load);

  if (loading) return <LoadingSpinner />;
  const term = search.trim().toLowerCase();
  const shown = rows.filter((a) => !term || a.name.toLowerCase().includes(term) || a.assetTag.toLowerCase().includes(term) || (a.location ?? "").toLowerCase().includes(term));
  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? (
        <EmptyState illustration="clipboard" title="No equipment registered for your department" size="compact" />
      ) : (
        <>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search equipment…" className={`${inputClass} w-72`} />
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Tag</th>
                  <th>Equipment</th>
                  <th>Where</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((a) => (
                  <tr key={a.assetId} className="cursor-pointer" onClick={() => setOpenId(a.assetId)}>
                    <td className="whitespace-nowrap font-medium text-foreground">{a.assetTag}</td>
                    <td>
                      {a.name}
                      <span className="block text-xs text-muted-foreground">{[CATEGORY_LABELS[a.category], [a.make, a.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td>{a.location ?? "—"}</td>
                    <td>
                      <StatusBadge status={a.status} />
                      {a.openWorkOrders > 0 && <span className="block text-xs text-muted-foreground">Being looked at</span>}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReporting(a);
                        }}
                        className={secondaryButton}
                      >
                        <AlertTriangle size={14} /> Report a fault
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {openId && <AssetDetail id={openId} onClose={() => { setOpenId(null); load(); }} />}
      {reporting && (
        <FaultDialog
          asset={reporting}
          onClose={() => setReporting(null)}
          onSaved={() => {
            setReporting(null);
            load();
          }}
        />
      )}
    </div>
  );
}

export default function DepartmentEquipment({ departmentId }: { departmentId: string | null }) {
  if (!departmentId) return <EmptyState illustration="clipboard" title="This store isn't linked to a department" description="Equipment is listed by department - the store team can set the store's department in Inventory → Stores." size="compact" />;
  return (
    <AssetsProvider>
      <EquipmentList departmentId={departmentId} />
    </AssetsProvider>
  );
}
