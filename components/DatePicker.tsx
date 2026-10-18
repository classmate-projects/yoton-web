"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  isValid,
  parse,
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
  // Display + typed format, e.g. "dd-MM-yyyy". Defaults to "MMM d, yyyy". When the format is
  // purely numeric (day/month/year digits with simple separators, not a word-month like
  // "MMM"), typing auto-inserts the format's own separators as digits are entered.
  dateFormat?: string;
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

const DEFAULT_DATE_FORMAT = "MMM d, yyyy";

// Fallback formats accepted from typed input if the field's own `dateFormat` doesn't match -
// covers the common ways people type a date by hand regardless of the display format in use.
const TYPED_DATE_FORMATS = [
  "yyyy-MM-dd",
  "yyyy/MM/dd",
  "dd-MM-yyyy",
  "dd/MM/yyyy",
  "MM/dd/yyyy",
  "M/d/yyyy",
  "MM-dd-yyyy",
  "MMM d, yyyy",
  "MMMM d, yyyy",
  "MMM d yyyy",
  "MMMM d yyyy",
];

function parseTypedDate(raw: string, dateFormat: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const primary = parseStrict(trimmed, dateFormat);
  if (primary) return primary;
  for (const candidate of TYPED_DATE_FORMATS) {
    const parsed = parseStrict(trimmed, candidate);
    if (parsed) return parsed;
  }
  return null;
}

function formatForDisplay(value: string, dateFormat: string): string {
  const date = parseDateInputValue(value);
  return date ? format(date, dateFormat) : "";
}

// A format is "maskable" when every part of it is a day/month/year digit run or a simple
// separator - e.g. "dd-MM-yyyy" or "yyyy/MM/dd". A word-month format like "MMM d, yyyy"
// isn't, since "MMM" isn't something you can auto-insert digits into.
function isNumericDateFormat(dateFormat: string): boolean {
  return /^[dMy\-/. ]+$/.test(dateFormat) && !dateFormat.includes("MMM");
}

type FormatToken = { field: "d" | "M" | "y"; digits: number } | { literal: string };

function tokenizeDateFormat(dateFormat: string): FormatToken[] {
  const tokens: FormatToken[] = [];
  let i = 0;
  while (i < dateFormat.length) {
    const ch = dateFormat[i];
    if (ch === "d" || ch === "M" || ch === "y") {
      let j = i;
      while (j < dateFormat.length && dateFormat[j] === ch) j++;
      tokens.push({ field: ch, digits: j - i });
      i = j;
    } else {
      tokens.push({ literal: ch });
      i++;
    }
  }
  return tokens;
}

// Validates a fully-typed numeric date string against its own format's shape and per-field
// ranges - e.g. "dd-MM-yyyy" becomes /^(0[1-9]|[12]\d|3[01])-(0[1-9]|1[0-2])-\d{4}$/, so day is
// constrained to 01-31 and month to 01-12 by construction. This is a fast, explicit structural
// check ahead of the calendar-aware date-fns parse in parseStrict below, which is what actually
// catches calendar-invalid combinations (e.g. Feb 30) that a shape regex alone can't.
function buildNumericFormatRegex(dateFormat: string): RegExp {
  const pattern = tokenizeDateFormat(dateFormat)
    .map((token) => {
      if ("literal" in token) return token.literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (token.field === "d") return "(0[1-9]|[12]\\d|3[01])";
      if (token.field === "M") return "(0[1-9]|1[0-2])";
      return `\\d{${token.digits}}`;
    })
    .join("");
  return new RegExp(`^${pattern}$`);
}

// Reads whichever day/month/year fields are fully typed so far out of a numeric-masked value,
// leaving the rest null - lets the calendar track the day/month/year the user is actively
// typing instead of only updating once the whole date parses as valid. digitsOnly is already
// clamped into range by applyDateMask before this ever sees it, so no re-validation is needed
// here beyond "is this field's digit group complete".
function parsePartialDigits(text: string, dateFormat: string): { day: number | null; month: number | null; year: number | null } {
  const tokens = tokenizeDateFormat(dateFormat);
  const digitsOnly = text.replace(/\D/g, "");
  let digitIndex = 0;
  const parts: { day: number | null; month: number | null; year: number | null } = {
    day: null,
    month: null,
    year: null,
  };
  for (const token of tokens) {
    if ("literal" in token) continue;
    const chunk = digitsOnly.slice(digitIndex, digitIndex + token.digits);
    digitIndex += token.digits;
    if (chunk.length !== token.digits) continue;
    const n = Number(chunk);
    if (token.field === "d") parts.day = n;
    else if (token.field === "M") parts.month = n;
    else parts.year = token.digits === 2 ? 2000 + n : n;
  }
  return parts;
}

// Live input mask: strips everything but digits out of whatever was typed/pasted, then
// re-inserts the format's own separators as each digit group fills up - typing "24082026"
// into a "dd-MM-yyyy" field produces "24-08-2026" as you go, and pasting the same works too.
// Once a day or month group is fully typed, it's also clamped into range (1-31 / 1-12) right
// away - typing "35" for the day snaps to "31" rather than silently accepting it and letting
// it roll over into some other month on commit.
function applyDateMask(raw: string, dateFormat: string): string {
  const tokens = tokenizeDateFormat(dateFormat);
  const totalDigits = tokens.reduce((sum, t) => sum + ("digits" in t ? t.digits : 0), 0);
  const digitsOnly = raw.replace(/\D/g, "").slice(0, totalDigits);

  let out = "";
  let digitIndex = 0;
  for (const token of tokens) {
    if ("literal" in token) {
      if (digitIndex < digitsOnly.length) out += token.literal;
    } else {
      let chunk = digitsOnly.slice(digitIndex, digitIndex + token.digits);
      if (!chunk) break;
      if (chunk.length === token.digits && token.field !== "y") {
        const max = token.field === "d" ? 31 : 12;
        const clamped = Math.min(Math.max(Number(chunk), 1), max);
        chunk = String(clamped).padStart(token.digits, "0");
      }
      out += chunk;
      digitIndex += token.digits;
    }
  }
  return out;
}

// date-fns' parse() doesn't reject out-of-range day/month combinations (e.g. Feb 30) - it
// silently rolls them over into a different, real date instead (Feb 30 -> Mar 2), which
// isValid() then happily reports as valid. Re-formatting the parsed date with the same
// format and comparing it back to what was actually typed catches that: a rollover always
// changes the text, so a mismatch means the typed date was never real to begin with.
function parseStrict(text: string, dateFormat: string): Date | null {
  if (isNumericDateFormat(dateFormat) && !buildNumericFormatRegex(dateFormat).test(text)) {
    return null;
  }
  const parsed = parse(text, dateFormat, new Date());
  if (!isValid(parsed)) return null;
  return format(parsed, dateFormat) === text ? parsed : null;
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
  dateFormat = DEFAULT_DATE_FORMAT,
}: DatePickerProps) {
  const maskEnabled = useMemo(() => isNumericDateFormat(dateFormat), [dateFormat]);
  const selected = useMemo(() => parseDateInputValue(value), [value]);
  const minDate = useMemo(() => (min ? parseDateInputValue(min) : null), [min]);
  const maxDate = useMemo(() => (max ? parseDateInputValue(max) : null), [max]);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("days");
  const [viewDate, setViewDate] = useState<Date>(selected ?? new Date());
  const [yearsPageStart, setYearsPageStart] = useState(
    Math.floor((selected ?? new Date()).getFullYear() / YEARS_PER_PAGE) * YEARS_PER_PAGE,
  );

  // Editable text mirror of `value` - lets the field be typed into directly instead of
  // only ever set by clicking a day. Kept as separate state (rather than driving the input
  // straight off `value`) so keystrokes aren't clobbered by the yyyy-MM-dd <-> Date <->
  // display-string round trip on every render; it's only resynced from `value` on commit
  // (blur/Enter) or when a day is picked from the calendar.
  const [text, setText] = useState(() => formatForDisplay(value, dateFormat));
  useEffect(() => {
    setText(formatForDisplay(value, dateFormat));
  }, [value, dateFormat]);

  // Whichever day/month/year fields are fully typed so far, independent of whether the whole
  // date is valid yet - drives the calendar navigation and the in-progress day highlight below
  // while the rest of the date is still being typed. Only meaningful for a numeric-masked
  // format (e.g. "dd-MM-yyyy") - tokenizeDateFormat treats every d/M/y run as a fixed-width
  // digit slot, which is wrong for a word-month format like the default "MMM d, yyyy" (its
  // "MMM" isn't 3 digits). Left ungated, opening the picker on an already-filled "Aug 30,
  // 2026" field stripped it to digits "302026" and sliced the first 3 as a "month" of 302,
  // which the navigation effect below then rolled over into February 2051.
  const typedParts = useMemo(
    () => (open && maskEnabled ? parsePartialDigits(text, dateFormat) : { day: null, month: null, year: null }),
    [open, maskEnabled, text, dateFormat],
  );

  // What's currently typed, resolved live to a Date once it forms a complete valid date -
  // null while incomplete/invalid. Takes over from `selected` (the last committed value) for
  // the grid's highlight and the popup's month/year while the field is focused, so the
  // calendar tracks typing the way a normal date picker does instead of only updating on blur.
  const liveTypedDate = useMemo(
    () => (open ? parseTypedDate(text, dateFormat) : null),
    [open, text, dateFormat],
  );
  const displayedDate = liveTypedDate ?? selected;
  const digitsTyped = open && text.replace(/\D/g, "").length > 0;

  // Navigates the calendar to whichever month/year is being typed, the moment each becomes
  // available - falls back to whatever the grid is already showing for the part not typed yet,
  // so typing the day first doesn't move the view, and typing the month jumps the grid right
  // away instead of waiting for the year to complete the date too.
  useEffect(() => {
    if (!open || (typedParts.month == null && typedParts.year == null)) return;
    setViewDate((d) => {
      const year = typedParts.year ?? d.getFullYear();
      const monthIndex = (typedParts.month ?? d.getMonth() + 1) - 1;
      return year === d.getFullYear() && monthIndex === d.getMonth() ? d : new Date(year, monthIndex, 1);
    });
  }, [open, typedParts.month, typedParts.year]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  // Popup is portaled to document.body (see render below) so it can't be
  // clipped by an ancestor's `overflow: hidden` (e.g. the `.card` class) —
  // that means it needs its own viewport-relative coordinates instead of
  // relying on `position: absolute` + a `relative` wrapper.
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const updateCoords = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const popupWidth = 288; // w-72
    const estimatedPopupHeight = 380; // conservative estimate; view-dependent
    let left = rect.left;
    if (left + popupWidth > window.innerWidth - 8) {
      left = Math.max(8, rect.right - popupWidth);
    }
    let top = rect.bottom + 8;
    if (top + estimatedPopupHeight > window.innerHeight - 8 && rect.top - estimatedPopupHeight - 8 > 0) {
      top = rect.top - estimatedPopupHeight - 8;
    }
    setCoords({ top, left });
  };

  useEffect(() => {
    if (!open) return;
    updateCoords();
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideWrapper = wrapperRef.current?.contains(target);
      const insidePopup = popupRef.current?.contains(target);
      if (!insideWrapper && !insidePopup) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
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

  // Parses whatever's currently typed and, if it's a valid in-range date, commits it
  // through onChange same as picking a day would; otherwise reverts the field back to
  // the last committed value's display text. Fired on blur and on Enter.
  const commitTypedValue = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      if (value !== "") onChange("");
      else setText("");
      return;
    }

    const parsed = parseTypedDate(trimmed, dateFormat);
    if (!parsed || isDayDisabled(parsed)) {
      setText(formatForDisplay(value, dateFormat));
      return;
    }

    const iso = toDateInputValue(parsed);
    if (iso !== value) onChange(iso);
    else setText(formatForDisplay(value, dateFormat));
  };

  const gridDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate));
    const end = endOfWeek(endOfMonth(viewDate));
    return eachDayOfInterval({ start, end });
  }, [viewDate]);

  return (
    <div ref={wrapperRef} className="relative">
      <div
        ref={triggerRef}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={
          className ||
          `flex h-11 w-full items-center gap-2 overflow-hidden rounded-xl border border-input bg-card px-4 py-2 text-lg text-foreground ring-offset-background transition-all focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
            disabled ? "cursor-not-allowed opacity-50" : ""
          }`
        }
      >
        <input
          type="text"
          id={id}
          disabled={disabled}
          required={required}
          inputMode={maskEnabled ? "numeric" : undefined}
          value={text}
          onChange={(e) => setText(maskEnabled ? applyDateMask(e.target.value, dateFormat) : e.target.value)}
          onFocus={(e) => {
            e.target.select();
            openPicker();
          }}
          onBlur={(e) => {
            commitTypedValue();
            // Closing only on an outside *click* (see the mousedown listener above) misses
            // Tab/Shift+Tab, which moves focus without ever firing a click - the popup was
            // then left open indefinitely until the user happened to click elsewhere.
            // relatedTarget is the element about to receive focus; skip closing when it's a
            // button inside the popup itself (day/month/year/Today/Clear) so a mouse click
            // there isn't cut off mid-click - that button's own onClick already closes it.
            if (!popupRef.current?.contains(e.relatedTarget as Node | null)) {
              setOpen(false);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitTypedValue();
              setOpen(false);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="min-w-0 flex-1 min-h-0 rounded-[inherit] border-0 bg-transparent p-0 text-left outline-none ring-0 ring-offset-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={openPicker}
          aria-label="Open calendar"
          tabIndex={-1}
          className="shrink-0 rounded-lg text-muted-foreground outline-none transition-colors hover:text-foreground disabled:cursor-not-allowed"
        >
          <CalendarDays size={18} />
        </button>
      </div>

      {/* Hidden input so this still participates in native form semantics
          (required validation, form.reset(), etc.) without rendering a
          second visible control. */}
      {name && (
        <input type="hidden" name={name} value={value} required={required} />
      )}

      {open && coords && createPortal(
        <div
          ref={popupRef}
          role="dialog"
          style={{ position: "fixed", top: coords.top, left: coords.left }}
          className="z-[300] w-72 overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
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
                  // While a full valid date is typed/selected, highlight exactly that day.
                  // Otherwise, as soon as just the day digits are in, preview that day number
                  // within whichever month the grid is currently showing - e.g. typing "18"
                  // highlights the 18th right away, before month or year are typed at all.
                  const isSelected = liveTypedDate
                    ? isSameDay(day, liveTypedDate)
                    : digitsTyped
                      ? typedParts.day != null && !outOfMonth && day.getDate() === typedParts.day
                      : !!(selected && isSameDay(day, selected));
                  const dayDisabled = isDayDisabled(day);
                  return (
                    <button
                      type="button"
                      key={day.toISOString()}
                      disabled={dayDisabled}
                      onClick={() => pickDay(day)}
                      className={[
                        "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-all",
                        dayDisabled
                          ? isSelected
                            ? "cursor-not-allowed bg-muted text-muted-foreground/40 ring-1 ring-inset ring-destructive/50"
                            : "cursor-not-allowed text-muted-foreground/40"
                          : isSelected
                            ? "bg-primary font-bold text-primary-foreground shadow-md shadow-primary/30"
                            : outOfMonth
                              ? "text-muted-foreground/50 hover:bg-muted"
                              : "text-foreground hover:bg-muted",
                        !isSelected && !dayDisabled && isToday(day) ? "ring-1 ring-inset ring-primary/60" : "",
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
                    displayedDate &&
                    displayedDate.getFullYear() === viewDate.getFullYear() &&
                    displayedDate.getMonth() === monthIndex;
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
                  const isSelectedYear = displayedDate && displayedDate.getFullYear() === year;
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
        </div>,
        document.body
      )}
    </div>
  );
}
