"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, LogIn, LogOut } from "lucide-react";
import { AttendanceService } from "@/services/attendance.service";
import { AttendanceRecordType } from "@/types/attendance.type";
import LoadingSpinner from "@/components/LoadingSpinner";
import { getUserDetail } from "@/lib/userDetail";

const formatTime = (value: string | null) =>
  value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

const formatDate = (value: string) => new Date(value).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

export default function CheckInPage() {
  const [today, setToday] = useState<AttendanceRecordType | null>(null);
  const [history, setHistory] = useState<AttendanceRecordType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const name = getUserDetail()?.name;

  const fetchToday = () => {
    setIsLoading(true);
    Promise.all([AttendanceService.getToday(), AttendanceService.getHistory(14)])
      .then(([todayRes, historyRes]) => {
        setToday(todayRes.data ?? null);
        setHistory(historyRes.data ?? []);
      })
      .catch(() => toast.error("Failed to load attendance"))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchToday();
  }, []);

  const handleCheckIn = async () => {
    setIsSubmitting(true);
    try {
      const data = await AttendanceService.checkIn();
      toast.success(data.message);
      fetchToday();
    } catch (error) {
      toast.error("Failed to check in");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    setIsSubmitting(true);
    try {
      const data = await AttendanceService.checkOut();
      toast.success(data.message);
      fetchToday();
    } catch (error) {
      toast.error("Failed to check out");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-6 px-4 sm:py-8 sm:px-10">
      <div className="mb-6 flex flex-col items-center gap-1 text-center">
        <CheckCircle2 size={40} className="mb-2 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome{name ? `, ${name}` : ""}!
        </h1>
        <p className="text-sm text-muted-foreground">Mark your attendance for today.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 text-center">
        {!today ? (
          <>
            <p className="mb-4 text-sm text-muted-foreground">You haven&apos;t checked in today.</p>
            <button
              type="button"
              onClick={handleCheckIn}
              disabled={isSubmitting}
              className="mx-auto flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogIn size={16} />
              Check In
            </button>
          </>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-center gap-6 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Checked in</p>
                <p className="flex items-center gap-1 font-semibold text-foreground">
                  <Clock size={14} /> {formatTime(today.checkInAt)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Checked out</p>
                <p className="flex items-center gap-1 font-semibold text-foreground">
                  <Clock size={14} /> {formatTime(today.checkOutAt)}
                </p>
              </div>
            </div>
            {!today.checkOutAt ? (
              <button
                type="button"
                onClick={handleCheckOut}
                disabled={isSubmitting}
                className="mx-auto flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogOut size={16} />
                Check Out
              </button>
            ) : (
              <p className="text-sm text-muted-foreground">You&apos;re all done for today.</p>
            )}
          </>
        )}
      </div>

      {history.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Recent attendance</h2>
          <div className="flex flex-col divide-y divide-border">
            {history.map((record) => (
              <div key={record.attendanceRecordId} className="flex items-center justify-between py-2 text-sm">
                <span className="text-foreground">{formatDate(record.date)}</span>
                <span className="text-muted-foreground">
                  {formatTime(record.checkInAt)} – {formatTime(record.checkOutAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
