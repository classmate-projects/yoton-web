"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AssetsService } from "@/services/assets.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import type { AssetCategory, AssetLookups, AssetStatus, WorkOrderKind, WorkOrderStatus } from "@/types/assets.type";

// ---------------- lookups ----------------

const AssetsContext = createContext<{ lookups: AssetLookups | null; reload: () => void }>({ lookups: null, reload: () => {} });

export function AssetsProvider({ children }: { children: ReactNode }) {
  const [lookups, setLookups] = useState<AssetLookups | null>(null);
  const reload = useCallback(() => {
    AssetsService.lookups().then((r) => setLookups(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  useSignalRRefetch(["inventoryChanged"], reload);
  return <AssetsContext.Provider value={{ lookups, reload }}>{children}</AssetsContext.Provider>;
}

export const useAssets = () => useContext(AssetsContext);

// ---------------- labels ----------------

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  MedicalEquipment: "Medical equipment",
  Furniture: "Furniture",
  ITEquipment: "IT equipment",
  Vehicle: "Vehicle",
  Other: "Other",
};

export const KIND_LABELS: Record<WorkOrderKind, string> = {
  Preventive: "Servicing",
  Repair: "Repair",
  Calibration: "Calibration",
};

const STATUS_STYLES: Record<AssetStatus | WorkOrderStatus, { label: string; className: string }> = {
  InUse: { label: "In use", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  InStore: { label: "In store", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  UnderMaintenance: { label: "Under maintenance", className: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  OutOfService: { label: "Out of service", className: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
  Disposed: { label: "Disposed", className: "bg-muted text-muted-foreground" },
  Open: { label: "Open", className: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
  InProgress: { label: "In progress", className: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  Completed: { label: "Completed", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  Cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

export function StatusBadge({ status }: { status: AssetStatus | WorkOrderStatus }) {
  const s = STATUS_STYLES[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.className}`}>{s.label}</span>;
}

// "Due in 5 days" / "3 days overdue", coloured by how close it is.
export function DueText({ days }: { days: number | null }) {
  if (days == null) return <span className="text-muted-foreground">—</span>;
  const text = days < 0 ? `${-days} day${days === -1 ? "" : "s"} overdue` : days === 0 ? "Due today" : `In ${days} day${days === 1 ? "" : "s"}`;
  const tone = days < 0 ? "text-red-600 font-semibold" : days <= 7 ? "text-amber-600 font-semibold" : "text-muted-foreground";
  return <span className={tone}>{text}</span>;
}

// ---------------- navigation ----------------

const TABS = [
  { href: "/assets", label: "Overview" },
  { href: "/assets/register", label: "Asset register" },
  { href: "/assets/work-orders", label: "Work orders" },
  { href: "/assets/reports", label: "Reports" },
];

export function AssetsNav() {
  const pathname = usePathname();
  return (
    <nav className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto border-b border-border px-1">
      {TABS.map((t) => {
        const active = t.href === "/assets" ? pathname === "/assets" : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
              active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
