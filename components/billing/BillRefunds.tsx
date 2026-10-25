"use client";

import { useCallback, useEffect, useState } from "react";
import { HandCoins } from "lucide-react";
import { toast } from "sonner";
import SearchableSelect from "@/components/SearchableSelect";
import { BillingService } from "@/services/billing.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import type { BillRefundType } from "@/types/billing.type";

const METHODS = [
  { value: "Cash", label: "Cash" },
  { value: "Card", label: "Card" },
  { value: "Insurance", label: "Insurance" },
];

// One refund: what it's for, and paying it out when it's still due.
function RefundRow({ refund, patient, onPaid }: { refund: BillRefundType; patient?: string; onPaid: () => void }) {
  const [method, setMethod] = useState("Cash");
  const [busy, setBusy] = useState(false);
  const pay = async () => {
    setBusy(true);
    try {
      const res = await BillingService.payRefund(refund.refundId, method);
      toast.success(res.message ?? "Refund paid out");
      onPaid();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't pay out the refund"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <div className="min-w-0">
        <p className="font-medium text-foreground">
          {patient ? `${patient} · ` : ""}
          {refund.description} × {refund.quantity} · <span className="tabular-nums">{formatCurrency(refund.amount)}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Returned {formatDateTime(refund.createdAt)}
          {refund.requestedByName ? ` by ${refund.requestedByName}` : ""} · {refund.reason}
          {patient ? ` · bill #${refund.billId}` : ""}
        </p>
      </div>
      {refund.status === "Due" ? (
        <div className="flex items-center gap-2">
          <div className="w-32">
            <SearchableSelect value={method} onChange={setMethod} options={METHODS} />
          </div>
          <button type="button" onClick={pay} disabled={busy} className="whitespace-nowrap rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60">
            Pay out
          </button>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">
          Paid out {refund.paidOutAt ? formatDateTime(refund.paidOutAt) : ""} · {refund.paymentMethod}
          {refund.paidOutByName ? ` · ${refund.paidOutByName}` : ""}
        </span>
      )}
    </li>
  );
}

// Refunds on one paid bill - shown under its lines; nothing when there are none.
export function BillRefunds({ billId }: { billId: string }) {
  const [refunds, setRefunds] = useState<BillRefundType[]>([]);
  const load = useCallback(() => {
    BillingService.getRefunds(billId)
      .then((r) => setRefunds(r.data ?? []))
      .catch(() => setRefunds([]));
  }, [billId]);
  useEffect(() => {
    load();
  }, [load]);
  useSignalRRefetch(["billPaid", "billItemAdded"], load);
  if (refunds.length === 0) return null;
  const due = refunds.filter((r) => r.status === "Due").reduce((s, r) => s + r.amount, 0);
  return (
    <section className="mt-4 rounded-lg border border-amber-300 bg-amber-50/60 p-3 dark:border-amber-800 dark:bg-amber-950/20">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <HandCoins size={15} /> Refunds - items returned after payment
        {due > 0 && <span className="ml-auto text-xs font-semibold text-amber-700 dark:text-amber-300">{formatCurrency(due)} to give back</span>}
      </h3>
      <ul className="divide-y divide-border">
        {refunds.map((r) => (
          <RefundRow key={r.refundId} refund={r} onPaid={load} />
        ))}
      </ul>
    </section>
  );
}

// Every refund still to be given back, across bills - shown at the top of Billing when any.
export function RefundsDue() {
  const [rows, setRows] = useState<{ refund: BillRefundType; patientName: string }[]>([]);
  const [open, setOpen] = useState(false);
  const load = useCallback(() => {
    BillingService.getRefundsDue()
      .then((r) => setRows(r.data ?? []))
      .catch(() => setRows([]));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useSignalRRefetch(["billPaid", "billItemAdded"], load);
  if (rows.length === 0) return null;
  const total = rows.reduce((s, r) => s + r.refund.amount, 0);
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left text-sm text-amber-900 dark:text-amber-200">
        <HandCoins size={16} className="shrink-0" />
        <span>
          <strong>{rows.length}</strong> refund{rows.length === 1 ? "" : "s"} to give back ({formatCurrency(total)}) - items returned after their bill was paid.
        </span>
        <span className="ml-auto text-xs font-semibold">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <ul className="mt-2 divide-y divide-border">
          {rows.map((r) => (
            <RefundRow key={r.refund.refundId} refund={r.refund} patient={r.patientName} onPaid={load} />
          ))}
        </ul>
      )}
    </div>
  );
}
