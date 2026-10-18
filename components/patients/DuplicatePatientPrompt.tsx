"use client";

import { createPortal } from "react-dom";
import { UserCheck } from "lucide-react";
import type { PatientMatchType } from "@/types/patient.type";
import { WalkInPatientBadge } from "./PatientBadges";

const formatDob = (value: string | null) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString() : null);

// "Emirates ID & mobile number" - ID document names keep their capitals.
export const matchedOnText = (labels: string[]) =>
  labels.map((label) => (/\bID\b/.test(label) ? label : label.toLowerCase())).join(" & ");

// Existing patients that share an ID / mobile / email with the one being entered, each with
// a button to carry on with that record instead of creating a duplicate.
export function PatientMatchList({
  matches,
  actionLabel = "Use this patient",
  onPick,
  busyId,
}: {
  matches: PatientMatchType[];
  actionLabel?: string;
  onPick: (match: PatientMatchType) => void;
  busyId?: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      {matches.map((m) => (
        <div
          key={m.opId}
          className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${
            m.isStrongMatch ? "border-amber-500/50 bg-amber-500/5" : "border-border bg-card"
          }`}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-foreground">{m.name}</p>
              <WalkInPatientBadge registrationType={m.registrationType} />
            </div>
            <p className="text-xs text-muted-foreground">
              MRN {m.opNumber || "—"}
              {m.phone ? ` · ${m.phoneCode ?? ""}${m.phone}` : ""}
              {formatDob(m.dateOfBirth) ? ` · DOB ${formatDob(m.dateOfBirth)}` : ""}
              {m.nationalID ? ` · ${m.nationalID}` : ""}
              {m.passportNumber ? ` · Passport ${m.passportNumber}` : ""}
            </p>
            <p className={`mt-0.5 text-xs font-semibold ${m.isStrongMatch ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
              Same {matchedOnText(m.matchedOn)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onPick(m)}
            disabled={busyId != null}
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60"
          >
            <UserCheck size={14} />
            {busyId === m.opId ? "Opening..." : actionLabel}
          </button>
        </div>
      ))}
    </div>
  );
}

interface Props {
  matches: PatientMatchType[];
  onContinue: (match: PatientMatchType) => void;
  // Offered only when nothing matched on an ID number - a shared mobile/email can still be
  // a different person (e.g. a family member), an ID can't.
  onCreateNew?: () => void;
  onCancel: () => void;
  continueLabel?: string;
  busyId?: string | null;
}

export default function DuplicatePatientPrompt({ matches, onContinue, onCreateNew, onCancel, continueLabel, busyId }: Props) {
  const hasStrongMatch = matches.some((m) => m.isStrongMatch);
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-2xl">
        <h2 className="text-xl font-semibold text-foreground">This patient may already be registered</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasStrongMatch
            ? "An existing record has the same ID number. Continue with that profile so their history stays in one place."
            : "An existing record shares some of these details. Continue with it, or create a new record if this is a different person."}
        </p>

        <div className="mt-4 max-h-[50vh] overflow-y-auto">
          <PatientMatchList
            matches={matches}
            actionLabel={continueLabel ?? "Continue with this profile"}
            onPick={onContinue}
            busyId={busyId}
          />
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busyId != null}
            className="rounded-md border border-border px-5 py-2.5 text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            Go back
          </button>
          {onCreateNew && !hasStrongMatch && (
            <button
              type="button"
              onClick={onCreateNew}
              disabled={busyId != null}
              className="rounded-md border border-primary/40 px-5 py-2.5 font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-60"
            >
              Different person - create new
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
