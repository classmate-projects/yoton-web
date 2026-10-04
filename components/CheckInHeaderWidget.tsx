"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, LogIn, LogOut } from "lucide-react";
import { AttendanceService } from "@/services/attendance.service";
import { AttendanceRecordType } from "@/types/attendance.type";
import AdminPasswordConfirm from "@/components/AdminPasswordConfirm";

export const ATTENDANCE_UPDATED_EVENT = "yoton:attendance-updated";
export const dispatchAttendanceUpdate = () =>
  window.dispatchEvent(new Event(ATTENDANCE_UPDATED_EVENT));

const fmt = (value: string | null) =>
  value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

export default function CheckInHeaderWidget() {
  const [today, setToday] = useState<AttendanceRecordType | null | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmingCheckOut, setConfirmingCheckOut] = useState(false);

  const fetchToday = () => {
    AttendanceService.getToday()
      .then((res) => setToday(res.data ?? null))
      .catch(() => setToday(null));
  };

  useEffect(() => {
    fetchToday();
    window.addEventListener(ATTENDANCE_UPDATED_EVENT, fetchToday);
    return () => window.removeEventListener(ATTENDANCE_UPDATED_EVENT, fetchToday);
  }, []);

  const handleCheckIn = async () => {
    setIsSubmitting(true);
    try {
      const res = await AttendanceService.checkIn();
      toast.success(res.message);
      fetchToday();
    } catch {
      toast.error("Failed to check in");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckOutConfirm = async (password: string) => {
    const res = await AttendanceService.checkOut(password);
    toast.success(res.message);
    setConfirmingCheckOut(false);
    fetchToday();
  };

  if (today === undefined) return null;

  return (
    <div className="flex items-center gap-2 shrink-0">
      {!today ? (
        <button
          type="button"
          onClick={handleCheckIn}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LogIn size={13} />
          {isSubmitting ? "…" : "Check In"}
        </button>
      ) : !today.checkOutAt ? (
        <div className="flex items-center gap-2">
          <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            <Clock size={12} />
            {fmt(today.checkInAt)}
          </span>
          <button
            type="button"
            onClick={() => setConfirmingCheckOut(true)}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
          >
            <LogOut size={13} />
            Check Out
          </button>
        </div>
      ) : (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock size={12} />
          <span className="hidden sm:inline">
            {fmt(today.checkInAt)} – {fmt(today.checkOutAt)}
          </span>
          <span className="sm:hidden">Done</span>
        </span>
      )}

      {confirmingCheckOut && (
        <AdminPasswordConfirm
          title="Confirm check-out"
          description="Enter your password to confirm you're checking out for the day."
          confirmLabel="Check Out"
          confirmingLabel="Checking out…"
          passwordPlaceholder="Your password"
          onCancel={() => setConfirmingCheckOut(false)}
          onConfirm={handleCheckOutConfirm}
        />
      )}
    </div>
  );
}
