"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { UserSearch, X } from "lucide-react";
import type { PatientMatchType } from "@/types/patient.type";
import { PatientMatchList, matchedOnText } from "./DuplicatePatientPrompt";

interface Props {
  matches: PatientMatchType[];
  onContinue: (match: PatientMatchType) => void;
  onDismiss: () => void;
  busyId?: string | null;
}

// Pinned to the bottom of the screen while a registration form is being filled in, as soon
// as an ID number / mobile / email typed so far belongs to someone already on file - so the
// receptionist can switch to that record before entering everything twice.
export default function ExistingPatientNotice({ matches, onContinue, onDismiss, busyId }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (matches.length === 0) return null;
  const strong = matches.some((m) => m.isStrongMatch);
  const top = matches[0];

  return createPortal(
    <div className="fixed inset-x-0 bottom-4 z-[65] flex justify-center px-4 pointer-events-none">
      <div
        className={`pointer-events-auto w-full max-w-2xl rounded-xl border bg-card p-4 shadow-2xl ${
          strong ? "border-amber-500/60" : "border-border"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <UserSearch size={20} className={`mt-0.5 shrink-0 ${strong ? "text-amber-500" : "text-primary"}`} />
            <div className="min-w-0">
              <p className="font-semibold text-foreground">
                {strong ? "This patient is already registered" : "Possible existing patient"}
              </p>
              <p className="text-sm text-muted-foreground">
                {top.name} (MRN {top.opNumber || "—"}) has the same {matchedOnText(top.matchedOn)}
                {matches.length > 1 ? `, plus ${matches.length - 1} more` : ""}. Continue with the existing record instead of creating a duplicate?
              </p>
            </div>
          </div>
          <button type="button" onClick={onDismiss} title="Dismiss" className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {expanded ? (
          <div className="mt-3 max-h-64 overflow-y-auto">
            <PatientMatchList matches={matches} actionLabel="Continue with this profile" onPick={onContinue} busyId={busyId} />
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {matches.length > 1 && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted cursor-pointer"
              >
                Show all {matches.length}
              </button>
            )}
            <button
              type="button"
              onClick={() => onContinue(top)}
              disabled={busyId != null}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 cursor-pointer disabled:opacity-60"
            >
              {busyId === top.opId ? "Opening..." : `Continue with ${top.name}`}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
