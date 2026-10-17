"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, LogIn, LogOut } from "lucide-react";
import { AttendanceService } from "@/services/attendance.service";
import { AttendanceRecordType, AutoCheckOutEvent } from "@/types/attendance.type";
import { getUserDetail, onUserDetailChange } from "@/lib/userDetail";
import { getSignalRConnection } from "@/lib/signalR";
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
  const [mandatory, setMandatory] = useState(false);

  const fetchToday = () => {
    AttendanceService.getToday()
      .then((res) => setToday(res.data ?? null))
      .catch(() => setToday(null));
  };

  const readMandatory = () =>
    setMandatory(getUserDetail()?.staffCheckInRequired ?? false);

  useEffect(() => {
    fetchToday();
    readMandatory();
    window.addEventListener(ATTENDANCE_UPDATED_EVENT, fetchToday);
    const cleanup = onUserDetailChange(readMandatory);
    return () => {
      window.removeEventListener(ATTENDANCE_UPDATED_EVENT, fetchToday);
      cleanup();
    };
  }, []);

  // The end-of-day job just closed a session this user never checked out of - every role
  // has this widget (unlike the alert bell), so it's where they hear about it live.
  useEffect(() => {
    const userId = getUserDetail()?.userId;
    if (!userId) return;
    let isMounted = true;

    const handleAutoCheckedOut = (event: AutoCheckOutEvent) => {
      if (!isMounted || !event.records?.some((r) => r.userId === userId)) return;
      fetchToday();
      toast.warning("You didn't check out, so the system checked you out automatically at the end of the day.");
    };

    getSignalRConnection()
      .then((connection) => {
        if (!isMounted) return;
        connection.off("attendanceAutoCheckedOut", handleAutoCheckedOut);
        connection.on("attendanceAutoCheckedOut", handleAutoCheckedOut);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
      getSignalRConnection()
        .then((connection) => connection.off("attendanceAutoCheckedOut", handleAutoCheckedOut))
        .catch(() => {});
    };
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

  // When check-in is mandatory and the user hasn't checked in, wrap the button in a
  // pulsing ring so it draws immediate attention without changing its core action.
  const notCheckedIn = !today;
  const showPulse = mandatory && notCheckedIn;

  return (
    <div className="flex items-center gap-2 shrink-0">
      {!today ? (
        <div className={showPulse ? "relative" : undefined}>
          {showPulse && (
            <span className="absolute inset-0 rounded-md animate-ping bg-amber-400/40 pointer-events-none" />
          )}
          <button
            type="button"
            onClick={handleCheckIn}
            disabled={isSubmitting}
            className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${
              showPulse
                ? "bg-amber-500 text-white ring-2 ring-amber-400"
                : "bg-primary text-primary-foreground"
            }`}
          >
            <LogIn size={13} />
            {isSubmitting ? "…" : "Check In"}
          </button>
        </div>
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
        <span
          title={today.isAutoCheckOut ? "You didn't check out, so the system checked you out at the end of the day" : undefined}
          className="flex items-center gap-1 text-xs text-muted-foreground"
        >
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
