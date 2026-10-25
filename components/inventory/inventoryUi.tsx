"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import { InventoryService } from "@/services/inventory.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { parseDateInputValue } from "@/lib/date";
import type { InventoryLookups, InventoryStore, StockTxnType } from "@/types/inventory.type";

// Shared pieces of the Inventory and Store Requests screens.

// ---------------- context: stores + lookups ----------------

interface InventoryContextValue {
  lookups: InventoryLookups | null;
  stores: InventoryStore[];
  // Stores this user can run (all of them for the store team, their department's otherwise).
  myStores: InventoryStore[];
  reload: () => void;
}

const InventoryContext = createContext<InventoryContextValue>({ lookups: null, stores: [], myStores: [], reload: () => {} });

// Loads the stores and pick-lists once for every inventory screen, and again whenever anyone
// changes something (inventoryChanged).
export function InventoryProvider({ children }: { children: ReactNode }) {
  const [lookups, setLookups] = useState<InventoryLookups | null>(null);
  const [stores, setStores] = useState<InventoryStore[]>([]);

  const reload = useCallback(() => {
    InventoryService.lookups().then((r) => setLookups(r.data)).catch(() => {});
    InventoryService.stores({ includeInactive: true }).then((r) => setStores(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);
  useSignalRRefetch(["inventoryChanged"], reload);

  return (
    <InventoryContext.Provider value={{ lookups, stores, myStores: stores.filter((s) => s.canOperate && s.isActive), reload }}>
      {children}
    </InventoryContext.Provider>
  );
}

export const useInventory = () => useContext(InventoryContext);

// ---------------- formatting ----------------

export const qty = (n: number | null | undefined) => (n == null ? "—" : Number(n.toFixed(3)).toLocaleString());

export const day = (value: string | null | undefined) => {
  const d = value ? parseDateInputValue(value.slice(0, 10)) : null;
  return d ? d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—";
};

export const stamp = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

export const todayInput = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const STORE_TYPE_LABELS: Record<string, string> = {
  Main: "Main store",
  Pharmacy: "Pharmacy",
  Laboratory: "Laboratory",
  Radiology: "Radiology",
  Ward: "Ward",
  OperatingTheatre: "Operating theatre",
  Department: "Department",
};

export const TXN_LABELS: Record<StockTxnType, string> = {
  Opening: "Opening stock",
  Receipt: "Goods received",
  VendorReturn: "Returned to supplier",
  TransferOut: "Transferred out",
  TransferIn: "Transferred in",
  Issue: "Issued",
  IssueReturn: "Issue return",
  AdjustmentIn: "Adjustment +",
  AdjustmentOut: "Adjustment −",
  WriteOff: "Written off",
  CountGain: "Count gain",
  CountLoss: "Count loss",
  Dispense: "Dispensed",
  PatientUse: "Used on patient",
};

// ---------------- status badges ----------------

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  Draft: { label: "Draft", className: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300" },
  PendingApproval: { label: "Waiting approval", className: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
  Approved: { label: "Approved", className: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
  PartiallyReceived: { label: "Part received", className: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400" },
  Received: { label: "Received", className: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" },
  Closed: { label: "Closed", className: "bg-muted text-muted-foreground" },
  Cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground line-through" },
  Submitted: { label: "Requested", className: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
  PartiallyIssued: { label: "Part sent", className: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400" },
  Issued: { label: "Sent", className: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" },
  Rejected: { label: "Declined", className: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" },
  InTransit: { label: "In transit", className: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
  Posted: { label: "Posted", className: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" },
  InProgress: { label: "Counting", className: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
};

export function DocStatus({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.className}`}>{s.label}</span>;
}

// ---------------- form pieces ----------------

export const inputClass =
  "h-10 w-full rounded-lg border border-border bg-transparent px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";
export const smallInputClass =
  "h-9 w-full rounded-md border border-border bg-transparent px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";
// DatePicker swaps its own styling for the className it's given, so its box needs the flex layout too,
// and its inner input would otherwise pick up the global large input text.
export const dateInputClass =
  "flex h-10 w-full items-center gap-2 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground focus-within:ring-2 focus-within:ring-primary [&_input]:text-sm";
export const smallDateInputClass =
  "flex h-9 w-full items-center gap-1.5 rounded-md border border-border bg-transparent px-2 text-sm text-foreground focus-within:ring-2 focus-within:ring-primary [&_input]:text-sm";
export const primaryButton =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50";
export const secondaryButton =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50";
export const dangerButton =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950/30";

export function Field({ label, required, children, hint, className = "" }: { label: string; required?: boolean; children: ReactNode; hint?: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className={`text-xs font-semibold text-muted-foreground ${required ? "required" : ""}`}>{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// A full-height modal for document forms and detail views.
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = "max-w-4xl",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className={`flex max-h-[94vh] w-full ${width} flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl`}>
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {subtitle && <div className="mt-0.5 text-sm text-muted-foreground">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// Asks for a reason (send back, cancel, decline) before running the action.
export function ReasonPrompt({
  title,
  description,
  confirmLabel,
  required = true,
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string;
  description?: string;
  confirmLabel: string;
  required?: boolean;
  danger?: boolean;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (required && !reason.trim()) return;
    setBusy(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl bg-card p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          autoFocus
          placeholder={required ? "Reason (required)" : "Reason (optional)"}
          className="w-full text-sm"
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButton}>
            Back
          </button>
          <button type="button" onClick={submit} disabled={busy || (required && !reason.trim())} className={danger ? dangerButton : primaryButton}>
            {busy && <Loader2 size={14} className="animate-spin" />} {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// A row of summary figures at the top of a detail view.
export function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{i.label}</dt>
          <dd className="truncate font-medium text-foreground">{i.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

// Page-level toolbar: title + actions.
export function PageBar({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

// Plain previous / next paging under a list.
export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <span className="text-muted-foreground">
        Page {page} of {pages} · {total} total
      </span>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={secondaryButton}>
        Previous
      </button>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className={secondaryButton}>
        Next
      </button>
    </div>
  );
}
