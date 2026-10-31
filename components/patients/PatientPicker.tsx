"use client";

import { useEffect, useRef, useState } from "react";
import { Search, UserPlus, X } from "lucide-react";
import { ReceptionService } from "@/services/reception.service";
import type { PatientSummaryType } from "@/types/patient.type";
import { WalkInPatientBadge } from "./PatientBadges";
import QuickPatientModal, { type QuickPatientInitial } from "./QuickPatientModal";
import { nationalIdError, nationalIdLabel, useRegion } from "@/lib/region";
import type { Region } from "@/types/region.type";

interface Props {
  value: PatientSummaryType | null;
  onChange: (patient: PatientSummaryType | null) => void;
  // Offer "Register walk-in patient" (minimal details) when the person isn't on file yet.
  allowQuickAdd?: boolean;
  label?: string;
  // Lets a form with its own label style keep it (defaults to the standard field label).
  labelClassName?: string;
  required?: boolean;
  disabled?: boolean;
}

// Turns whatever was typed into a head start for the quick-add form: a value in the
// installation's national ID format is the ID, a long digit run is a mobile number,
// anything else is the name.
const initialFromQuery = (query: string, region: Region | null): QuickPatientInitial => {
  const q = query.trim();
  const digits = q.replace(/\D/g, "");
  if (region && /\d/.test(q) && nationalIdError(region, q) === null) return { nationalID: q };
  if (/^[\d\s+()-]+$/.test(q) && digits.length >= 6) return { phone: digits };
  if (/^[A-Za-z]{1,2}\d{5,8}$/.test(q)) return { passportNumber: q.toUpperCase() };
  return { name: q };
};

// The one patient lookup every department uses: search by MRN, mobile, national ID/passport
// or name (server-side, so it doesn't need the whole patient list), and register a walk-in
// with minimal details right here when they're new.
export default function PatientPicker({
  value,
  onChange,
  allowQuickAdd = true,
  label = "Patient",
  labelClassName = "text-sm font-bold text-foreground/90",
  required,
  disabled,
}: Props) {
  const region = useRegion();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientSummaryType[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [quickAdd, setQuickAdd] = useState<QuickPatientInitial | null>(null);
  const searchSeq = useRef(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const seq = ++searchSeq.current;
    const handle = setTimeout(async () => {
      try {
        const res = await ReceptionService.searchPatients(q);
        if (seq === searchSeq.current) {
          setResults(res.data ?? []);
          setHighlight(0);
        }
      } catch {
        if (seq === searchSeq.current) setResults([]);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  // Close the dropdown on an outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (patient: PatientSummaryType) => {
    onChange(patient);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      // Never let Enter submit the surrounding form from the search box.
      e.preventDefault();
      if (results[highlight]) pick(results[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const trimmed = query.trim();

  return (
    <div className="relative" ref={boxRef}>
      <label className={`${labelClassName} ${required ? "required" : ""}`}>{label}</label>

      {value ? (
        <div className="mt-1 flex items-start justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-semibold text-foreground">{value.name}</p>
              <WalkInPatientBadge registrationType={value.registrationType} />
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {[
                value.opNumber ? `MRN ${value.opNumber}` : null,
                value.phone ? `${value.phoneCode ?? ""}${value.phone}` : null,
                value.nationalID || (value.passportNumber ? `Passport ${value.passportNumber}` : null),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 cursor-pointer"
            >
              Change
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="relative mt-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              autoComplete="off"
              disabled={disabled}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              placeholder={`Search by name, mobile, MRN or ${nationalIdLabel(region)}...`}
              className="w-full rounded-lg border border-border bg-muted p-3 pl-9 pr-9 text-foreground outline-none focus:border-primary"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                title="Clear"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-card cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {open && (trimmed.length >= 2 || allowQuickAdd) && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
              {trimmed.length >= 2 && (
                searching && results.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">Searching...</p>
                ) : results.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">No registered patient matches &quot;{trimmed}&quot;.</p>
                ) : (
                  results.map((p, i) => (
                    <button
                      type="button"
                      key={p.opId}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => pick(p)}
                      className={`w-full border-b border-border px-4 py-2 text-left transition-colors last:border-b-0 ${
                        i === highlight ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{p.name}</span>
                        <WalkInPatientBadge registrationType={p.registrationType} />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        MRN {p.opNumber || "—"}
                        {p.phone ? ` · ${p.phone}` : ""}
                        {p.nationalID ? ` · ${p.nationalID}` : p.passportNumber ? ` · Passport ${p.passportNumber}` : ""}
                      </div>
                    </button>
                  ))
                )
              )}
              {allowQuickAdd && (
                <button
                  type="button"
                  onClick={() => {
                    setQuickAdd(initialFromQuery(trimmed, region));
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 border-t border-border bg-muted/40 px-4 py-2.5 text-left text-sm font-semibold text-primary hover:bg-primary/10 cursor-pointer"
                >
                  <UserPlus size={15} />
                  Register walk-in patient{trimmed ? ` "${trimmed}"` : ""}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {quickAdd && (
        <QuickPatientModal
          initial={quickAdd}
          onClose={() => setQuickAdd(null)}
          onSelect={(patient) => {
            setQuickAdd(null);
            pick(patient);
          }}
        />
      )}
    </div>
  );
}

// A picker value for an order that's being corrected - the order already carries the
// patient's name/MRN, so there's no need to look them up again.
export const patientFromOrder = (order: {
  patientId: string | null;
  patientName: string;
  patientOPNumber?: string | null;
  patientRegistrationType?: string | null;
}): PatientSummaryType | null =>
  order.patientId
    ? {
        opId: order.patientId,
        opNumber: order.patientOPNumber ?? null,
        name: order.patientName,
        sex: null,
        dateOfBirth: null,
        phone: null,
        phoneCode: null,
        nationalID: null,
        passportNumber: null,
        registrationType: order.patientRegistrationType === "External" ? "External" : "Full",
      }
    : null;
