"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Printer, ScanLine } from "lucide-react";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import SearchableSelect, { standaloneSelectClass } from "@/components/SearchableSelect";
import { AssetsService } from "@/services/assets.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency } from "@/lib/currency";
import type { Asset } from "@/types/assets.type";
import BarcodeLabels, { type InventoryLabel } from "@/components/inventory/BarcodeLabels";
import { AssetDetail, AssetForm } from "@/components/assets/AssetDialogs";
import { CATEGORY_LABELS, DueText, StatusBadge, useAssets } from "@/components/assets/assetsUi";
import { PageBar, Pager, inputClass, primaryButton, secondaryButton } from "@/components/inventory/inventoryUi";

const PAGE_SIZE = 50;

function RegisterInner() {
  const params = useSearchParams();
  const { lookups } = useAssets();
  const [rows, setRows] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [due, setDue] = useState(params.get("due") ?? "");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(params.get("open"));
  const [creating, setCreating] = useState(false);
  const [labels, setLabels] = useState<InventoryLabel[] | null>(null);

  const load = useCallback(() => {
    AssetsService.assets({ search: search.trim() || undefined, category: category || undefined, status: status || undefined, due: due || undefined, page, pageSize: PAGE_SIZE })
      .then((r) => {
        setRows(r.data);
        setTotal(r.total);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [search, category, status, due, page]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);
  useSignalRRefetch(["assetsChanged"], load);

  // A scanner types the tag and presses Enter.
  const scan = async () => {
    const code = search.trim();
    if (!code) return;
    try {
      const res = await AssetsService.scan(code);
      setOpenId(res.data.asset.assetId);
      setSearch("");
    } catch (err) {
      toast.error(apiErrorMessage(err, `Nothing matches "${code}"`));
    }
  };

  const team = lookups?.isAssetTeam ?? false;
  return (
    <div className="flex flex-col gap-4">
      <PageBar title="Asset register" description="Every piece of equipment, furniture and IT device, one by one. Scan a label to open it.">
        {team && (
          <>
            <button
              type="button"
              onClick={() => setLabels(rows.map((a) => ({ code: a.assetTag, title: a.name, lines: [a.serialNumber ? `S/N ${a.serialNumber}` : CATEGORY_LABELS[a.category], a.departmentName ?? ""].filter(Boolean) })))}
              disabled={rows.length === 0}
              className={secondaryButton}
            >
              <Printer size={15} /> Labels for this page
            </button>
            <button type="button" onClick={() => setCreating(true)} className={primaryButton}>
              <Plus size={15} /> Register an asset
            </button>
          </>
        )}
      </PageBar>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-72">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void scan();
              }
            }}
            placeholder="Search or scan a tag…"
            className={`${inputClass} pr-9`}
          />
          <ScanLine size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
        </div>
        <div className="w-48">
          <SearchableSelect value={category} onChange={(v) => { setCategory(v); setPage(1); }} options={[{ value: "", label: "All categories" }, ...(lookups?.categories ?? []).map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))]} className={standaloneSelectClass} preserveCase />
        </div>
        <div className="w-48">
          <SearchableSelect
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            options={[
              { value: "", label: "All in the register" },
              { value: "InUse", label: "In use" },
              { value: "InStore", label: "In store" },
              { value: "UnderMaintenance", label: "Under maintenance" },
              { value: "OutOfService", label: "Out of service" },
              { value: "Disposed", label: "Disposed of" },
            ]}
            className={standaloneSelectClass}
            preserveCase
          />
        </div>
        <div className="w-52">
          <SearchableSelect
            value={due}
            onChange={(v) => { setDue(v); setPage(1); }}
            options={[
              { value: "", label: "Any schedule" },
              { value: "maintenance", label: "Servicing due" },
              { value: "calibration", label: "Calibration due" },
              { value: "warranty", label: "Warranty ending" },
            ]}
            className={standaloneSelectClass}
            preserveCase
          />
        </div>
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState illustration="clipboard" title="No assets here" action={team ? { label: "Register an asset", onClick: () => setCreating(true) } : undefined} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Tag</th>
                <th>Asset</th>
                <th>Where</th>
                <th>Status</th>
                <th>Servicing</th>
                <th>Calibration</th>
                <th className="text-right">Value now</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.assetId} className="cursor-pointer" onClick={() => setOpenId(a.assetId)}>
                  <td className="whitespace-nowrap font-medium text-foreground">{a.assetTag}</td>
                  <td>
                    <span className="font-medium text-foreground">{a.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[CATEGORY_LABELS[a.category], [a.make, a.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
                    </span>
                  </td>
                  <td>
                    {a.departmentName ?? "—"}
                    {a.location && <span className="block text-xs text-muted-foreground">{a.location}</span>}
                  </td>
                  <td>
                    <StatusBadge status={a.status} />
                    {a.openWorkOrders > 0 && <span className="block text-xs text-muted-foreground">{a.openWorkOrders} open job{a.openWorkOrders === 1 ? "" : "s"}</span>}
                  </td>
                  <td className="whitespace-nowrap text-xs">{a.maintenanceIntervalDays ? <DueText days={a.maintenanceDueInDays} /> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="whitespace-nowrap text-xs">{a.requiresCalibration ? <DueText days={a.calibrationDueInDays} /> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="whitespace-nowrap text-right tabular-nums">{formatCurrency(a.bookValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
      {openId && <AssetDetail id={openId} onClose={() => { setOpenId(null); load(); }} />}
      {creating && (
        <AssetForm
          asset={null}
          onClose={() => setCreating(false)}
          onSaved={(id) => {
            setCreating(false);
            setOpenId(id);
            load();
          }}
        />
      )}
      {labels && <BarcodeLabels labels={labels} onClose={() => setLabels(null)} />}
    </div>
  );
}

export default function AssetRegisterPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <RegisterInner />
    </Suspense>
  );
}
