"use client";

import { useEffect, useMemo, useState } from "react";
import { ScrollText, Loader2, Eye, X, ChevronLeft, ChevronRight, History } from "lucide-react";
import { toast } from "sonner";
import DatePicker from "@/components/DatePicker";
import { AuditLogService } from "@/services/auditLog.service";
import { UserService } from "@/services/user.service";
import { AuditLogType } from "@/types/auditLog.type";
import { UserType } from "@/types/user.type";
import { toDateInputValue } from "@/lib/date";

// Value sent to the backend's "method" filter param - Updated matches both PUT and PATCH
// server-side (see AuditLogController.GetAll), so the dropdown only needs to speak in terms
// an admin actually thinks in (what happened), never the underlying HTTP verb.
const TYPES = [
  { label: "Created", value: "POST" },
  { label: "Updated", value: "PUT" },
  { label: "Deleted", value: "DELETE" },
];
const PAGE_SIZE = 50;

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

// "patientName" / "PatientName" -> "Patient Name" - used wherever a raw JSON field name from
// Changes would otherwise be shown straight to a non-technical admin.
function humanizeFieldName(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

interface FieldDiff {
  field: string;
  from: unknown;
  to: unknown;
}

// Compares two log entries' "Changes" JSON key-by-key. Neither side needs to be a full
// record - just whatever fields that particular request submitted - so a field only present
// on one side still shows up (as "—" on the other).
function diffChanges(previous: string | null, current: string | null): FieldDiff[] {
  if (!previous || !current) return [];
  try {
    const prevObj = JSON.parse(previous) as Record<string, unknown>;
    const currObj = JSON.parse(current) as Record<string, unknown>;
    const keys = new Set([...Object.keys(prevObj), ...Object.keys(currObj)]);
    const diffs: FieldDiff[] = [];
    keys.forEach((key) => {
      const from = prevObj[key];
      const to = currObj[key];
      if (JSON.stringify(from) !== JSON.stringify(to)) {
        diffs.push({ field: key, from, to });
      }
    });
    return diffs;
  } catch {
    return [];
  }
}

function formatValue(value: unknown): string {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (value === "[REDACTED]") return "Hidden for security";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return typeof value === "string" ? value : JSON.stringify(value);
}

// Renders a log entry's redacted request-body JSON as a plain key/value list instead of raw
// JSON, so a non-technical admin can read what was actually submitted.
function ChangesDetails({ changes }: { changes: string }) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(changes);
  } catch {
    return <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs text-foreground">{changes}</pre>;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return (
      <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs text-foreground">
        {JSON.stringify(parsed, null, 2)}
      </pre>
    );
  }

  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">No details were recorded for this action.</p>;
  }

  return (
    <div className="max-h-64 overflow-auto rounded-md border border-border">
      <table className="w-full text-xs">
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} className="border-b border-border/50 last:border-0">
              <td className="w-1/3 py-1.5 pl-3 pr-2 align-top font-medium text-muted-foreground">
                {humanizeFieldName(key)}
              </td>
              <td className="break-all py-1.5 pr-3 align-top text-foreground">{formatValue(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogType[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);

  const [users, setUsers] = useState<UserType[]>([]);
  const [modules, setModules] = useState<string[]>([]);

  const [userId, setUserId] = useState("");
  const [module, setModuleFilter] = useState("");
  const [method, setMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [viewing, setViewing] = useState<AuditLogType | null>(null);
  const [showTechnical, setShowTechnical] = useState(false);

  const [historyFor, setHistoryFor] = useState<AuditLogType | null>(null);
  const [versions, setVersions] = useState<AuditLogType[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Either modal being open covers the page but doesn't stop the table underneath from
  // scrolling with it. This page's own wrapper div (h-full overflow-y-auto below) never
  // actually establishes a scroll context here - its ancestors (see (pages)/layout.tsx) are
  // sized with min-height/flex-1, not a fixed height, so the div's h-full collapses to
  // "auto" and real scrolling happens at the document root instead. Which element the
  // browser treats as that root scroller is inconsistent (some browsers use <body>, others
  // <html>), so both are locked to be safe.
  const isModalOpen = !!viewing || !!historyFor;

  useEffect(() => {
    if (!isModalOpen) return;
    const { style: htmlStyle } = document.documentElement;
    const { style: bodyStyle } = document.body;
    const previousHtmlOverflow = htmlStyle.overflow;
    const previousBodyOverflow = bodyStyle.overflow;
    htmlStyle.overflow = "hidden";
    bodyStyle.overflow = "hidden";
    return () => {
      htmlStyle.overflow = previousHtmlOverflow;
      bodyStyle.overflow = previousBodyOverflow;
    };
  }, [isModalOpen]);

  const openHistory = async (log: AuditLogType) => {
    setHistoryFor(log);
    setLoadingVersions(true);
    try {
      const res = await AuditLogService.getVersions(log.auditLogId);
      setVersions(res.data ?? []);
    } catch {
      toast.error("Failed to load version history");
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await UserService.getAll();
        setUsers(res.data ?? res.users ?? []);
      } catch {
        // non-critical - the username filter just stays empty
      }
      try {
        const res = await AuditLogService.getModules();
        setModules(res.data ?? []);
      } catch {
        // non-critical - the module filter just stays empty
      }
    })();
  }, []);

  useEffect(() => {
    setLoading(true);
    AuditLogService.getAll({ userId, module, method, from, to, page, pageSize: PAGE_SIZE })
      .then((res) => {
        setLogs(res.data ?? []);
        setTotalPages(res.totalPages ?? 1);
        setTotalCount(res.totalCount ?? 0);
      })
      .catch(() => toast.error("Failed to load audit log"))
      .finally(() => setLoading(false));
  }, [userId, module, method, from, to, page]);

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);

  const resetToFirstPage = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className={`py-6 px-4 sm:py-8 sm:px-10 h-full ${isModalOpen ? "overflow-hidden" : "overflow-y-auto"}`}>
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
          <ScrollText className="text-primary" /> Audit Log
        </h1>
        <p className="text-sm text-muted-foreground">
          A record of everything created, updated, deleted, or uploaded — {totalCount} entries recorded.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">From</label>
          <DatePicker value={from} onChange={resetToFirstPage(setFrom)} max={to || undefined} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">To</label>
          <DatePicker value={to} onChange={resetToFirstPage(setTo)} min={from || undefined} max={toDateInputValue(new Date())} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">User</label>
          <select
            value={userId}
            onChange={(e) => resetToFirstPage(setUserId)(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Module</label>
          <select
            value={module}
            onChange={(e) => resetToFirstPage(setModuleFilter)(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm capitalize"
          >
            <option value="">All modules</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Type</label>
          <select
            value={method}
            onChange={(e) => resetToFirstPage(setMethod)(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">All types</option>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        {(userId || module || method || from || to) && (
          <button
            onClick={() => {
              setUserId("");
              setModuleFilter("");
              setMethod("");
              setFrom("");
              setTo("");
              setPage(1);
            }}
            className="h-9 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : logs.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No audit log entries match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pl-4 pr-4">Time</th>
                  <th className="py-2 pr-4">User</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Module</th>
                  <th className="py-2 pr-4">What happened</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.auditLogId} className="border-b border-border/50">
                    <td className="py-2 pl-4 pr-4 whitespace-nowrap text-muted-foreground">{formatDateTime(log.createdAt)}</td>
                    <td className="py-2 pr-4 font-medium text-foreground">
                      {log.username || (log.userId ? usersById.get(log.userId) : null) || "—"}
                    </td>
                    <td className="py-2 pr-4 capitalize text-muted-foreground">{log.role ?? "—"}</td>
                    <td className="py-2 pr-4 capitalize text-muted-foreground">{log.module ?? "—"}</td>
                    <td className="py-2 pr-4 max-w-md text-foreground">
                      <div className="flex items-center gap-2">
                        <span className="truncate" title={log.summary}>
                          {log.summary}
                        </span>
                        {!log.succeeded && (
                          <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                            Failed
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setViewing(log);
                            setShowTechnical(false);
                          }}
                          title="View"
                          className="flex items-center justify-center rounded-full p-1.5 text-primary hover:bg-primary/10"
                        >
                          <Eye size={14} />
                        </button>
                        {log.changes && (
                          <button
                            onClick={() => openHistory(log)}
                            title="Version history"
                            className="flex items-center justify-center rounded-full p-1.5 text-primary hover:bg-primary/10"
                          >
                            <History size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border p-3 text-sm text-muted-foreground">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center justify-center rounded-full p-1.5 hover:bg-muted disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center justify-center rounded-full p-1.5 hover:bg-muted disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setViewing(null)}>
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Audit Log Entry</h2>
              <button onClick={() => setViewing(null)} className="rounded-full p-1 hover:bg-muted">
                <X size={18} />
              </button>
            </div>
            <dl className="flex flex-col gap-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase text-muted-foreground">Time</dt>
                <dd className="text-foreground">{formatDateTime(viewing.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-muted-foreground">User</dt>
                <dd className="text-foreground">
                  {viewing.username || "—"} {viewing.role ? `(${viewing.role})` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-muted-foreground">What happened</dt>
                <dd className="text-foreground">
                  {viewing.summary}
                  {!viewing.succeeded && (
                    <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                      Didn&apos;t go through
                    </span>
                  )}
                </dd>
              </div>
              {viewing.changes && (
                <div>
                  <dt className="text-xs font-semibold uppercase text-muted-foreground">Details</dt>
                  <dd className="mt-1">
                    <ChangesDetails changes={viewing.changes} />
                  </dd>
                </div>
              )}
            </dl>

            <div className="mt-4 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setShowTechnical((v) => !v)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {showTechnical ? "Hide" : "Show"} technical details
              </button>
              {showTechnical && (
                <dl className="mt-3 flex flex-col gap-2 text-xs">
                  <div>
                    <dt className="font-semibold uppercase text-muted-foreground">Request</dt>
                    <dd className="break-all font-mono text-foreground">
                      {viewing.httpMethod} {viewing.path}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase text-muted-foreground">Status / IP</dt>
                    <dd className="text-foreground">
                      {viewing.statusCode} · {viewing.ipAddress ?? "—"}
                    </dd>
                  </div>
                </dl>
              )}
            </div>
          </div>
        </div>
      )}

      {historyFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setHistoryFor(null)}>
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Version History</h2>
              <button onClick={() => setHistoryFor(null)} className="rounded-full p-1 hover:bg-muted">
                <X size={18} />
              </button>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">{historyFor.summary}</p>

            {loadingVersions ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="animate-spin" size={20} />
              </div>
            ) : versions.length <= 1 ? (
              <p className="text-sm text-muted-foreground">
                No earlier versions found for this exact record — this looks like the first (or only) action
                against it captured in the log.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {versions.map((v, i) => {
                  const previous = i > 0 ? versions[i - 1] : null;
                  const diffs = previous ? diffChanges(previous.changes, v.changes) : [];
                  return (
                    <div key={v.auditLogId} className="rounded-lg border border-border p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          Version {i + 1}
                          {v.auditLogId === historyFor.auditLogId ? " (this entry)" : ""}
                        </span>
                        <span>
                          {formatDateTime(v.createdAt)} · {v.username || "—"}
                        </span>
                      </div>
                      {i === 0 ? (
                        <p className="text-xs text-muted-foreground">Initial value — nothing to compare against.</p>
                      ) : diffs.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No field-level differences from the previous version.</p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-muted-foreground">
                              <th className="pb-1 pr-3">Field</th>
                              <th className="pb-1 pr-3">Previous</th>
                              <th className="pb-1">Current</th>
                            </tr>
                          </thead>
                          <tbody>
                            {diffs.map((d) => (
                              <tr key={d.field}>
                                <td className="pr-3 py-0.5 font-medium text-foreground">{humanizeFieldName(d.field)}</td>
                                <td className="pr-3 py-0.5 text-destructive">{formatValue(d.from)}</td>
                                <td className="py-0.5 text-primary">{formatValue(d.to)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
