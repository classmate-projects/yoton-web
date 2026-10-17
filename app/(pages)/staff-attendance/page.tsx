"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { UserCheck, Loader2, ChevronLeft, ChevronRight, Search, FileSpreadsheet } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import DatePicker from "@/components/DatePicker";
import SearchableSelect from "@/components/SearchableSelect";
import LoadingSpinner from "@/components/LoadingSpinner";
import { AttendanceService } from "@/services/attendance.service";
import { StaffAttendanceType } from "@/types/attendance.type";
import { toDateInputValue, parseDateInputValue } from "@/lib/date";

// Admin-only (hardcoded in lib/routeAccess.ts and on StaffAttendanceController) - who
// checked in, who didn't, for one chosen day.

type StatusFilter = "" | "checked-in" | "checked-out" | "auto-checked-out" | "not-checked-in";

const STATUS_OPTIONS = [
  { value: "", label: "All staff" },
  { value: "checked-in", label: "Checked in" },
  { value: "checked-out", label: "Checked out" },
  { value: "auto-checked-out", label: "Auto check-out" },
  { value: "not-checked-in", label: "Not checked in" },
];

const AUTO_CHECK_OUT_HINT = "No check-out was recorded, so the system checked them out at 11:59:59 PM";

const formatTime = (value: string | null) =>
  value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

function formatDuration(from: string, to: string | null): string {
  const end = to ? new Date(to) : new Date();
  const minutes = Math.max(0, Math.round((end.getTime() - new Date(from).getTime()) / 60000));
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

function statusOf(s: StaffAttendanceType): Exclude<StatusFilter, ""> {
  if (!s.checkInAt) return "not-checked-in";
  if (!s.checkOutAt) return "checked-in";
  return s.isAutoCheckOut ? "auto-checked-out" : "checked-out";
}

function shiftDate(value: string, days: number): string {
  const date = parseDateInputValue(value) ?? new Date();
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

// A ?date= (e.g. from the missed check-out alert) is only used if it's a real day, not in the future.
const pickDate = (requested: string | null, today: string) =>
  requested && parseDateInputValue(requested) && requested <= today ? requested : today;

function StaffAttendanceInner() {
  const today = toDateInputValue(new Date());
  const router = useRouter();
  const requestedDate = useSearchParams().get("date");
  const [date, setDate] = useState(() => pickDate(requestedDate, today));
  const [staff, setStaff] = useState<StaffAttendanceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");

  // Clicking an alert while already on this page changes only the query string.
  useEffect(() => {
    if (requestedDate) setDate(pickDate(requestedDate, today));
  }, [requestedDate, today]);

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    AttendanceService.getStaffForDate(date)
      .then((res) => setStaff(res.data ?? []))
      .catch(() => {
        setStaff([]);
        toast.error("Failed to load staff attendance");
      })
      .finally(() => setLoading(false));
  }, [date]);

  const counts = useMemo(() => {
    const checkedIn = staff.filter((s) => statusOf(s) === "checked-in").length;
    const absent = staff.filter((s) => statusOf(s) === "not-checked-in").length;
    return {
      total: staff.length,
      present: staff.length - absent,
      checkedIn,
      absent,
    };
  }, [staff]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter(
      (s) =>
        (!status || statusOf(s) === status) &&
        (!q ||
          s.name.toLowerCase().includes(q) ||
          (s.username ?? "").toLowerCase().includes(q) ||
          (s.role ?? "").toLowerCase().includes(q) ||
          (s.departmentName ?? "").toLowerCase().includes(q)),
    );
  }, [staff, search, status]);

  const isToday = date === today;

  // Exports exactly what the table is showing (current date, status filter and search),
  // with times in the admin's local timezone - same as on screen. xlsx is loaded on demand
  // so it isn't part of this page's initial bundle.
  const handleExport = async () => {
    if (visible.length === 0) return;
    try {
      const XLSX = await import("xlsx");
      const rows = visible.map((s) => {
        const st = statusOf(s);
        return {
          Date: date,
          Name: s.name,
          Username: s.username ?? "",
          Role: s.role ?? "",
          Department: s.departmentName ?? "",
          "Check-in": s.checkInAt ? formatTime(s.checkInAt) : "",
          "Check-out": s.checkOutAt ? formatTime(s.checkOutAt) : "",
          Duration: s.checkInAt && (s.checkOutAt || isToday) ? formatDuration(s.checkInAt, s.checkOutAt) : "",
          Status:
            st === "checked-in" ? (isToday ? "On duty" : "No check-out")
            : st === "checked-out" ? "Checked out"
            : st === "auto-checked-out" ? "Auto check-out (missed check-out)"
            : "Not checked in",
          "Account status": s.isActive ? "Active" : "Inactive",
        };
      });
      const sheet = XLSX.utils.json_to_sheet(rows);
      sheet["!cols"] = [12, 24, 18, 14, 20, 10, 10, 10, 16, 14].map((wch) => ({ wch }));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Attendance");
      XLSX.writeFile(book, `staff-attendance-${date}.xlsx`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to export attendance");
    }
  };
  const displayDate = (parseDateInputValue(date) ?? new Date()).toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
          <UserCheck className="text-primary" /> Staff Attendance
        </h1>
        <p className="text-sm text-muted-foreground">
          Who checked in on {displayDate}.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Date</label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDate((d) => shiftDate(d, -1))}
              title="Previous day"
              className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
            >
              <ChevronLeft size={16} />
            </button>
            <DatePicker value={date} onChange={(v) => v && setDate(v)} max={today} />
            <button
              onClick={() => setDate((d) => shiftDate(d, 1))}
              disabled={isToday}
              title="Next day"
              className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted text-muted-foreground disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        {!isToday && (
          <button
            onClick={() => setDate(today)}
            className="h-9 rounded-md px-3 text-sm text-primary hover:bg-primary/10"
          >
            Today
          </button>
        )}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Status</label>
          <SearchableSelect
            value={status}
            onChange={(v) => setStatus(v as StatusFilter)}
            options={STATUS_OPTIONS}
          />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-xs font-semibold text-muted-foreground">Search</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, role or department"
              className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={loading || visible.length === 0}
          title="Download the rows below as an Excel file"
          className="flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FileSpreadsheet size={16} /> Export
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total staff", value: counts.total, className: "text-foreground" },
          { label: "Checked in", value: counts.present, className: "text-green-600 dark:text-green-400" },
          { label: "Still on duty", value: counts.checkedIn, className: "text-primary" },
          { label: "Not checked in", value: counts.absent, className: "text-amber-600 dark:text-amber-400" },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${card.className}`}>{loading ? "—" : card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            illustration="users"
            title="No staff to show"
            description={staff.length === 0 ? "No staff accounts found." : "Nobody matches these filters."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pl-4 pr-4">Staff</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Department</th>
                  <th className="py-2 pr-4">Check-in</th>
                  <th className="py-2 pr-4">Check-out</th>
                  <th className="py-2 pr-4">Duration</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => {
                  const st = statusOf(s);
                  return (
                    <tr
                      key={s.userId}
                      onClick={() => router.push(`/user-management/${s.userId}`)}
                      title="View staff details"
                      className="cursor-pointer border-b border-border/50 transition-colors last:border-0 hover:bg-muted"
                    >
                      <td className="py-2 pl-4 pr-4">
                        <p className="font-medium text-foreground">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.username}
                          {!s.isActive && " · inactive"}
                        </p>
                      </td>
                      <td className="py-2 pr-4 capitalize text-muted-foreground">{s.role ?? "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{s.departmentName ?? "—"}</td>
                      <td className="py-2 pr-4 whitespace-nowrap text-foreground">{formatTime(s.checkInAt)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap text-foreground">{formatTime(s.checkOutAt)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                        {s.checkInAt && (s.checkOutAt || isToday) ? formatDuration(s.checkInAt, s.checkOutAt) : "—"}
                      </td>
                      <td className="py-2 pr-4">
                        {st === "checked-in" ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                            {isToday ? "On duty" : "No check-out"}
                          </span>
                        ) : st === "checked-out" ? (
                          <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-600 dark:text-green-400">
                            Checked out
                          </span>
                        ) : st === "auto-checked-out" ? (
                          <span
                            title={AUTO_CHECK_OUT_HINT}
                            className="whitespace-nowrap rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-semibold text-orange-600 dark:text-orange-400"
                          >
                            Auto check-out
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            Not checked in
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StaffAttendancePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner />
        </div>
      }
    >
      <StaffAttendanceInner />
    </Suspense>
  );
}
