"use client";

import { BillType } from "@/types/billing.type";
import { getUserDetail } from "@/lib/userDetail";
import { backendAssetUrl } from "@/lib/backendAsset";
import { formatCurrency } from "@/lib/currency";

const formatDateTime = (value: string | null) => (value ? new Date(value).toLocaleString() : "—");

// Print-only bill sheet - invisible on screen, and the only thing on the page when the
// browser prints (call window.print()). Same approach as PrescriptionPrintout, with its own
// class names so the two never interfere. Render it OUTSIDE any backdrop-blur modal:
// backdrop-filter makes `position: fixed/absolute` children position against the modal
// instead of the page, which would push the sheet off the printed page.
export default function BillPrintout({ bill }: { bill: BillType }) {
  const currentUser = getUserDetail();
  const companyName = currentUser?.companyName || "Yoton Health";
  const companyLogo = backendAssetUrl(currentUser?.companyLogoUrl);

  return (
    <>
      <div className="bill-print-only bg-white p-8 text-black">
        <div className="flex items-center justify-between border-b-2 border-black pb-3">
          <div className="flex items-center gap-3">
            {companyLogo && (
              // eslint-disable-next-line @next/next/no-img-element -- backend-hosted, runtime-only path
              <img src={companyLogo} alt={companyName} className="h-12 w-12 object-contain" />
            )}
            <div>
              <p className="text-xl font-bold">{companyName}</p>
              <p className="text-xs text-gray-600">Bill / Invoice</p>
            </div>
          </div>
          <p className="rounded border border-black px-3 py-1 text-sm font-bold uppercase">{bill.status}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <p>
            <span className="font-semibold">Patient:</span> {bill.patientName}
          </p>
          <p>
            <span className="font-semibold">Bill No:</span> {bill.billId}
          </p>
          <p>
            <span className="font-semibold">Bill Date:</span> {formatDateTime(bill.createdAt)}
          </p>
          {bill.status === "Paid" && (
            <p>
              <span className="font-semibold">Paid On:</span> {formatDateTime(bill.paymentDate)}
            </p>
          )}
          {bill.paymentMethod && (
            <p>
              <span className="font-semibold">Payment Method:</span> {bill.paymentMethod}
            </p>
          )}
        </div>

        <table className="mt-5 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-2 pr-2 w-10">#</th>
              <th className="py-2 pr-2">Description</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-3 text-gray-600">No items.</td>
              </tr>
            ) : (
              bill.items.map((item, i) => (
                <tr key={item.billItemId} className="border-b border-gray-300">
                  <td className="py-2 pr-2">{i + 1}</td>
                  <td className="py-2 pr-2">{item.description ?? "—"}</td>
                  <td className="py-2 text-right">{formatCurrency(item.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="ml-auto mt-4 w-64 space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(bill.totalAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span>Discount</span>
            <span>-{formatCurrency(bill.discount)}</span>
          </div>
          <div className="flex justify-between">
            <span>Tax</span>
            <span>+{formatCurrency(bill.tax)}</span>
          </div>
          <div className="flex justify-between border-t-2 border-black pt-1 text-base font-bold">
            <span>Net Amount</span>
            <span>{formatCurrency(bill.netAmount)}</span>
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-gray-600">
          Printed {new Date().toLocaleString()} · Thank you
        </p>
      </div>

      <style jsx global>{`
        .bill-print-only {
          display: none;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          .bill-print-only,
          .bill-print-only * {
            visibility: visible;
          }
          .bill-print-only {
            display: block;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
