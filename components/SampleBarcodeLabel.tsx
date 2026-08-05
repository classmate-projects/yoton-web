"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { Printer } from "lucide-react";

export interface SampleBarcodeLabelData {
  labRequestId: string;
  testName: string;
  doctorName: string;
  date: string;
  mrn: string;
  collectedByName: string;
  visitId?: string | null;
}

interface SampleBarcodeLabelProps {
  label: SampleBarcodeLabelData;
}

// 2cm (height) x 3cm (width) sample-collection label — barcode encodes the lab
// request id so it can be scanned back to this record; the surrounding text is the
// human-readable fields the spec requires on the physical label.
export default function SampleBarcodeLabel({ label }: SampleBarcodeLabelProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!barcodeRef.current) return;
    JsBarcode(barcodeRef.current, label.labRequestId, {
      format: "CODE128",
      width: 1,
      height: 22,
      fontSize: 8,
      margin: 0,
      displayValue: false,
    });
  }, [label.labRequestId]);

  const print = () => window.print();

  return (
    <div>
      <div className="print-label mx-auto flex flex-col items-center justify-center gap-0.5 border border-border bg-white p-1 text-black" style={{ width: "3cm", height: "2cm" }}>
        <p className="w-full truncate text-center text-[6px] font-semibold leading-tight">{label.testName}</p>
        <svg ref={barcodeRef} className="w-full" />
        <p className="w-full truncate text-center text-[5.5px] leading-tight">
          MRN #{label.mrn} · {label.doctorName}
        </p>
        <p className="w-full truncate text-center text-[5.5px] leading-tight">
          {label.date} · By {label.collectedByName}
        </p>
        {label.visitId && (
          <p className="w-full truncate text-center text-[5.5px] leading-tight">Visit {label.visitId}</p>
        )}
      </div>

      <button
        onClick={print}
        className="no-print mt-3 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        <Printer size={15} /> Print Label
      </button>

      <style jsx global>{`
        @media print {
          @page {
            size: 3cm 2cm;
            margin: 0;
          }
          body * {
            visibility: hidden;
          }
          .print-label,
          .print-label * {
            visibility: visible;
          }
          .print-label {
            position: fixed;
            top: 0;
            left: 0;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
