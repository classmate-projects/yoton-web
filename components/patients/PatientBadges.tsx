"use client";

import { Footprints } from "lucide-react";

// A walk-in registered with minimal details (registrationType "External") - reception can
// complete the record later; it's the same patient and MRN either way.
export function WalkInPatientBadge({ registrationType }: { registrationType?: string | null }) {
  if (registrationType !== "External") return null;
  return (
    <span
      title="Registered as a walk-in with minimal details - reception can complete the registration later"
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400"
    >
      <Footprints size={11} />
      Walk-in patient
    </span>
  );
}

// Walk-ins usually pay before the service, so their cards say whether that's happened.
export function BillStatusBadge({ billStatus }: { billStatus?: string | null }) {
  if (billStatus === "Paid")
    return (
      <span className="inline-flex shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
        Paid
      </span>
    );
  if (billStatus === "Pending")
    return (
      <span className="inline-flex shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
        Billed · unpaid
      </span>
    );
  return (
    <span className="inline-flex shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-600 dark:text-red-400">
      Not billed
    </span>
  );
}

// Why a billed walk-in order can't be corrected/deleted from the department screen.
export const billedLockTitle = (billStatus?: string | null) =>
  billStatus === "Paid"
    ? "Already paid - it can't be changed; raise a new one instead"
    : "On a bill - ask Billing to remove it from the bill before changing it";
