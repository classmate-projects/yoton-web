"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRightLeft, CalendarClock, ClipboardList, PackageCheck, PackageX, Wallet } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import SearchableSelect, { standaloneSelectClass } from "@/components/SearchableSelect";
import { InventoryService } from "@/services/inventory.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { formatCurrency } from "@/lib/currency";
import type { InventoryDashboard, PendingApproval } from "@/types/inventory.type";
import { TXN_LABELS, day, qty, stamp, useInventory } from "@/components/inventory/inventoryUi";

const APPROVAL_LINKS: Record<PendingApproval["kind"], string> = {
  purchaseOrder: "/inventory/purchase-orders",
  adjustment: "/inventory/adjustments",
  stockCount: "/inventory/counts",
};

function Tile({ icon, label, value, tone = "default", href }: { icon: React.ReactNode; label: string; value: string; tone?: "default" | "warn" | "danger"; href?: string }) {
  const toneClass = tone === "danger" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-foreground";
  const body = (
    <div className="card flex items-center gap-3 p-4 transition-shadow hover:shadow-lg">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`text-xl font-bold ${toneClass}`}>{value}</p>
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function InventoryDashboardPage() {
  const router = useRouter();
  const { myStores } = useInventory();
  const [storeId, setStoreId] = useState("");
  const [data, setData] = useState<InventoryDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    InventoryService.dashboard({ storeId: storeId || undefined })
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);
  useSignalRRefetch(["inventoryChanged"], load);

  if (loading) return <LoadingSpinner />;
  if (!data) return <EmptyState illustration="chart" title="Couldn't load the dashboard" />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-foreground">Overview</h2>
        <div className="w-64">
          <SearchableSelect
            value={storeId}
            onChange={setStoreId}
            options={[{ value: "", label: "All my stores" }, ...myStores.map((s) => ({ value: s.storeId, label: s.name }))]}
            className={standaloneSelectClass}
            preserveCase
          />
        </div>
      </div>

      {data.openShortfalls > 0 && (
        <Link
          href="/inventory/usage?tab=shortfalls"
          className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <AlertTriangle size={16} className="shrink-0" />
          <span>
            <strong>{data.openShortfalls}</strong> {data.openShortfalls === 1 ? "use of stock on a patient wasn't" : "uses of stock on patients weren't"} on record in the store - check {data.openShortfalls === 1 ? "it" : "them"}.
          </span>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon={<Wallet size={20} />} label="Stock value" value={formatCurrency(data.stockValue)} href="/inventory/reports" />
        <Tile icon={<PackageX size={20} />} label="Below reorder level" value={String(data.lowStockCount)} tone={data.lowStockCount > 0 ? "warn" : "default"} href="/inventory/stock?filter=low" />
        <Tile icon={<CalendarClock size={20} />} label={`Expiring in ${data.expiryDays} days`} value={String(data.expiringCount)} tone={data.expiringCount > 0 ? "warn" : "default"} href="/inventory/reports?tab=expiry" />
        <Tile icon={<AlertTriangle size={20} />} label="Expired batches" value={String(data.expiredCount)} tone={data.expiredCount > 0 ? "danger" : "default"} href="/inventory/reports?tab=expiry" />
        <Tile icon={<PackageCheck size={20} />} label="Waiting approval" value={String(data.pendingApprovals)} tone={data.pendingApprovals > 0 ? "warn" : "default"} />
        <Tile icon={<ClipboardList size={20} />} label="Open requisitions" value={String(data.openRequisitions)} href="/inventory/requisitions" />
        <Tile icon={<ArrowRightLeft size={20} />} label="Transfers in transit" value={String(data.inTransitTransfers)} href="/inventory/transfers" />
        <Tile icon={<PackageCheck size={20} />} label="Items in stock" value={String(data.itemsInStock)} href="/inventory/stock" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="card p-5">
          <h3 className="mb-3 font-semibold text-foreground">Waiting for approval</h3>
          {data.approvals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing is waiting.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {data.approvals.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => router.push(`${APPROVAL_LINKS[a.kind]}?open=${a.id}`)} className="flex w-full items-center justify-between gap-3 py-2 text-left hover:bg-muted/40">
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">
                        {a.number} <span className="font-normal text-muted-foreground">· {a.detail}</span>
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {a.storeName} · by {a.raisedBy || "—"} · {stamp(a.raisedAt)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs">
                      {a.total != null && <span className="block font-semibold text-foreground">{formatCurrency(a.total)}</span>}
                      <span className={a.canApprove ? "text-primary" : "text-muted-foreground"}>{a.canApprove ? "Review" : "Another approver"}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Below reorder level</h3>
            <Link href="/inventory/purchase-orders?reorder=1" className="text-sm font-semibold text-primary hover:underline">
              Reorder…
            </Link>
          </div>
          {data.lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">Everything is above its reorder level.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {data.lowStock.map((r) => (
                <li key={`${r.storeId}-${r.itemId}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{r.name}</span>
                    <span className="block text-xs text-muted-foreground">{r.storeName}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs">
                    <span className="block font-semibold text-amber-600">
                      {qty(r.quantity)} {r.unit}
                    </span>
                    <span className="text-muted-foreground">level {qty(r.reorderLevel)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h3 className="mb-3 font-semibold text-foreground">Expiring soonest</h3>
          {data.expiring.length === 0 ? (
            <p className="text-sm text-muted-foreground">No batch expires within {data.expiryDays} days.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {data.expiring.map((e) => (
                <li key={e.lot.batchId} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{e.itemName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {e.lot.storeName} · batch {e.lot.batchNumber ?? "—"} · {qty(e.lot.quantity)} {e.unit}
                    </span>
                  </span>
                  <span className={`shrink-0 text-xs font-semibold ${e.lot.isExpired ? "text-red-600" : "text-amber-600"}`}>
                    {e.lot.isExpired ? `Expired ${day(e.lot.expiryDate)}` : `${day(e.lot.expiryDate)} (${e.lot.daysToExpiry} d)`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h3 className="mb-3 font-semibold text-foreground">Latest movements</h3>
          {data.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stock has moved yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {data.recent.map((t) => (
                <li key={t.transactionId} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{t.itemName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {TXN_LABELS[t.txnType]} · {t.documentNumber} · {t.storeName} · {t.userName}
                    </span>
                  </span>
                  <span className={`shrink-0 text-right text-xs font-semibold ${t.quantity < 0 ? "text-red-600" : "text-green-600"}`}>
                    {t.quantity > 0 ? "+" : ""}
                    {qty(t.quantity)} {t.unit}
                    <span className="block font-normal text-muted-foreground">{stamp(t.createdAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
