"use client";

import { Printer, X } from "lucide-react";

export interface DispenseLabelPrintoutProps {
  patientName: string;
  drugName: string;
  drugType?: string | null;
  dosage?: string | null;
  dosageUnit?: string | null;
  frequency?: string | null;
  instructions?: string | null;
  dispensedDate: string;
  onClose: () => void;
}

const dosageLine = (m: Pick<DispenseLabelPrintoutProps, "dosage" | "dosageUnit" | "frequency">) =>
  [m.dosage && m.dosageUnit ? `${m.dosage} ${m.dosageUnit}` : m.dosage, m.frequency].filter(Boolean).join(" · ");

// A small adhesive label to stick on the dispensed medicine's packet/bottle - distinct from
// PrescriptionPrintout.tsx's full-page prescription, which this mirrors structurally (modal
// preview + hidden print-only render + .no-print/@media print CSS + window.print()). Sized
// for a 4"x2" label via @page, a common pharmacy/shipping label size - adjust once the
// actual label stock/printer is known.
export default function DispenseLabelPrintout(props: DispenseLabelPrintoutProps) {
  const { onClose } = props;
  const print = () => window.print();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 no-print-backdrop">
      <div className="no-print flex max-h-[90vh] w-full max-w-sm flex-col rounded-xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-semibold text-foreground">Dispense Label</h2>
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
        <div className="overflow-auto p-6">
          <LabelBody {...props} />
        </div>
      </div>

      {/* Print-only render: the modal chrome above is hidden on print via .no-print, this
          is what actually reaches the label. */}
      <div className="print-only">
        <LabelBody {...props} />
      </div>

      <style jsx global>{`
        .print-only {
          display: none;
        }
        @media print {
          @page {
            size: 4in 2in;
            margin: 0;
          }
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

function LabelBody({ patientName, drugName, drugType, dosage, dosageUnit, frequency, instructions, dispensedDate }: DispenseLabelPrintoutProps) {
  const dosageText = dosageLine({ dosage, dosageUnit, frequency });
  return (
    <div className="bg-white p-4 text-black" style={{ width: "4in", minHeight: "2in" }}>
      <p className="text-base font-bold leading-tight">
        {drugName}
        {drugType && <span className="font-normal text-gray-600"> ({drugType})</span>}
      </p>
      <p className="mt-1 text-sm font-semibold">{dosageText || "—"}</p>
      {instructions && <p className="mt-1 text-xs text-gray-700">{instructions}</p>}
      <div className="mt-3 border-t border-black pt-1 text-xs">
        <p>
          <span className="font-semibold">Patient:</span> {patientName}
        </p>
        <p>
          <span className="font-semibold">Dispensed:</span> {dispensedDate}
        </p>
      </div>
    </div>
  );
}
