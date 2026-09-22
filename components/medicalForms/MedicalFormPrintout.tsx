"use client";

import { createPortal } from "react-dom";
import { Pencil, Printer, X } from "lucide-react";
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
  // Shown only to whoever filled and saved this particular form (server-computed - see
  // SavedMedicalFormController: CanEdit = CreatedByUserId == CurrentUserId). Anyone else can
  // still fill and save their own separate submission of the same template from the "Most
  // used"/"All forms" pickers - that was never blocked, only editing someone else's already-
  // saved entry is.
  canEdit?: boolean;
  onEdit?: () => void;
}

// Print preview + actual printout for one saved medical form. Same modal-with-preview shape
// as PrescriptionPrintout (Print button calls window.print(), a print-only duplicate of the
// body is what actually reaches paper), but portalled onto <body> instead of left in place -
// see the comment above the portal call below for why. One further addition here is
// `.print-theme-light`: MedicalFormRenderer's field labels/inputs are
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
  canEdit = false,
  onEdit,
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
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 no-print-backdrop">
        <div className="no-print flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="text-lg font-semibold text-foreground">Print Preview</h2>
            <div className="flex items-center gap-2">
              {canEdit && onEdit && (
                <button
                  onClick={onEdit}
                  className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary"
                >
                  <Pencil size={15} /> Edit
                </button>
              )}
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
      </div>

      {/* Portalled straight onto <body> rather than left in place - this component (and the
          whole page behind it) is nested arbitrarily deep in the app tree, so a `visibility`
          trick was the only way to keep it un-hideable from a hidden ancestor, but every one
          of those hidden ancestors still occupies its full normal-flow height (that's what
          visibility:hidden means - invisible, not gone), and that combined height is what
          Chrome paginates against when printing, regardless of how short THIS content is: a
          long page behind the modal turned into one real page of output plus N blank ones.
          A true top-level sibling of the rest of the app can instead have that whole app
          hidden with `display: none` (which DOES collapse layout height to zero), leaving only
          this content's own actual height to paginate against. */}
      {createPortal(<div className="print-only">{body}</div>, document.body)}

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
        /* Field labels/headings/paragraphs read their color off the --foreground/
           --muted-foreground CSS vars re-declared above, same as the disabled inputs handled
           above - but unlike those inputs, the plain text-foreground/text-muted-foreground
           utility classes they use don't reliably pick up that override (only whichever
           element happens to inherit a plain literal color, like this file's own
           text-black/text-gray-600, does) so they were still rendering in the live dark
           theme's near-white foreground colour - invisible on this white page. Matched by
           class-name substring rather than the exact (possibly opacity-suffixed, e.g.
           text-foreground/90) utility name, and left unprefixed with !important so an admin's
           own explicit per-field text color (an inline style, set in the builder) still wins.
        */
        .print-theme-light [class*="text-foreground"] {
          color: #020617;
        }
        .print-theme-light [class*="text-muted-foreground"] {
          color: #64748b;
        }
        .print-only {
          display: none;
        }
        @media print {
          /* The portal above makes .print-only a direct child of <body> - hiding every OTHER
             direct child (whatever the app's own root elements turn out to be, sonner's own
             toast portal included) removes the whole app from layout entirely, so the printed
             page count comes only from .print-only's own (short) content, in normal flow -
             no absolute/fixed positioning trick needed now that it isn't nested inside
             anything that also needs hiding. */
          body > *:not(.print-only) {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
}
