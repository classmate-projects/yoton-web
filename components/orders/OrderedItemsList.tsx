"use client";

import { ReactNode } from "react";
import { ClipboardCheck, FlaskConical, Lock, ScanLine, Settings } from "lucide-react";
import { LabRequestType } from "@/types/lab.type";
import { RadiologyRequestType } from "@/types/radiology.type";
import { TreatmentType } from "@/types/treatment.type";
import type { OrderLockFields } from "@/types/orderLock.type";
import EmptyState from "@/components/EmptyState";
import OrderLockNotice from "@/components/orders/OrderLockNotice";
import type { IllustrationName } from "@/components/illustrations";

interface OrderedItemsListProps {
  labRequests: LabRequestType[];
  radiologyRequests: RadiologyRequestType[];
  treatments: TreatmentType[];
  onOpenLab: (item: LabRequestType) => void;
  onOpenRadiology: (item: RadiologyRequestType) => void;
  onOpenTreatment: (item: TreatmentType) => void;
  emptyMessage?: string;
  emptyIllustration?: IllustrationName;
  itemClassName?: string;
  // Only the doctor's own view needs to explain locks - Lab/Radiology/Nursing see the same
  // list read-only and already know they're the ones holding the order.
  showLockDetails?: boolean;
  visitLockHint?: string;
  // When the whole encounter is finalized every row is "Visit"-locked - the page already
  // says so once, so rows only call out locks held by another team.
  hideVisitLocks?: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  Done: "bg-green-100 text-green-700",
  Completed: "bg-green-100 text-green-700",
  Delivered: "bg-green-100 text-green-700",
  InProgress: "bg-blue-100 text-blue-700",
  SampleCollected: "bg-blue-100 text-blue-700",
  Processing: "bg-blue-100 text-blue-700",
  Scheduled: "bg-blue-100 text-blue-700",
};
const statusClass = (status: string) => STATUS_STYLES[status] ?? "bg-amber-100 text-amber-700";

// Groups Lab + Radiology + Treatment orders together as one list (per-type sections within
// it, since each type's own config popup is genuinely different - see LabRadiologyConfigModal/
// TreatmentConfigModal) rather than the three separate cards this used to be. Reused as-is
// on the Doctor Workbench (editable, gear opens the real config) and on Lab/Radiology/
// Nursing (the same gear opens the same modal in read-only mode - the caller's onOpen*
// callback decides which).
export default function OrderedItemsList({
  labRequests,
  radiologyRequests,
  treatments,
  onOpenLab,
  onOpenRadiology,
  onOpenTreatment,
  emptyMessage = "Nothing ordered yet",
  emptyIllustration = "clipboard",
  itemClassName,
  showLockDetails = false,
  visitLockHint,
  hideVisitLocks = false,
}: OrderedItemsListProps) {
  const isEmpty = labRequests.length === 0 && radiologyRequests.length === 0 && treatments.length === 0;
  if (isEmpty) return <EmptyState size="compact" illustration={emptyIllustration} title={emptyMessage} />;

  const lockProps = { showLockDetails, visitLockHint, hideVisitLocks };

  return (
    <div className="flex flex-col gap-4">
      {labRequests.length > 0 && (
        <OrderGroup icon={<FlaskConical size={14} />} label="Lab">
          {labRequests.map((l) => (
            <OrderRow
              key={l.labRequestId}
              name={l.testType || "Lab test"}
              status={l.status}
              lock={l}
              {...lockProps}
              onOpen={() => onOpenLab(l)}
              className={itemClassName}
            />
          ))}
        </OrderGroup>
      )}
      {radiologyRequests.length > 0 && (
        <OrderGroup icon={<ScanLine size={14} />} label="Radiology">
          {radiologyRequests.map((r) => (
            <OrderRow
              key={r.radiologyRequestId}
              name={r.scanType || "Scan"}
              status={r.status}
              lock={r}
              {...lockProps}
              onOpen={() => onOpenRadiology(r)}
              className={itemClassName}
            />
          ))}
        </OrderGroup>
      )}
      {treatments.length > 0 && (
        <OrderGroup icon={<ClipboardCheck size={14} />} label="Treatments">
          {treatments.map((t) => (
            <OrderRow
              key={t.treatmentId}
              name={t.description}
              status={t.status}
              lock={t}
              {...lockProps}
              onOpen={() => onOpenTreatment(t)}
              className={itemClassName}
              badges={[
                ...(t.isPackage ? [{ text: "Package", className: "bg-blue-100 text-blue-700" }] : []),
                ...(t.isBillingPending ? [{ text: "Billing pending", className: "bg-purple-100 text-purple-700" }] : []),
              ]}
            />
          ))}
        </OrderGroup>
      )}
    </div>
  );
}

function OrderGroup({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
        {icon} {label}
      </p>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function OrderRow({
  name,
  status,
  lock,
  showLockDetails,
  visitLockHint,
  hideVisitLocks,
  onOpen,
  badges = [],
  className,
}: {
  name: string;
  status: string;
  lock: OrderLockFields;
  showLockDetails: boolean;
  visitLockHint?: string;
  hideVisitLocks: boolean;
  onOpen: () => void;
  badges?: { text: string; className: string }[];
  className?: string;
}) {
  const showNotice = showLockDetails && lock.locked && !(hideVisitLocks && lock.lockedBy === "Visit");
  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm${className ? ` ${className}` : ""}`}>
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{name}</p>
        {badges.length > 0 && (
          <div className="mt-1 flex gap-1">
            {badges.map((b) => (
              <span key={b.text} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${b.className}`}>
                {b.text}
              </span>
            ))}
          </div>
        )}
        {showNotice && <OrderLockNotice lock={lock} visitLockHint={visitLockHint} compact />}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {lock.locked && !showNotice && (
          <span title="Locked - doctor can't edit right now">
            <Lock size={13} className="text-amber-600" />
          </span>
        )}
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(status)}`}>{status}</span>
        <button
          type="button"
          onClick={onOpen}
          title="Configuration"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
        >
          <Settings size={15} />
        </button>
      </div>
    </div>
  );
}
