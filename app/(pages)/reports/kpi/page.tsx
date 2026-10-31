"use client";

import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
import { FileSpreadsheet, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import DatePicker from "@/components/DatePicker";
import { KpiReportService } from "@/services/kpiReport.service";
import { toDateInputValue } from "@/lib/date";

interface KpiReportSummary {
  key: string;
  title: string;
  category: string;
}

function defaultRangeStart(): string {
  const now = new Date();
  return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
}

// A failed blob download's error body arrives as a Blob, not parsed JSON — this
// reads it back out so the toast can show the API's actual message instead of
// a generic fallback.
async function extractErrorMessage(err: unknown): Promise<string> {
  const response = (err as { response?: { data?: unknown } })?.response;
  const data = response?.data;
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text);
      if (parsed?.message) return parsed.message as string;
    } catch {
      // fall through to generic message below
    }
  }
  return "Failed to download report";
}

export default function KpiReportsPage() {
  const [reports, setReports] = useState<KpiReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState(defaultRangeStart());
  const [end, setEnd] = useState(toDateInputValue(new Date()));
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await KpiReportService.getCatalog();
        setReports(res.data ?? []);
      } catch {
        toast.error("Failed to load KPI report catalog");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, KpiReportSummary[]>();
    for (const report of reports) {
      const list = byCategory.get(report.category) ?? [];
      list.push(report);
      byCategory.set(report.category, list);
    }
    return Array.from(byCategory.entries());
  }, [reports]);

  const handleDownload = async (report: KpiReportSummary) => {
    if (!start || !end) {
      toast.error("Select a start and end date first");
      return;
    }
    if (end < start) {
      toast.error("End date must not be before start date");
      return;
    }

    setDownloadingKey(report.key);
    try {
      const res = await KpiReportService.download(report.key, start, end);
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${report.key}_${start}_to_${end}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(await extractErrorMessage(err));
    } finally {
      setDownloadingKey(null);
    }
  };

  return (
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
          <FileSpreadsheet className="text-primary" /> KPI Reports
        </h1>
        <p className="text-sm text-muted-foreground">
          HSPA-2 compliance reports, generated from Yoton&apos;s own data and downloaded in the
          exact regulator template format. Pick a date range, then download any report below.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 mb-8 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Start date</label>
          <DatePicker value={start} onChange={setStart} max={end || undefined} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">End date</label>
          <DatePicker value={end} onChange={setEnd} min={start || undefined} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : reports.length === 0 ? (
        <EmptyState illustration="chart" title="No KPI reports are available yet" />
      ) : (
        <div className="flex flex-col gap-8">
          {grouped.map(([category, items]) => (
            <div key={category}>
              <h2 className="mb-3 text-lg font-semibold text-foreground">{category}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((report) => {
                  const isDownloading = downloadingKey === report.key;
                  return (
                    <div
                      key={report.key}
                      className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4"
                    >
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                          {report.key}
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">{report.title}</p>
                      </div>
                      <button
                        onClick={() => handleDownload(report)}
                        disabled={isDownloading}
                        className="flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isDownloading ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <Download size={16} />
                        )}
                        Download Excel
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
