"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { getUserDetail } from "@/lib/userDetail";
import { backendAssetUrl } from "@/lib/backendAsset";
import { ImmunizationService } from "@/services/immunization.service";
import type { ImmunizationScheduleType } from "@/types/immunization.type";
import { formatDay, formatGiven } from "./immunizationUi";

interface ImmunizationHistoryPrintoutProps {
  schedule: ImmunizationScheduleType;
  onClose: () => void;
}

// Printable immunization record - every dose given (with batch, expiry, route, site, who gave
// and who ordered it), what's scheduled or outstanding, and the routine doses not scheduled
// yet. The sheet is portaled straight under <body> and everything else is hidden on print,
// so a long record flows over as many pages as it needs (a position:fixed sheet, as the bill
// and prescription use, would be cut at one page). Each print is recorded in the Audit Log.
export default function ImmunizationHistoryPrintout({ schedule, onClose }: ImmunizationHistoryPrintoutProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const print = async () => {
    // Recording the print must never stop the user printing.
    await ImmunizationService.recordPrint(schedule.patient.patientId).catch(() => {});
    window.print();
  };

  return (
    <>
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
        <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-xl bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="text-lg font-semibold text-foreground">Immunization record preview</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void print()}
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
            <PrintableRecord schedule={schedule} />
          </div>
        </div>
      </div>

      {mounted &&
        createPortal(
          <div className="immunization-print-root">
            <PrintableRecord schedule={schedule} />
          </div>,
          document.body
        )}

      <style jsx global>{`
        .immunization-print-root {
          display: none;
        }
        @media print {
          body > *:not(.immunization-print-root) {
            display: none !important;
          }
          .immunization-print-root {
            display: block !important;
          }
          .immunization-print-root table {
            page-break-inside: auto;
          }
          .immunization-print-root tr {
            page-break-inside: avoid;
          }
          @page {
            margin: 12mm;
          }
        }
      `}</style>
    </>
  );
}

function PrintableRecord({ schedule }: { schedule: ImmunizationScheduleType }) {
  const currentUser = getUserDetail();
  const companyName = currentUser?.companyName || "Yoton Health";
  const companyLogo = backendAssetUrl(currentUser?.companyLogoUrl);
  const { patient } = schedule;

  const given = schedule.orders
    .filter((o) => o.status === "Administered")
    .sort((a, b) => (a.administeredAt ?? a.scheduledDate).localeCompare(b.administeredAt ?? b.scheduledDate));
  const outstanding = schedule.orders
    .filter((o) => o.status === "Scheduled" || o.status === "Missed")
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  const notScheduled = schedule.recommended.filter((r) => !r.immunizationOrderId);

  const cell = "border border-gray-400 px-1.5 py-1 align-top";
  const head = `${cell} bg-gray-100 text-left font-semibold`;

  return (
    <div className="bg-white p-6 text-[12px] leading-snug text-black">
      <div className="flex items-center gap-3 border-b-2 border-black pb-3">
        {companyLogo && (
          // eslint-disable-next-line @next/next/no-img-element -- backend-hosted, runtime-only path
          <img src={companyLogo} alt={companyName} className="h-12 w-12 object-contain" />
        )}
        <div>
          <p className="text-xl font-bold">{companyName}</p>
          <p className="text-xs text-gray-600">Immunization Record</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-x-6 gap-y-1">
        <p><span className="font-semibold">Patient:</span> {patient.name}</p>
        <p><span className="font-semibold">MRN:</span> {patient.opNumber || "—"}</p>
        <p><span className="font-semibold">Sex:</span> {patient.sex || "—"}</p>
        <p><span className="font-semibold">Date of birth:</span> {formatDay(patient.dateOfBirth)}</p>
        <p><span className="font-semibold">Age:</span> {patient.ageText || "—"}</p>
        <p><span className="font-semibold">Category:</span> {patient.ageCategory || "—"}</p>
      </div>

      <h3 className="mt-5 mb-1.5 text-sm font-bold">Vaccines given ({given.length})</h3>
      {given.length === 0 ? (
        <p className="text-gray-600">No vaccines recorded yet.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={head}>Date given</th>
              <th className={head}>Vaccine</th>
              <th className={head}>Dose</th>
              <th className={head}>Batch / lot</th>
              <th className={head}>Expiry</th>
              <th className={head}>Route · site</th>
              <th className={head}>Given by</th>
              <th className={head}>Ordered by</th>
              <th className={head}>Adverse reactions</th>
            </tr>
          </thead>
          <tbody>
            {given.map((o) => (
              <tr key={o.immunizationOrderId}>
                <td className={cell}>{formatGiven(o)}</td>
                <td className={cell}>
                  <span className="font-semibold">{o.vaccineName}</span>
                  {o.vaccineDescription && <span className="block text-[10px] text-gray-600">{o.vaccineDescription}</span>}
                </td>
                <td className={cell}>{o.doseLabel}</td>
                <td className={cell}>{o.batchNumber || "—"}</td>
                <td className={cell}>{o.expiryDate ? formatDay(o.expiryDate) : "—"}</td>
                <td className={cell}>{o.isExternal ? "—" : [o.route, o.injectionSite].filter(Boolean).join(" · ") || "—"}</td>
                <td className={cell}>
                  {o.isExternal ? `Outside${o.externalFacility ? `: ${o.externalFacility}` : ""} (recorded by ${o.administeredByName || "—"})` : o.administeredByName || "—"}
                </td>
                <td className={cell}>{o.isExternal ? "—" : o.orderedByName || "—"}</td>
                <td className={cell}>{o.isExternal ? "—" : o.adverseReactions || "None recorded"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="mt-5 mb-1.5 text-sm font-bold">Scheduled and outstanding ({outstanding.length})</h3>
      {outstanding.length === 0 ? (
        <p className="text-gray-600">Nothing scheduled.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={head}>Date</th>
              <th className={head}>Vaccine</th>
              <th className={head}>Dose</th>
              <th className={head}>Status</th>
              <th className={head}>Ordered by</th>
              <th className={head}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {outstanding.map((o) => (
              <tr key={o.immunizationOrderId}>
                <td className={cell}>{formatDay(o.scheduledDate)}</td>
                <td className={cell}>{o.vaccineName}</td>
                <td className={cell}>{o.doseLabel}</td>
                <td className={cell}>
                  {o.displayStatus}
                  {o.status === "Missed" && o.statusReason ? ` - ${o.statusReason}` : ""}
                </td>
                <td className={cell}>{o.orderedByName || "—"}</td>
                <td className={cell}>{o.remarks || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {notScheduled.length > 0 && (
        <>
          <h3 className="mt-5 mb-1.5 text-sm font-bold">Recommended, not yet scheduled ({notScheduled.length})</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={head}>Recommended</th>
                <th className={head}>Age</th>
                <th className={head}>Vaccine</th>
                <th className={head}>Dose</th>
                <th className={head}>Status</th>
              </tr>
            </thead>
            <tbody>
              {notScheduled.map((r) => (
                <tr key={`${r.vaccineId}-${r.doseNumber}`}>
                  <td className={cell}>
                    {formatDay(r.recommendedDate)}
                    {r.dueUntilDate ? ` - ${formatDay(r.dueUntilDate)}` : ""}
                  </td>
                  <td className={cell}>{r.ageLabel}</td>
                  <td className={cell}>{r.vaccineName}</td>
                  <td className={cell}>{r.doseLabel}</td>
                  <td className={cell}>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="mt-10 grid grid-cols-2 gap-8 text-xs">
        <div className="border-t border-black pt-1">
          <p className="font-semibold">Verified by</p>
          <p>{currentUser?.name || "—"}</p>
        </div>
        <div className="border-t border-black pt-1 text-right">
          <p className="font-semibold">Printed</p>
          <p>{new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
