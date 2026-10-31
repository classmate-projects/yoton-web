"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, ShieldCheck, Wallet, Wrench } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import { AssetsService } from "@/services/assets.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { formatCurrency } from "@/lib/currency";
import type { Asset, AssetOverview, WorkOrderKind } from "@/types/assets.type";
import { AssetDetail, WorkOrderDetail, WorkOrderForm } from "@/components/assets/AssetDialogs";
import { DueText, KIND_LABELS, StatusBadge, useAssets } from "@/components/assets/assetsUi";
import { day, stamp } from "@/components/inventory/inventoryUi";

function Tile({ icon, label, value, tone = "default", href }: { icon: ReactNode; label: string; value: string; tone?: "default" | "warn" | "danger"; href?: string }) {
  const tones = { default: "text-primary bg-primary/10", warn: "text-amber-600 bg-amber-100 dark:bg-amber-950/40", danger: "text-red-600 bg-red-100 dark:bg-red-950/40" };
  const body = (
    <div className="card flex items-center gap-3 p-4">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function DueSection({ title, rows, kind, field, onOpen, onSchedule }: {
  title: string;
  rows: { asset: Asset; scheduled: boolean }[];
  kind: WorkOrderKind;
  field: "maintenanceDueInDays" | "calibrationDueInDays";
  onOpen: (id: string) => void;
  onSchedule: (asset: Asset, kind: WorkOrderKind) => void;
}) {
  return (
    <section className="card flex flex-col gap-2 p-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing due.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {rows.map(({ asset, scheduled }) => (
            <li key={asset.assetId} className="flex items-center justify-between gap-2 py-2 text-sm">
              <button type="button" onClick={() => onOpen(asset.assetId)} className="min-w-0 text-left">
                <span className="block truncate font-medium text-foreground">{asset.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {asset.assetTag} · {asset.departmentName ?? "No department"}
                </span>
              </button>
              <span className="flex shrink-0 items-center gap-2 text-xs">
                <DueText days={asset[field]} />
                {scheduled ? (
                  <span className="text-muted-foreground">Scheduled</span>
                ) : (
                  <button type="button" onClick={() => onSchedule(asset, kind)} className="font-semibold text-primary hover:underline">
                    Schedule
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AssetsOverviewPage() {
  const { lookups } = useAssets();
  const [data, setData] = useState<AssetOverview | null>(null);
  const [openAsset, setOpenAsset] = useState<string | null>(null);
  const [openWorkOrder, setOpenWorkOrder] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<{ asset: Asset; kind: WorkOrderKind } | null>(null);

  const load = useCallback(() => {
    AssetsService.overview().then((r) => setData(r.data)).catch(() => setData(null));
  }, []);
  useEffect(() => {
    if (lookups?.isAssetTeam) load();
  }, [lookups, load]);
  useSignalRRefetch(["assetsChanged"], load);

  if (lookups && !lookups.isAssetTeam) return <EmptyState illustration="clipboard" title="This is the maintenance team's area" description="Report a fault on your department's equipment from Store Requests." />;
  if (!data) return <LoadingSpinner />;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon={<CheckCircle2 size={20} />} label="Assets in the register" value={`${data.totalAssets} (${data.inUse} in use)`} href="/assets/register" />
        <Tile icon={<Wrench size={20} />} label="Open work orders" value={`${data.openWorkOrders}${data.urgentWorkOrders ? ` (${data.urgentWorkOrders} urgent)` : ""}`} tone={data.urgentWorkOrders ? "danger" : data.openWorkOrders ? "warn" : "default"} href="/assets/work-orders" />
        <Tile icon={<AlertTriangle size={20} />} label="Out of service / under maintenance" value={`${data.outOfService} / ${data.underMaintenance}`} tone={data.outOfService ? "danger" : "default"} href="/assets/register?status=OutOfService" />
        <Tile icon={<Wallet size={20} />} label="Value now" value={formatCurrency(data.bookValue)} href="/assets/reports" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DueSection title={`Servicing due in ${data.dueWindowDays} days or overdue`} rows={data.maintenanceDue} kind="Preventive" field="maintenanceDueInDays" onOpen={setOpenAsset} onSchedule={(asset, kind) => setScheduling({ asset, kind })} />
        <DueSection title={`Calibration due in ${data.dueWindowDays} days or overdue`} rows={data.calibrationDue} kind="Calibration" field="calibrationDueInDays" onOpen={setOpenAsset} onSchedule={(asset, kind) => setScheduling({ asset, kind })} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="card flex flex-col gap-2 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Wrench size={15} /> Open work orders
          </h2>
          {data.workOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">None.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {data.workOrders.map((w) => (
                <li key={w.workOrderId}>
                  <button type="button" onClick={() => setOpenWorkOrder(w.workOrderId)} className="flex w-full items-center justify-between gap-2 py-2 text-left text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">
                        {w.number} · {KIND_LABELS[w.kind]} · {w.assetName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {w.problem} · {stamp(w.createdAt)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {w.priority === "Urgent" && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">Urgent</span>}
                      <StatusBadge status={w.status} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card flex flex-col gap-2 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck size={15} /> Warranties ending in {data.warrantyWindowDays} days
          </h2>
          {data.warrantyEnding.length === 0 ? (
            <p className="text-sm text-muted-foreground">None.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {data.warrantyEnding.map((a) => (
                <li key={a.assetId}>
                  <button type="button" onClick={() => setOpenAsset(a.assetId)} className="flex w-full items-center justify-between gap-2 py-2 text-left text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">{a.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {a.assetTag}
                        {a.serviceVendorName ? ` · ${a.serviceVendorName}` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-amber-600">
                      <CalendarClock size={13} /> {day(a.warrantyEndDate)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {openAsset && <AssetDetail id={openAsset} onClose={() => { setOpenAsset(null); load(); }} />}
      {openWorkOrder && <WorkOrderDetail id={openWorkOrder} onClose={() => { setOpenWorkOrder(null); load(); }} />}
      {scheduling && (
        <WorkOrderForm
          asset={scheduling.asset}
          kind={scheduling.kind}
          onClose={() => setScheduling(null)}
          onSaved={(id) => {
            setScheduling(null);
            setOpenWorkOrder(id);
            load();
          }}
        />
      )}
    </div>
  );
}
