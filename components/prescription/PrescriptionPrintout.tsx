"use client";

import { Printer, X } from "lucide-react";
import { getUserDetail } from "@/lib/userDetail";
import { backendAssetUrl } from "@/lib/backendAsset";
import { formatCurrency } from "@/lib/currency";

export interface PrescriptionMedicineLine {
  drugName: string;
  drugType?: string | null;
  dosage?: string | null;
  dosageUnit?: string | null;
  frequency?: string | null;
  route?: string | null;
  orderType?: string | null;
  durationDays?: number | null;
  instructions?: string | null;
  totalQuantity?: number | null;
  unitPrice?: number | null; // only rendered when showPricing is true
}

export interface PrescriptionPrintoutProps {
  patientName: string;
  patientNumber: string;
  patientAge?: string | number | null;
  patientSex?: string | null;
  doctorName: string;
  visitDate: string;
  medicines: PrescriptionMedicineLine[];
  // Blank ("—") until pharmacy has actually completed that step — a doctor printing
  // straight from the workbench will always show these blank, which is correct.
  preparedByName?: string | null;
  dispensedByName?: string | null;
  // Pharmacy passes true; the doctor workbench never does — no price on a doctor's
  // printed prescription.
  showPricing?: boolean;
  // Server-relative path to the doctor's signature image. When supplied it is rendered
  // at the bottom of the printout next to the "Prescribed by" label.
  doctorSignatureUrl?: string | null;
  onClose: () => void;
}

const dosageLine = (m: PrescriptionMedicineLine) =>
  [m.dosage && m.dosageUnit ? `${m.dosage} ${m.dosageUnit}` : m.dosage, m.frequency, m.route]
    .filter(Boolean)
    .join(" · ");

// Full-page printable prescription, shared between the Doctor Workbench and Pharmacy so the
// layout and the "no license number" rule (deliberate, per instruction) only exist once.
// Company name/logo come straight from the logged-in user's stored session detail (the same
// values the sidebar already reads) — set once by admin, carried into every printout.
export default function PrescriptionPrintout({
  patientName,
  patientNumber,
  patientAge,
  patientSex,
  doctorName,
  visitDate,
  medicines,
  preparedByName,
  dispensedByName,
  showPricing = false,
  doctorSignatureUrl,
  onClose,
}: PrescriptionPrintoutProps) {
  const currentUser = getUserDetail();
  const companyName = currentUser?.companyName || "Yoton Health";
  const companyLogo = backendAssetUrl(currentUser?.companyLogoUrl);
  const signatureUrl = backendAssetUrl(doctorSignatureUrl);

  const print = () => window.print();

  const total = showPricing
    ? medicines.reduce((sum, m) => sum + (m.unitPrice ?? 0) * (m.totalQuantity ?? 1), 0)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 no-print-backdrop">
      <div className="no-print flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-semibold text-foreground">Prescription Preview</h2>
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
          <PrintablePrescriptionBody
            companyName={companyName}
            companyLogo={companyLogo}
            patientName={patientName}
            patientNumber={patientNumber}
            patientAge={patientAge}
            patientSex={patientSex}
            doctorName={doctorName}
            visitDate={visitDate}
            medicines={medicines}
            preparedByName={preparedByName}
            dispensedByName={dispensedByName}
            showPricing={showPricing}
            total={total}
            doctorSignatureUrl={signatureUrl}
          />
        </div>
      </div>

      {/* Print-only render: the modal chrome above is hidden on print via .no-print, this
          is what actually reaches paper. */}
      <div className="print-only">
        <PrintablePrescriptionBody
          companyName={companyName}
          companyLogo={companyLogo}
          patientName={patientName}
          patientNumber={patientNumber}
          patientAge={patientAge}
          patientSex={patientSex}
          doctorName={doctorName}
          visitDate={visitDate}
          medicines={medicines}
          preparedByName={preparedByName}
          dispensedByName={dispensedByName}
          showPricing={showPricing}
          total={total}
          doctorSignatureUrl={signatureUrl}
        />
      </div>

      <style jsx global>{`
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

interface BodyProps {
  companyName: string;
  companyLogo: string | null;
  patientName: string;
  patientNumber: string;
  patientAge?: string | number | null;
  patientSex?: string | null;
  doctorName: string;
  visitDate: string;
  medicines: PrescriptionMedicineLine[];
  preparedByName?: string | null;
  dispensedByName?: string | null;
  showPricing: boolean;
  total: number;
  doctorSignatureUrl?: string | null;
}

function PrintablePrescriptionBody({
  companyName,
  companyLogo,
  patientName,
  patientNumber,
  patientAge,
  patientSex,
  doctorName,
  visitDate,
  medicines,
  preparedByName,
  dispensedByName,
  showPricing,
  total,
  doctorSignatureUrl,
}: BodyProps) {
  return (
    <div className="bg-white p-6 text-black" style={{ width: "100%" }}>
      <div className="flex items-center gap-3 border-b-2 border-black pb-3">
        {companyLogo && (
          // eslint-disable-next-line @next/next/no-img-element -- backend-hosted, runtime-only path
          <img src={companyLogo} alt={companyName} className="h-12 w-12 object-contain" />
        )}
        <div>
          <p className="text-xl font-bold">{companyName}</p>
          <p className="text-xs text-gray-600">Prescription</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <p>
          <span className="font-semibold">Patient:</span> {patientName}
        </p>
        <p>
          <span className="font-semibold">Date:</span> {visitDate}
        </p>
        <p>
          <span className="font-semibold">Patient No:</span> {patientNumber}
        </p>
        <p>
          <span className="font-semibold">Age / Sex:</span> {patientAge ?? "—"} / {patientSex ?? "—"}
        </p>
        <p className="col-span-2">
          <span className="font-semibold">Consulting Doctor:</span> {doctorName}
        </p>
      </div>

      <table className="mt-5 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-1.5 pr-2">Medicine</th>
            <th className="py-1.5 pr-2">Dosage · Frequency · Route</th>
            <th className="py-1.5 pr-2">Duration</th>
            <th className="py-1.5 pr-2">Instructions</th>
            {showPricing && <th className="py-1.5 text-right">Amount</th>}
          </tr>
        </thead>
        <tbody>
          {medicines.map((m, i) => (
            <tr key={i} className="border-b border-gray-300 align-top">
              <td className="py-1.5 pr-2 font-semibold">
                {m.drugName}
                {m.drugType && <span className="font-normal text-gray-600"> ({m.drugType})</span>}
              </td>
              <td className="py-1.5 pr-2">{dosageLine(m) || "—"}</td>
              <td className="py-1.5 pr-2">{m.durationDays ? `${m.durationDays} day(s)` : "—"}</td>
              <td className="py-1.5 pr-2">{m.instructions || "—"}</td>
              {showPricing && (
                <td className="py-1.5 text-right">
                  {m.unitPrice != null ? formatCurrency((m.unitPrice ?? 0) * (m.totalQuantity ?? 1)) : "—"}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {showPricing && (
          <tfoot>
            <tr>
              <td colSpan={4} className="pt-2 text-right font-semibold">
                Total
              </td>
              <td className="pt-2 text-right font-semibold">{formatCurrency(total)}</td>
            </tr>
          </tfoot>
        )}
      </table>

      <div className="mt-10 grid grid-cols-3 gap-4 text-xs">
        <div className="border-t border-black pt-1">
          <p className="font-semibold">Prescribed by</p>
          {doctorSignatureUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={doctorSignatureUrl} alt="Doctor signature" className="h-10 max-w-[120px] object-contain my-1" />
          )}
          <p>{doctorName}</p>
        </div>
        <div className="border-t border-black pt-1">
          <p className="font-semibold">Prepared by</p>
          <p>{preparedByName || "—"}</p>
        </div>
        <div className="border-t border-black pt-1">
          <p className="font-semibold">Dispensed by</p>
          <p>{dispensedByName || "—"}</p>
        </div>
      </div>
    </div>
  );
}
