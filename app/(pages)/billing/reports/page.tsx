"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, FileBarChart, FileSpreadsheet, Loader2, Printer, RefreshCw } from "lucide-react";
import DatePicker from "@/components/DatePicker";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { BillingService } from "@/services/billing.service";
import { BillingReportType } from "@/types/billingReport.type";
import { formatCurrency } from "@/lib/currency";
import { parseDateInputValue, toDateInputValue } from "@/lib/date";
import { getUserDetail } from "@/lib/userDetail";
import { useRegion } from "@/lib/region";

// ---------------- report model ----------------
// Every tab is described once as tiles + tables, and that one description drives the
// screen, the printout (Print / Save as PDF) and the Excel export - so all three always
// show the same numbers.

type CellKind = "text" | "money" | "number" | "percent" | "date" | "datetime";

interface Column<T> {
  header: string;
  kind?: CellKind;
  get: (row: T) => string | number | null | undefined;
  // Leave this column blank in the Total row (e.g. ages, which don't add up).
  noTotal?: boolean;
}

interface Table<T = unknown> {
  title: string;
  note?: string;
  columns: Column<T>[];
  rows: T[];
  // Adds a "Total" row summing every money/number column.
  totals?: boolean;
  emptyText?: string;
}

interface Tile {
  label: string;
  value: string;
  hint?: string;
}

interface ReportTab {
  key: string;
  label: string;
  description: string;
  tiles: Tile[];
  tables: Table[];
}

const table = <T,>(t: Table<T>) => t as unknown as Table;

const formatDate = (value: string) => {
  const d = parseDateInputValue(value.slice(0, 10));
  return d ? d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : value;
};
const formatDateTime = (value: string) => new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
const share = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);
const trimNumber = (n: number) => Number(n.toFixed(2)).toString();

function formatCell(value: string | number | null | undefined, kind: CellKind = "text") {
  if (value === null || value === undefined || value === "") return "—";
  switch (kind) {
    case "money":
      return formatCurrency(Number(value));
    case "number":
      return trimNumber(Number(value));
    case "percent":
      return `${trimNumber(Number(value))}%`;
    case "date":
      return formatDate(String(value));
    case "datetime":
      return formatDateTime(String(value));
    default:
      return String(value);
  }
}

const isNumeric = (kind?: CellKind) => kind === "money" || kind === "number" || kind === "percent";
const isSummable = (col: Column<unknown>) => !col.noTotal && (col.kind === "money" || col.kind === "number");

function totalOf(t: Table, col: Column<unknown>) {
  return t.rows.reduce<number>((sum, row) => sum + (Number(col.get(row)) || 0), 0);
}

function buildTabs(r: BillingReportType): ReportTab[] {
  const c = r.collection;
  const methods = c.byMethod.map((m) => m.method);
  const methodColumns = <T extends { methods: Record<string, number> }>(): Column<T>[] =>
    methods.map((m) => ({ header: m, kind: "money" as const, get: (row: T) => row.methods[m] ?? 0 }));

  const o = r.outstanding;
  const x = r.cancellations;
  const d = r.discounts;
  const rev = r.revenue;
  const g = r.tax;
  const splitNames = g.components;

  return [
    {
      key: "collection",
      label: "Daily Collection",
      description: "Payments received in the period, by payment method, cashier and day.",
      tiles: [
        { label: "Total collected", value: formatCurrency(c.totalAmount) },
        { label: "Bills paid", value: String(c.totalBills) },
        ...c.byMethod.slice(0, 2).map((m) => ({
          label: m.method,
          value: formatCurrency(m.amount),
          hint: `${m.count} bill${m.count === 1 ? "" : "s"} · ${trimNumber(share(m.amount, c.totalAmount))}%`,
        })),
      ],
      tables: [
        table({
          title: "By payment method",
          columns: [
            { header: "Method", get: (m) => m.method },
            { header: "Bills", kind: "number", get: (m) => m.count },
            { header: "Share", kind: "percent", get: (m) => share(m.amount, c.totalAmount) },
            { header: "Amount", kind: "money", get: (m) => m.amount },
          ],
          rows: c.byMethod,
          totals: true,
        }),
        table({
          title: "By cashier",
          note: "Cashier is whoever marked the bill as paid. Bills paid before this was tracked show as \"Not recorded\".",
          columns: [
            { header: "Cashier", get: (row) => row.cashier },
            { header: "Bills", kind: "number", get: (row) => row.count },
            ...methodColumns<(typeof c.byCashier)[number]>(),
            { header: "Total", kind: "money", get: (row) => row.amount },
          ],
          rows: c.byCashier,
          totals: true,
        }),
        table({
          title: "By day",
          columns: [
            { header: "Date", kind: "date", get: (row) => row.date },
            { header: "Bills", kind: "number", get: (row) => row.count },
            ...methodColumns<(typeof c.byDay)[number]>(),
            { header: "Total", kind: "money", get: (row) => row.amount },
          ],
          rows: c.byDay,
          totals: true,
        }),
        table({
          title: "Payments",
          columns: [
            { header: "Paid at", kind: "datetime", get: (p) => p.paidAt },
            { header: "Bill #", get: (p) => p.billId },
            { header: "Patient", get: (p) => p.patientName },
            { header: "Method", get: (p) => p.method },
            { header: "Cashier", get: (p) => p.cashier },
            { header: "Amount", kind: "money", get: (p) => p.amount },
          ],
          rows: c.payments,
          totals: true,
        }),
      ],
    },
    {
      key: "outstanding",
      label: "Outstanding Dues",
      description: "Pending (unpaid) bills as of now, by how long they've been open. Not limited to the selected dates.",
      tiles: [
        { label: "Total outstanding", value: formatCurrency(o.totalAmount) },
        { label: "Unpaid bills", value: String(o.totalBills) },
        {
          label: "Over 30 days",
          value: formatCurrency(o.ageing.slice(2).reduce((s, a) => s + a.amount, 0)),
          hint: `${o.ageing.slice(2).reduce((s, a) => s + a.count, 0)} bills`,
        },
      ],
      tables: [
        table({
          title: "Ageing",
          columns: [
            { header: "Age", get: (a) => a.bucket },
            { header: "Bills", kind: "number", get: (a) => a.count },
            { header: "Share", kind: "percent", get: (a) => share(a.amount, o.totalAmount) },
            { header: "Amount", kind: "money", get: (a) => a.amount },
          ],
          rows: o.ageing,
          totals: true,
        }),
        table({
          title: "Unpaid bills",
          columns: [
            { header: "Bill #", get: (b) => b.billId },
            { header: "Patient", get: (b) => b.patientName },
            { header: "Created", kind: "datetime", get: (b) => b.createdAt },
            { header: "Age (days)", kind: "number", noTotal: true, get: (b) => b.ageDays },
            { header: "Items", kind: "number", get: (b) => b.itemCount },
            { header: "Amount", kind: "money", get: (b) => b.amount },
          ],
          rows: o.bills,
          totals: true,
          emptyText: "No unpaid bills - everything is collected.",
        }),
      ],
    },
    {
      key: "cancellations",
      label: "Cancellations",
      description: "Bills cancelled and bill lines removed in the period, with who did it and why.",
      tiles: [
        { label: "Bills cancelled", value: String(x.cancelledCount), hint: formatCurrency(x.cancelledAmount) },
        { label: "Lines removed", value: String(x.removedCount), hint: formatCurrency(x.removedAmount) },
        { label: "Refunds", value: "—", hint: "Refunds aren't recorded yet" },
      ],
      tables: [
        table({
          title: "Cancelled bills",
          columns: [
            { header: "Cancelled at", kind: "datetime", get: (b) => b.cancelledAt },
            { header: "Bill #", get: (b) => b.billId },
            { header: "Patient", get: (b) => b.patientName },
            { header: "Cancelled by", get: (b) => b.cancelledBy },
            { header: "Reason", get: (b) => b.reason },
            { header: "Amount", kind: "money", get: (b) => b.amount },
          ],
          rows: x.bills,
          totals: true,
          emptyText: "No bills were cancelled in this period.",
        }),
        table({
          title: "Removed bill lines",
          columns: [
            { header: "Removed at", kind: "datetime", get: (l) => l.removedAt },
            { header: "Bill #", get: (l) => l.billId },
            { header: "Patient", get: (l) => l.patientName },
            { header: "Item", get: (l) => l.description },
            { header: "Removed by", get: (l) => l.removedBy },
            { header: "Reason", get: (l) => l.reason },
            { header: "Amount", kind: "money", get: (l) => l.amount },
          ],
          rows: x.removedLines,
          totals: true,
          emptyText: "No bill lines were removed in this period.",
        }),
      ],
    },
    {
      key: "discounts",
      label: "Discounts",
      description: "Discounts on bills paid in the period - bill-level and per-line - and who gave them.",
      tiles: [
        { label: "Total discount", value: formatCurrency(d.totalDiscount) },
        { label: "Discounted bills", value: String(d.billCount), hint: `of ${c.totalBills} paid` },
        { label: "Average discount", value: `${trimNumber(share(d.totalDiscount, d.totalGross))}%`, hint: "of gross on discounted bills" },
      ],
      tables: [
        table({
          title: "By user",
          note: "The bill-level discount is set by whoever created the bill.",
          columns: [
            { header: "Given by", get: (u) => u.user },
            { header: "Bills", kind: "number", get: (u) => u.count },
            { header: "Discount", kind: "money", get: (u) => u.amount },
          ],
          rows: d.byUser,
          totals: true,
        }),
        table({
          title: "Discounted bills",
          columns: [
            { header: "Paid at", kind: "datetime", get: (b) => b.paidAt },
            { header: "Bill #", get: (b) => b.billId },
            { header: "Patient", get: (b) => b.patientName },
            { header: "Gross", kind: "money", get: (b) => b.grossAmount },
            { header: "Bill disc.", kind: "percent", get: (b) => b.billDiscountPercent || null },
            { header: "Line disc.", get: (b) => (b.lineDiscountCount ? `${b.lineDiscountCount} line${b.lineDiscountCount === 1 ? "" : "s"}` : null) },
            { header: "Discount", kind: "money", get: (b) => b.discount },
            { header: "Net", kind: "money", get: (b) => b.netAmount },
            { header: "Given by", get: (b) => b.givenBy },
          ],
          rows: d.bills,
          totals: true,
          emptyText: "No discounts were given in this period.",
        }),
      ],
    },
    {
      key: "revenue",
      label: "Revenue",
      description: "Revenue from bills paid in the period by department, doctor and service. Excludes tax.",
      tiles: [
        { label: "Revenue (excl. tax)", value: formatCurrency(rev.totalRevenue) },
        { label: "Top department", value: rev.byDepartment[0]?.department ?? "—", hint: rev.byDepartment[0] ? formatCurrency(rev.byDepartment[0].revenue) : undefined },
        { label: "Top doctor", value: rev.byDoctor[0]?.doctor ?? "—", hint: rev.byDoctor[0] ? formatCurrency(rev.byDoctor[0].revenue) : undefined },
      ],
      tables: [
        table({
          title: "By department",
          note: "A bill counts toward the department and doctor of the visit's consultation. Bills with no doctor (e.g. walk-in pharmacy) show as \"Unassigned\".",
          columns: [
            { header: "Department", get: (row) => row.department },
            { header: "Bills", kind: "number", get: (row) => row.bills },
            { header: "Share", kind: "percent", get: (row) => share(row.revenue, rev.totalRevenue) },
            { header: "Revenue", kind: "money", get: (row) => row.revenue },
          ],
          rows: rev.byDepartment,
          totals: true,
        }),
        table({
          title: "By doctor",
          columns: [
            { header: "Doctor", get: (row) => row.doctor },
            { header: "Department", get: (row) => row.department },
            { header: "Bills", kind: "number", get: (row) => row.bills },
            { header: "Revenue", kind: "money", get: (row) => row.revenue },
          ],
          rows: rev.byDoctor,
          totals: true,
        }),
        table({
          title: "By category",
          columns: [
            { header: "Category", get: (row) => row.category },
            { header: "Lines", kind: "number", get: (row) => row.lines },
            { header: "Share", kind: "percent", get: (row) => share(row.revenue, rev.totalRevenue) },
            { header: "Revenue", kind: "money", get: (row) => row.revenue },
          ],
          rows: rev.byCategory,
          totals: true,
        }),
        table({
          title: "By service",
          columns: [
            { header: "Service / item", get: (row) => row.service },
            { header: "Category", get: (row) => row.category },
            { header: "Qty", kind: "number", get: (row) => row.quantity },
            { header: "Revenue", kind: "money", get: (row) => row.revenue },
          ],
          rows: rev.byService,
          totals: true,
        }),
      ],
    },
    // The installation's own tax (VAT in the UAE, GST with its CGST/SGST split in India) -
    // no tab at all where bills carry no tax (Qatar).
    ...(g.applicable
      ? [
          {
            key: "tax",
            label: `${g.name} Summary`,
            description: `Taxable value and tax on bills paid in the period, by rate${g.serviceCodeLabel ? ` and by ${g.serviceCodeLabel}` : ""}, for filing.`,
            tiles: [
              { label: "Taxable value", value: formatCurrency(g.taxableValue) },
              { label: `Total ${g.name}`, value: formatCurrency(g.totalTax) },
              ...(splitNames.length > 0
                ? [{
                    label: splitNames.join(" + "),
                    value: g.split.map((s) => formatCurrency(s.amount)).join(" + "),
                    hint: "Intra-state split (equal parts)",
                  }]
                : []),
            ],
            tables: [
              table({
                title: "By tax rate",
                note: (splitNames.length > 0
                  ? `${splitNames.join("/")} assume intra-state supply (tax split equally); for inter-state supply the whole tax is IGST. `
                  : "") + "\"No rate\" is older bills that recorded tax as a flat amount.",
                columns: [
                  { header: "Rate", get: (row) => (row.rate === null ? "No rate" : `${trimNumber(row.rate)}%`) },
                  { header: "Lines", kind: "number", get: (row) => row.lines },
                  { header: "Taxable value", kind: "money", get: (row) => row.taxableValue },
                  ...splitNames.map((name, i) => ({
                    header: name,
                    kind: "money" as const,
                    get: (row: (typeof g.byRate)[number]) => row.split[i]?.amount ?? 0,
                  })),
                  { header: `Total ${g.name}`, kind: "money", get: (row) => row.tax },
                  { header: "Invoice value", kind: "money", get: (row) => row.total },
                ],
                rows: g.byRate,
                totals: true,
              }),
              ...(g.serviceCodeLabel
                ? [table({
                    title: `By ${g.serviceCodeLabel}`,
                    note: `Lines without a code are grouped under "Not set" - add the ${g.serviceCodeLabel} on bill lines to fill this in.`,
                    columns: [
                      { header: g.serviceCodeLabel, get: (row) => row.code },
                      { header: "Category", get: (row) => row.category },
                      { header: "Rate", kind: "percent", get: (row) => row.rate },
                      { header: "Qty", kind: "number", get: (row) => row.quantity },
                      { header: "Taxable value", kind: "money", get: (row) => row.taxableValue },
                      { header: g.name, kind: "money", get: (row) => row.tax },
                    ],
                    rows: g.byCode,
                    totals: true,
                  })]
                : []),
            ],
          } satisfies ReportTab,
        ]
      : []),
  ];
}

// ---------------- date range ----------------

type Preset = "today" | "yesterday" | "last7" | "thisMonth" | "lastMonth";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 days" },
  { key: "thisMonth", label: "This month" },
  { key: "lastMonth", label: "Last month" },
];

function presetRange(preset: Preset): [string, string] {
  const now = new Date();
  const day = (offset: number) => toDateInputValue(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset));
  switch (preset) {
    case "today":
      return [day(0), day(0)];
    case "yesterday":
      return [day(-1), day(-1)];
    case "last7":
      return [day(-6), day(0)];
    case "thisMonth":
      return [toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)), day(0)];
    case "lastMonth":
      return [
        toDateInputValue(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 0)),
      ];
  }
}

const rangeLabel = (from: string, to: string) => (from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`);

const errorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.message || fallback : fallback;

// ---------------- page ----------------

export default function BillingReportsPage() {
  // The tax report is named for the installation's own tax (VAT / GST), and absent where there is none.
  const region = useRegion();
  const today = toDateInputValue(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [report, setReport] = useState<BillingReportType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("collection");
  const [isExporting, setIsExporting] = useState(false);
  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await BillingService.getReports(from, to);
      setReport(res.data);
    } catch (error) {
      console.error(error);
      toast.error(errorMessage(error, "Failed to load billing reports"));
    } finally {
      setIsLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const tabs = useMemo(() => (report ? buildTabs(report) : []), [report]);
  const tab = tabs.find((t) => t.key === activeTab) ?? tabs[0];
  const activePreset = PRESETS.find((p) => {
    const [f, t] = presetRange(p.key);
    return f === from && t === to;
  })?.key;

  const companyName = getUserDetail()?.companyName || "Yoton Health";
  const periodText = report ? rangeLabel(report.from, report.to) : "";

  const applyPreset = (preset: Preset) => {
    const [f, t] = presetRange(preset);
    setFrom(f);
    setTo(t);
  };

  // Every table of every tab, one sheet each, plus a summary sheet - numbers stay numbers
  // so the accounts team can total and pivot them. xlsx is loaded on demand.
  const handleExport = async () => {
    if (!report) return;
    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.utils.book_new();
      const usedNames = new Set<string>();
      const sheetName = (name: string) => {
        let base = name.replace(/[\\/?*[\]:]/g, "").slice(0, 31);
        let n = 2;
        while (usedNames.has(base)) base = `${name.slice(0, 28)} ${n++}`;
        usedNames.add(base);
        return base;
      };

      const summaryRows: (string | number)[][] = [
        [companyName],
        ["Billing reports", periodText],
        ["Generated", formatDateTime(report.generatedAt)],
        [],
      ];
      tabs.forEach((t) => {
        summaryRows.push([t.label]);
        t.tiles.forEach((tile) => summaryRows.push([`  ${tile.label}`, tile.value, tile.hint ?? ""]));
        summaryRows.push([]);
      });
      const summary = XLSX.utils.aoa_to_sheet(summaryRows);
      summary["!cols"] = [{ wch: 28 }, { wch: 24 }, { wch: 34 }];
      XLSX.utils.book_append_sheet(book, summary, sheetName("Summary"));

      tabs.forEach((t) =>
        t.tables.forEach((tb) => {
          const header = tb.columns.map((col) => col.header);
          const exportValue = (col: Column<unknown>, row: unknown) => {
            const v = col.get(row);
            if (v === null || v === undefined) return "";
            if (isNumeric(col.kind)) return Number(Number(v).toFixed(2));
            if (col.kind === "date" || col.kind === "datetime") return formatCell(v, col.kind);
            return String(v);
          };
          const body = tb.rows.map((row) => tb.columns.map((col) => exportValue(col, row)));
          if (tb.totals && tb.rows.length > 0)
            body.push(tb.columns.map((col, i) => (i === 0 ? "Total" : isSummable(col) ? Number(totalOf(tb, col).toFixed(2)) : "")));
          const sheet = XLSX.utils.aoa_to_sheet([[`${t.label} - ${tb.title}`, periodText], [], header, ...body]);
          sheet["!cols"] = tb.columns.map((col) => ({ wch: isNumeric(col.kind) ? 14 : Math.max(14, col.header.length + 4) }));
          XLSX.utils.book_append_sheet(book, sheet, sheetName(`${t.label.split(" ")[0]} - ${tb.title}`));
        }),
      );

      XLSX.writeFile(book, `billing-reports-${report.from}_to_${report.to}.xlsx`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to export reports");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link href="/billing" className="mb-1 flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} /> Billing
          </Link>
          <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
            <FileBarChart className="text-primary" size={34} /> Billing Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Collections, dues, cancellations, discounts, revenue{region?.tax.applicable ? ` and ${region.tax.name}` : ""}.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => window.print()}
            disabled={!report || isLoading}
            className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-foreground hover:bg-muted disabled:opacity-50 cursor-pointer"
            title="Print this report, or choose “Save as PDF” in the print dialog"
          >
            <Printer size={18} /> Print / PDF
          </button>
          <button
            onClick={handleExport}
            disabled={!report || isLoading || isExporting}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
            title="Download every report for this period as an Excel workbook"
          >
            {isExporting ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />} Export Excel
          </button>
        </div>
      </div>

      {/* Period */}
      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">From</label>
          <DatePicker
            value={from}
            max={today}
            onChange={(v) => {
              if (!v) return;
              setFrom(v);
              if (v > to) setTo(v);
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">To</label>
          <DatePicker value={to} min={from} max={today} onChange={(v) => v && setTo(v)} />
        </div>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`h-9 rounded-md px-3 text-sm transition-colors cursor-pointer ${
                activePreset === p.key ? "bg-primary text-white" : "text-primary hover:bg-primary/10"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={fetchReport}
          disabled={isLoading}
          title="Refresh"
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Tabs */}
      {tabs.length > 0 && (
        <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
                tab?.key === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {isLoading && !report ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner />
        </div>
      ) : !tab ? (
        <EmptyState illustration="chart" title="No report data" description="Pick a period to load the billing reports." />
      ) : (
        <div className={`transition-opacity ${isLoading ? "opacity-50" : ""}`}>
          <p className="mb-4 text-sm text-muted-foreground">
            {tab.description} <span className="font-medium text-foreground">{tab.key === "outstanding" ? "As of now" : periodText}</span>
          </p>

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tab.tiles.map((tile) => (
              <div key={tile.label} className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">{tile.label}</p>
                <p className="mt-1 truncate text-2xl font-semibold tabular-nums text-foreground" title={tile.value}>
                  {tile.value}
                </p>
                {tile.hint && <p className="mt-0.5 text-xs text-muted-foreground">{tile.hint}</p>}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-6">
            {tab.tables.map((tb) => (
              <ScreenTable key={tb.title} table={tb} />
            ))}
          </div>
        </div>
      )}

      {/* Print / Save as PDF: the active tab, portaled to <body> so the page's scroll
          container can't clip it to one printed page. The report only exists after the
          client-side fetch, so document is always there when this renders. */}
      {report &&
        tab &&
        createPortal(
          <div className="billing-report-print">
            <div className="mb-4 flex items-end justify-between border-b-2 border-black pb-2">
              <div>
                <p className="text-xl font-bold">{companyName}</p>
                <p className="text-sm">Billing report · {tab.label}</p>
              </div>
              <div className="text-right text-xs">
                <p className="font-semibold">{tab.key === "outstanding" ? "As of now" : periodText}</p>
                <p>Generated {formatDateTime(report.generatedAt)}</p>
              </div>
            </div>
            <div className="mb-4 flex flex-wrap gap-x-8 gap-y-1 text-sm">
              {tab.tiles.map((tile) => (
                <p key={tile.label}>
                  <span className="text-gray-600">{tile.label}:</span> <span className="font-semibold">{tile.value}</span>
                </p>
              ))}
            </div>
            {tab.tables.map((tb) => (
              <PrintTable key={tb.title} table={tb} />
            ))}
          </div>,
          document.body,
        )}

      <style jsx global>{`
        .billing-report-print {
          display: none;
        }
        @media print {
          body > *:not(.billing-report-print) {
            display: none !important;
          }
          .billing-report-print {
            display: block;
            padding: 16px;
            color: #000;
            background: #fff;
          }
          .billing-report-print table {
            page-break-inside: auto;
          }
          .billing-report-print tr {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}

// ---------------- tables ----------------

function ScreenTable({ table: tb }: { table: Table }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-semibold text-foreground">{tb.title}</h2>
        {tb.note && <p className="mt-0.5 text-xs text-muted-foreground">{tb.note}</p>}
      </div>
      {tb.rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{tb.emptyText ?? "Nothing in this period."}</p>
      ) : (
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/60 backdrop-blur">
              <tr>
                {tb.columns.map((col) => (
                  <th
                    key={col.header}
                    className={`whitespace-nowrap px-4 py-2 font-semibold text-muted-foreground ${isNumeric(col.kind) ? "text-right" : "text-left"}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tb.rows.map((row, i) => (
                <tr key={i} className="border-t border-border hover:bg-muted/30">
                  {tb.columns.map((col) => (
                    <td
                      key={col.header}
                      className={`px-4 py-2 text-foreground ${isNumeric(col.kind) ? "text-right tabular-nums whitespace-nowrap" : ""} ${
                        col.kind === "datetime" || col.kind === "date" ? "whitespace-nowrap" : ""
                      }`}
                    >
                      {formatCell(col.get(row), col.kind)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {tb.totals && (
              <tfoot className="sticky bottom-0 bg-card">
                <tr className="border-t-2 border-border font-semibold">
                  {tb.columns.map((col, i) => (
                    <td
                      key={col.header}
                      className={`px-4 py-2 text-foreground ${isNumeric(col.kind) ? "text-right tabular-nums whitespace-nowrap" : ""}`}
                    >
                      {i === 0 ? "Total" : isSummable(col) ? formatCell(totalOf(tb, col), col.kind) : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  );
}

function PrintTable({ table: tb }: { table: Table }) {
  return (
    <div className="mb-5">
      <p className="mb-1 font-bold">{tb.title}</p>
      {tb.rows.length === 0 ? (
        <p className="text-sm text-gray-600">{tb.emptyText ?? "Nothing in this period."}</p>
      ) : (
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-black">
              {tb.columns.map((col) => (
                <th key={col.header} className={`py-1 pr-2 ${isNumeric(col.kind) ? "text-right" : "text-left"}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tb.rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-300 align-top">
                {tb.columns.map((col) => (
                  <td key={col.header} className={`py-1 pr-2 ${isNumeric(col.kind) ? "text-right" : ""}`}>
                    {formatCell(col.get(row), col.kind)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {tb.totals && (
            <tfoot>
              <tr className="border-t-2 border-black font-bold">
                {tb.columns.map((col, i) => (
                  <td key={col.header} className={`py-1 pr-2 ${isNumeric(col.kind) ? "text-right" : ""}`}>
                    {i === 0 ? "Total" : isSummable(col) ? formatCell(totalOf(tb, col), col.kind) : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      )}
      {tb.note && <p className="mt-1 text-[10px] text-gray-600">{tb.note}</p>}
    </div>
  );
}
