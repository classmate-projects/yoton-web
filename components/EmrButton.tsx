"use client";

import { useState } from "react";
import { ClipboardList } from "lucide-react";
import PatientEmrModal from "@/components/PatientEmrModal";

interface EmrButtonProps {
  patientId: string | null | undefined;
  patientName: string | null | undefined;
  className?: string;
}

// Drop-in EMR button for any department page. Manages its own open/close state.
// Renders nothing when patientId is missing so callers don't need to guard.
export default function EmrButton({ patientId, patientName, className }: EmrButtonProps) {
  const [open, setOpen] = useState(false);

  if (!patientId) return null;

  const name = patientName ?? "Patient";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="View EMR"
        className={
          className ??
          "hover:bg-blue-50 dark:hover:bg-blue-950/30 p-1.5 rounded transition-colors cursor-pointer inline-flex items-center justify-center"
        }
      >
        <ClipboardList className="text-blue-600 dark:text-blue-400" size={16} />
      </button>

      {open && (
        <PatientEmrModal
          patientId={patientId}
          patientName={name}
          isOpen={open}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
