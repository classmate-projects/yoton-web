// Canonical "yyyy-MM-dd" <-> Date conversion, shared by every date field in the
// app (previously copy-pasted per-page). Built on local calendar fields, not
// UTC/ISO, so a picked day never shifts across a timezone boundary.

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateInputValue(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

// The API stores UTC in "timestamp without time zone" columns, so timestamps read back from
// the database arrive with no zone marker - new Date() alone would read them as local time.
export function parseServerUtcDate(value: string): Date {
  const needsZone = /T\d{2}:\d{2}/.test(value) && !/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  return new Date(needsZone ? `${value}Z` : value);
}
