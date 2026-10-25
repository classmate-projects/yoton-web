"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Printer } from "lucide-react";
import { Modal, primaryButton, secondaryButton } from "./inventoryUi";

export interface InventoryLabel {
  // What the barcode encodes - an item code or a batch's id; both scan back into the app.
  code: string;
  title: string;
  lines: string[];
}

function Label({ label }: { label: InventoryLabel }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, label.code, { format: "CODE128", width: 1.2, height: 34, fontSize: 9, margin: 0, displayValue: true });
    } catch {
      // A code JsBarcode can't encode just shows as text below.
    }
  }, [label.code]);
  return (
    <div className="inv-label flex flex-col items-center justify-center gap-0.5 overflow-hidden border border-gray-300 bg-white p-1.5 text-black" style={{ width: "5cm", height: "3cm" }}>
      <p className="w-full truncate text-center text-[8px] font-bold leading-tight">{label.title}</p>
      <svg ref={ref} className="max-w-full" />
      {label.lines.map((l) => (
        <p key={l} className="w-full truncate text-center text-[7px] leading-tight">
          {l}
        </p>
      ))}
    </div>
  );
}

// Preview and print barcode labels (5 x 3 cm) - several copies of each when asked.
export default function BarcodeLabels({ labels, onClose }: { labels: InventoryLabel[]; onClose: () => void }) {
  const [copies, setCopies] = useState(1);
  const all = labels.flatMap((l) => Array.from({ length: copies }, () => l));
  return (
    <Modal
      title="Print labels"
      subtitle={`${labels.length} label${labels.length === 1 ? "" : "s"} - scan any of them to find the item or batch`}
      onClose={onClose}
      width="max-w-3xl"
      footer={
        <>
          <label className="mr-auto flex items-center gap-2 text-sm text-muted-foreground">
            Copies of each
            <input type="number" min={1} max={50} value={copies} onChange={(e) => setCopies(Math.min(50, Math.max(1, Number(e.target.value) || 1)))} className="h-9! w-20 text-sm!" />
          </label>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Close
          </button>
          <button type="button" onClick={() => window.print()} className={primaryButton}>
            <Printer size={15} /> Print
          </button>
        </>
      }
    >
      <div className="flex flex-wrap gap-2">
        {labels.map((l, i) => (
          <Label key={`${l.code}-${i}`} label={l} />
        ))}
      </div>
      <div className="inv-labels-print">
        {all.map((l, i) => (
          <Label key={`p-${l.code}-${i}`} label={l} />
        ))}
      </div>
      <style jsx global>{`
        .inv-labels-print {
          display: none;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          .inv-labels-print,
          .inv-labels-print * {
            visibility: visible;
          }
          .inv-labels-print {
            display: flex;
            flex-wrap: wrap;
            gap: 2mm;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
          }
          .inv-label {
            break-inside: avoid;
          }
        }
      `}</style>
    </Modal>
  );
}
