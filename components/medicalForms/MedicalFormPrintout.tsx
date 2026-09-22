"use client";

import { Printer, X } from "lucide-react";
import { MedicalFormRow, MedicalFormValues } from "@/types/medicalForm.type";
import MedicalFormRenderer from "./MedicalFormRenderer";

export interface MedicalFormPrintoutProps {
  formTemplateName: string;
  patientName: string;
  patientNumber: string;
  createdByName?: string | null;
  createdAt: string;
  totalScore?: number | null;
  hasAbnormalValue?: boolean;
  rows: MedicalFormRow[];
  values: MedicalFormValues;
  onClose: () => void;
}

// Print preview + actual printout for one saved medical form. Same modal-with-preview shape
// as PrescriptionPrintout (Print button calls window.print(), a print-only duplicate of the
// body is what actually reaches paper via the .no-print/.print-only toggle below) - the one
// addition here is `.print-theme-light`: MedicalFormRenderer's field labels/inputs are
// theme-aware (text-foreground etc., reading the --foreground CSS variable), which resolves
// to near-white text whenever the app is in dark mode. Re-declaring the same variable names
// with their light-mode values on this wrapper overrides the inherited .dark ones for
// everything nested inside it - CSS custom property lookup always takes the nearest ancestor
// declaration - so the printed form is always dark-text-on-white regardless of the live theme.
export default function MedicalFormPrintout({
  formTemplateName,
  patientName,
  patientNumber,
  createdByName,
  createdAt,
  totalScore,
  hasAbnormalValue,
  rows,
  values,
  onClose,
}: MedicalFormPrintoutProps) {
  const print = () => window.print();

  const body = (
    <div className="print-theme-light bg-white p-6 text-black" style={{ width: "100%" }}>
      <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
        <div>
          <p className="text-xl font-bold">{formTemplateName}</p>
          <p className="text-xs text-gray-600">Medical Form</p>
        </div>
        {hasAbnormalValue && (
          <span className="shrink-0 rounded-full border border-red-600 px-2 py-0.5 text-xs font-semibold text-red-600">
            Abnormal value flagged
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <p>
          <span className="font-semibold">Patient:</span> {patientName}
        </p>
        <p>
          <span className="font-semibold">Patient No:</span> {patientNumber}
        </p>
        <p>
          <span className="font-semibold">Filled by:</span> {createdByName || "Unknown"}
        </p>
        <p>
          <span className="font-semibold">Date:</span> {new Date(createdAt).toLocaleString()}
        </p>
        {totalScore !== null && totalScore !== undefined && (
          <p className="col-span-2">
            <span className="font-semibold">Total score:</span> {totalScore}
          </p>
        )}
      </div>

      <div className="mt-5">
        <MedicalFormRenderer rows={rows} mode="view" values={values} />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 no-print-backdrop">
      <div className="no-print flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-semibold text-foreground">Print Preview</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={print}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <Printer size={15} /> Print
            </button>
            <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="overflow-auto p-6">{body}</div>
      </div>

      {/* Print-only render: the modal chrome above is hidden on print via .no-print, this is
          what actually reaches paper. */}
      <div className="print-only">{body}</div>

      <style jsx global>{`
        .print-theme-light {
          --background: #f8faff;
          --foreground: #020617;
          --card: #ffffff;
          --card-foreground: #020617;
          --primary: #2563eb;
          --primary-foreground: #ffffff;
          --muted: #f1f5f9;
          --muted-foreground: #64748b;
          --border: #e2e8f0;
          --input: #e2e8f0;
          --ring: #2563eb;
          --destructive: #ef4444;
        }
        /* Disabled inputs (this is a read-only "view" render) default to a washed-out, near-
           invisible grey in most browsers' print output - force them back to legible text on
           a white field so the printed values are actually readable. */
        .print-theme-light input:disabled,
        .print-theme-light select:disabled,
        .print-theme-light textarea:disabled {
          opacity: 1 !important;
          color: #000 !important;
          -webkit-text-fill-color: #000 !important;
          background: #ffffff !important;
          border-color: #94a3b8 !important;
        }
        .print-only {
          display: none;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          .no-print,
          .no-print-backdrop {
            display: none !important;
          }
          .print-only,
          .print-only * {
            visibility: visible;
          }
          .print-only {
            display: block;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
