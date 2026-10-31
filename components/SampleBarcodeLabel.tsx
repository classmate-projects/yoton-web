"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import JsBarcode from "jsbarcode";
import { Printer } from "lucide-react";
import type { LabSpecimenType } from "@/types/labSpecimen.type";
import { byDrawOrder } from "@/components/lab/SpecimenChips";

export interface SampleBarcodeLabelData {
  labRequestId: string;
  testName: string;
  patientName: string;
  doctorName: string;
  // Collection date and time, as printed.
  collectedAt: string;
  mrn: string;
  collectedByName: string;
  visitId?: string | null;
}

// One lab request's labels: one per tube/container its sample goes in.
export interface SampleLabelSet {
  label: SampleBarcodeLabelData;
  specimens: LabSpecimenType[];
}

interface SampleBarcodeLabelsProps {
  sets: SampleLabelSet[];
  // Audit trail hook - the print itself is still 100% client-side, this just lets the caller
  // record that a print happened (see LabController.RecordPrint).
  onPrint?: () => void;
  printCount?: number;
  lastPrintedByName?: string | null;
  lastPrintedAt?: string | null;
}

// Inline styles, not Tailwind classes: the labels are copied into a bare print frame.
const labelStyle: CSSProperties = {
  width: "3cm",
  height: "2cm",
  boxSizing: "border-box",
  padding: "0.6mm 0.8mm",
  background: "#fff",
  color: "#000",
  fontFamily: "Arial, Helvetica, sans-serif",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.15mm",
  overflow: "hidden",
  border: "1px solid #d4d4d4",
};
const lineStyle: CSSProperties = {
  width: "100%",
  margin: 0,
  fontSize: "5.5px",
  lineHeight: 1.15,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  textAlign: "center",
};

// 2cm x 3cm sample-collection labels, one per tube. The barcode encodes the lab request id so
// any tube scans back to its record; the text carries what HMC requires on every tube - the
// patient's full name, MRN, collection date and time, and the collector - plus which tube it
// belongs on.
export default function SampleBarcodeLabels({ sets, onPrint, printCount, lastPrintedByName, lastPrintedAt }: SampleBarcodeLabelsProps) {
  const previewRef = useRef<HTMLDivElement>(null);

  const labels = sets.flatMap(({ label, specimens }) => {
    const tubes = [...specimens].sort(byDrawOrder).flatMap((s) => Array.from({ length: Math.max(1, s.quantity) }, () => s));
    return tubes.length === 0
      ? [{ label, tube: null as LabSpecimenType | null, index: 0, total: 0 }]
      : tubes.map((tube, i) => ({ label, tube, index: i + 1, total: tubes.length }));
  });

  useEffect(() => {
    previewRef.current?.querySelectorAll<SVGSVGElement>("svg[data-barcode]").forEach((svg) => {
      try {
        JsBarcode(svg, svg.dataset.barcode!, { format: "CODE128", width: 1, height: 18, margin: 0, displayValue: false });
      } catch {
        // A value JsBarcode can't encode just leaves the text lines.
      }
    });
  });

  const print = () => {
    const root = previewRef.current;
    if (!root) return;
    onPrint?.();
    const body = Array.from(root.querySelectorAll(".sample-label")).map((n) => n.outerHTML).join("");
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
    frame.srcdoc = `<!doctype html><html><head><title>Sample labels</title><style>
      @page { size: 3cm 2cm; margin: 0; }
      html, body { margin: 0; padding: 0; }
      .sample-label { border: none !important; break-after: page; page-break-after: always; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .sample-label:last-child { break-after: auto; page-break-after: auto; }
    </style></head><body>${body}</body></html>`;
    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) return frame.remove();
      const cleanup = () => frame.remove();
      win.addEventListener("afterprint", cleanup);
      setTimeout(cleanup, 60_000);
      win.focus();
      win.print();
    };
    document.body.appendChild(frame);
  };

  return (
    <div>
      <div ref={previewRef} className="flex flex-wrap gap-2">
        {labels.map(({ label, tube, index, total }, i) => (
          <div key={`${label.labRequestId}-${i}`} className="sample-label" style={labelStyle}>
            <p style={{ ...lineStyle, fontSize: "6px", fontWeight: 700 }}>{label.testName}</p>
            <svg data-barcode={label.labRequestId} style={{ width: "100%", height: "4.4mm" }} />
            <p style={{ ...lineStyle, fontWeight: 700 }}>{label.patientName}</p>
            <p style={lineStyle}>
              MRN {label.mrn} · {label.doctorName}
            </p>
            <p style={lineStyle}>
              {label.collectedAt} · By {label.collectedByName}
            </p>
            {(tube || label.visitId) && (
              <p style={lineStyle}>
                {tube && (
                  <>
                    <span
                      style={{
                        display: "inline-block",
                        width: "1.5mm",
                        height: "1.5mm",
                        marginRight: "0.5mm",
                        verticalAlign: "-0.2mm",
                        border: "0.15mm solid #000",
                        background: tube.colorHex || "#fff",
                      }}
                    />
                    {/* Cap colour + code ("Lavender EDTA") - a full container name doesn't fit 3 cm. */}
                    {tube.containerCode ? [tube.capColor, tube.containerCode].filter(Boolean).join(" ") : tube.containerName}
                    {total > 1 ? ` · ${index}/${total}` : ""}
                  </>
                )}
                {tube && label.visitId ? " · " : ""}
                {label.visitId && `Visit ${label.visitId}`}
              </p>
            )}
          </div>
        ))}
      </div>

      {!!printCount && (
        <p className="mt-2 text-xs text-muted-foreground">
          Last printed by {lastPrintedByName || "—"}
          {lastPrintedAt ? ` on ${new Date(lastPrintedAt).toLocaleString()}` : ""} ({printCount}x)
        </p>
      )}

      <button
        onClick={print}
        className="mt-3 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        <Printer size={15} /> {printCount ? "Reprint" : "Print"} {labels.length} label{labels.length === 1 ? "" : "s"}
      </button>
    </div>
  );
}
