"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { parseDateInputValue, toDateInputValue } from "@/lib/date";

interface DatePickerProps {
  value: string; // "yyyy-MM-dd", or "" for no selection
  onChange: (value: string) => void;
  min?: string; // "yyyy-MM-dd"
  max?: string; // "yyyy-MM-dd"
  placeholder?: string;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

type View = "days" | "months" | "years";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const YEARS_PER_PAGE = 12;

// A whole month/year is disabled only when it falls entirely outside
// [min, max] — individual out-of-range days are handled separately in the
// day grid, so a month that's only partly in range stays clickable.
function isMonthDisabled(year: number, month: number, min: Date | null, max: Date | null) {
  const monthStart = new Date(year, month, 1);
  const monthEnd = endOfMonth(monthStart);
  if (min && isBefore(monthEnd, min) && !isSameDay(monthEnd, min)) return true;
  if (max && isAfter(monthStart, max) && !isSameDay(monthStart, max)) return true;
  return false;
}

function isYearDisabled(year: number, min: Date | null, max: Date | null) {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  if (min && isBefore(yearEnd, min)) return true;
  if (max && isAfter(yearStart, max)) return true;
  return false;
}

export default function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Select date",
  id,
  name,
  required,
  disabled,
  className = "",
}: DatePickerProps) {
  const selected = useMemo(() => parseDateInputValue(value), [value]);
  const minDate = useMemo(() => (min ? parseDateInputValue(min) : null), [min]);
  const maxDate = useMemo(() => (max ? parseDateInputValue(max) : null), [max]);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("days");
  const [viewDate, setViewDate] = useState<Date>(selected ?? new Date());
  const [yearsPageStart, setYearsPageStart] = useState(
    Math.floor((selected ?? new Date()).getFullYear() / YEARS_PER_PAGE) * YEARS_PER_PAGE,
  );

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const openPicker = () => {
    if (disabled) return;
    const base = selected ?? new Date();
    setViewDate(base);
    setYearsPageStart(Math.floor(base.getFullYear() / YEARS_PER_PAGE) * YEARS_PER_PAGE);
    setView("days");
    setOpen(true);
  };

  const isDayDisabled = (day: Date) => {
    if (minDate && isBefore(day, minDate) && !isSameDay(day, minDate)) return true;
    if (maxDate && isAfter(day, maxDate) && !isSameDay(day, maxDate)) return true;
    return false;
  };

  const pickDay = (day: Date) => {
    if (isDayDisabled(day)) return;
    onChange(toDateInputValue(day));
    setOpen(false);
  };

  const gridDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate));
    const end = endOfWeek(endOfMonth(viewDate));
    return eachDayOfInterval({ start, end });
  }, [viewDate]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={openPicker}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={
          className ||
          "flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-input bg-card px-4 py-2 text-left text-lg text-foreground ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        }
      >
        <span className={selected ? "" : "text-muted-foreground"}>
          {selected ? format(selected, "MMM d, yyyy") : placeholder}
        </span>
        <CalendarDays size={18} className="shrink-0 text-muted-foreground" />
      </button>

      {/* Hidden input so this still participates in native form semantics
          (required validation, form.reset(), etc.) without rendering a
          second visible control. */}
      {name && (
        <input type="hidden" name={name} value={value} required={required} />
      )}

      {open && (
        <div
          role="dialog"
          className="absolute z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        >
          {view === "days" && (
            <>
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setViewDate((d) => subMonths(d, 1))}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Previous month"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setView("months")}
                  className="rounded-lg px-3 py-1 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  {format(viewDate, "MMMM yyyy")}
                </button>
                <button
                  type="button"
                  onClick={() => setViewDate((d) => addMonths(d, 1))}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Next month"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-y-1 text-center">
                {WEEKDAYS.map((wd) => (
                  <span key={wd} className="text-xs font-semibold text-muted-foreground">
                    {wd}
                  </span>
                ))}
                {gridDays.map((day) => {
                  const outOfMonth = !isSameMonth(day, viewDate);
                  const isSelected = selected && isSameDay(day, selected);
                  const dayDisabled = isDayDisabled(day);
                  return (
                    <button
                      type="button"
                      key={day.toISOString()}
                      disabled={dayDisabled}
                      onClick={() => pickDay(day)}
                      className={[
                        "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-all",
                        isSelected
                          ? "bg-primary font-bold text-primary-foreground shadow-md shadow-primary/30"
                          : dayDisabled
                            ? "cursor-not-allowed text-muted-foreground/40"
                            : outOfMonth
                              ? "text-muted-foreground/50 hover:bg-muted"
                              : "text-foreground hover:bg-muted",
                        !isSelected && isToday(day) ? "ring-1 ring-inset ring-primary/60" : "",
                      ].join(" ")}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {view === "months" && (
            <>
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setViewDate((d) => new Date(d.getFullYear() - 1, d.getMonth(), 1))}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Previous year"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setView("years")}
                  className="rounded-lg px-3 py-1 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  {viewDate.getFullYear()}
                </button>
                <button
                  type="button"
                  onClick={() => setViewDate((d) => new Date(d.getFullYear() + 1, d.getMonth(), 1))}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Next year"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {MONTHS.map((label, monthIndex) => {
                  const monthDisabled = isMonthDisabled(viewDate.getFullYear(), monthIndex, minDate, maxDate);
                  const isSelectedMonth =
                    selected &&
                    selected.getFullYear() === viewDate.getFullYear() &&
                    selected.getMonth() === monthIndex;
                  return (
                    <button
                      type="button"
                      key={label}
                      disabled={monthDisabled}
                      onClick={() => {
                        setViewDate(new Date(viewDate.getFullYear(), monthIndex, 1));
                        setView("days");
                      }}
                      className={[
                        "rounded-lg py-2 text-sm font-medium transition-all",
                        isSelectedMonth
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                          : monthDisabled
                            ? "cursor-not-allowed text-muted-foreground/40"
                            : "text-foreground hover:bg-muted",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {view === "years" && (
            <>
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setYearsPageStart((y) => y - YEARS_PER_PAGE)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Previous years"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm font-semibold text-foreground">
                  {yearsPageStart} – {yearsPageStart + YEARS_PER_PAGE - 1}
                </span>
                <button
                  type="button"
                  onClick={() => setYearsPageStart((y) => y + YEARS_PER_PAGE)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Next years"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearsPageStart + i).map((year) => {
                  const yearDisabled = isYearDisabled(year, minDate, maxDate);
                  const isSelectedYear = selected && selected.getFullYear() === year;
                  return (
                    <button
                      type="button"
                      key={year}
                      disabled={yearDisabled}
                      onClick={() => {
                        setViewDate(new Date(year, viewDate.getMonth(), 1));
                        setView("months");
                      }}
                      className={[
                        "rounded-lg py-2 text-sm font-medium transition-all",
                        isSelectedYear
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                          : yearDisabled
                            ? "cursor-not-allowed text-muted-foreground/40"
                            : "text-foreground hover:bg-muted",
                      ].join(" ")}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                if (isDayDisabled(now)) return;
                onChange(toDateInputValue(now));
                setOpen(false);
              }}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              Today
            </button>
            {selected && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
