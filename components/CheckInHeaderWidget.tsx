"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Clock, LogIn, LogOut, X } from "lucide-react";
import { AttendanceService } from "@/services/attendance.service";
import { AttendanceRecordType } from "@/types/attendance.type";
import PasswordInput from "@/components/PasswordInput";

export const ATTENDANCE_UPDATED_EVENT = "yoton:attendance-updated";
export const dispatchAttendanceUpdate = () =>
  window.dispatchEvent(new Event(ATTENDANCE_UPDATED_EVENT));

const fmt = (value: string | null) =>
  value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

export default function CheckInHeaderWidget() {
  const [today, setToday] = useState<AttendanceRecordType | null | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCheckOutPopover, setShowCheckOutPopover] = useState(false);
  const [password, setPassword] = useState("");
  const [checkOutError, setCheckOutError] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

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

  // Close popover when clicking outside
  useEffect(() => {
    if (!showCheckOutPopover) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowCheckOutPopover(false);
        setPassword("");
        setCheckOutError("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCheckOutPopover]);

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

  const handleCheckOutSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || isSubmitting) return;
    setIsSubmitting(true);
    setCheckOutError("");
    try {
      const res = await AttendanceService.checkOut(password);
      toast.success(res.message);
      setShowCheckOutPopover(false);
      setPassword("");
      fetchToday();
    } catch (err) {
      setCheckOutError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Incorrect password"
          : "Something went wrong"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (today === undefined) return null;

  return (
    <div className="ml-auto flex items-center gap-2 shrink-0">
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
        <div className="relative flex items-center gap-2" ref={popoverRef}>
          <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            <Clock size={12} />
            {fmt(today.checkInAt)}
          </span>
          <button
            type="button"
            onClick={() => {
              setShowCheckOutPopover((v) => !v);
              setPassword("");
              setCheckOutError("");
            }}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
          >
            <LogOut size={13} />
            Check Out
          </button>

          {showCheckOutPopover && (
            <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border border-border bg-card p-4 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-foreground">Confirm check-out</p>
                <button
                  type="button"
                  onClick={() => { setShowCheckOutPopover(false); setPassword(""); setCheckOutError(""); }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Enter your password to check out for the day.
              </p>
              <form onSubmit={handleCheckOutSubmit} className="flex flex-col gap-2">
                <PasswordInput
                  autoFocus
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                />
                {checkOutError && (
                  <p className="text-xs text-destructive">{checkOutError}</p>
                )}
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => { setShowCheckOutPopover(false); setPassword(""); setCheckOutError(""); }}
                    disabled={isSubmitting}
                    className="flex-1 rounded-lg border border-border py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !password}
                    className="flex-1 rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? "…" : "Check Out"}
                  </button>
                </div>
              </form>
            </div>
          )}
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
    </div>
  );
}
