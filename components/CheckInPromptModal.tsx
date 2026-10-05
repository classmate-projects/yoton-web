"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, LogIn, X } from "lucide-react";
import { AttendanceService } from "@/services/attendance.service";
import { AttendanceRecordType } from "@/types/attendance.type";
import { dispatchAttendanceUpdate } from "@/components/CheckInHeaderWidget";

interface CheckInPromptModalProps {
  onClose: () => void;
  mandatory?: boolean;
}

const formatTime = (value: string | null) =>
  value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

export default function CheckInPromptModal({ onClose, mandatory = false }: CheckInPromptModalProps) {
  const [today, setToday] = useState<AttendanceRecordType | null | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    AttendanceService.getToday()
      .then((res) => setToday(res.data ?? null))
      .catch(() => setToday(null));
  }, []);

  const handleCheckIn = async () => {
    setIsSubmitting(true);
    try {
      const res = await AttendanceService.checkIn();
      toast.success(res.message);
      dispatchAttendanceUpdate();
      const updated = await AttendanceService.getToday();
      setToday(updated.data ?? null);
    } catch {
      toast.error("Failed to check in");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-md">
      <div className="bg-card w-full max-w-sm rounded-xl border border-border p-6 shadow-2xl mx-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={20} className="text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              {mandatory && !today?.checkInAt ? "Check-in Required" : "Daily Check-in"}
            </h2>
          </div>
          {/* Hide dismiss X when check-in is mandatory and the user hasn't checked in yet */}
          {(!mandatory || today?.checkInAt) && (
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {today === undefined ? (
          <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
        ) : today?.checkInAt ? (
          <div className="text-center py-2">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/40">
              <CheckCircle2 size={22} className="text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">You&apos;re checked in!</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Clock size={12} /> {formatTime(today.checkInAt)}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Continue
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              {mandatory
                ? "Check-in is required before you can start your session today."
                : "You haven’t checked in today. Would you like to check in now?"}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleCheckIn}
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogIn size={16} />
                {isSubmitting ? "Checking in…" : "Check In"}
              </button>
              {/* Only show "Maybe Later" when check-in is not mandatory */}
              {!mandatory && (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
                >
                  Maybe Later
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
