"use client";

import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import PasswordInput from "@/components/PasswordInput";

interface ImmunizationReasonModalProps {
  title: string;
  description: ReactNode;
  icon: ReactNode;
  reasonPlaceholder: string;
  confirmLabel: string;
  busyLabel: string;
  tone?: "danger" | "warning";
  requirePassword?: boolean;
  onConfirm: (reason: string, password: string) => Promise<void>;
  onClose: () => void;
}

// One modal for every immunization action that needs a stated reason (and, for undoing a
// recorded administration, the user's own password): cancelling an order, marking a dose
// missed, recording a dose as not given, undoing an administration. The reason goes into the
// order's audit trail.
export default function ImmunizationReasonModal({
  title,
  description,
  icon,
  reasonPlaceholder,
  confirmLabel,
  busyLabel,
  tone = "danger",
  requirePassword,
  onConfirm,
  onClose,
}: ImmunizationReasonModalProps) {
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const canConfirm = reason.trim().length > 0 && (!requirePassword || password.length > 0);

  const confirm = async () => {
    if (!canConfirm || busy) return;
    try {
      setBusy(true);
      await onConfirm(reason.trim(), password);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-xl flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="shrink-0 mt-0.5">{icon}</span>
            <div>
              <h2 className="text-base font-semibold text-foreground">{title}</h2>
              <div className="text-sm text-muted-foreground">{description}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground required">Reason</label>
          <textarea
            autoFocus
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonPlaceholder}
            className="w-full text-sm"
          />
        </div>

        {requirePassword && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground required">Your password</label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void confirm()}
              placeholder="Enter your password to confirm"
              className="h-10 w-full text-sm"
            />
          </div>
        )}

        <div className="flex gap-3 justify-end pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
            Keep as is
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={!canConfirm || busy}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
              tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-amber-500 hover:bg-amber-600"
            }`}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
