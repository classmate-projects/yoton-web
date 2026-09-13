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

const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];
const PAGE_SIZE = 50;

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
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
  return typeof value === "string" ? value : JSON.stringify(value);
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

  const [historyFor, setHistoryFor] = useState<AuditLogType | null>(null);
  const [versions, setVersions] = useState<AuditLogType[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

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
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
          <ScrollText className="text-primary" /> Audit Log
        </h1>
        <p className="text-sm text-muted-foreground">
          Every user action, login to logout — {totalCount} entries recorded.
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
          <label className="text-xs font-semibold text-muted-foreground">Method</label>
          <select
            value={method}
            onChange={(e) => resetToFirstPage(setMethod)(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">All methods</option>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
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
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Status</th>
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
                    <td className="py-2 pr-4 max-w-md truncate text-foreground" title={log.action}>
                      {log.action}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          log.statusCode < 400 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {log.statusCode}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setViewing(log)}
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
                <dt className="text-xs font-semibold uppercase text-muted-foreground">Action</dt>
                <dd className="text-foreground">{viewing.action}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-muted-foreground">Path</dt>
                <dd className="break-all font-mono text-xs text-foreground">
                  {viewing.httpMethod} {viewing.path}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-muted-foreground">Status / IP</dt>
                <dd className="text-foreground">
                  {viewing.statusCode} · {viewing.ipAddress ?? "—"}
                </dd>
              </div>
              {viewing.changes && (
                <div>
                  <dt className="text-xs font-semibold uppercase text-muted-foreground">Changes</dt>
                  <dd>
                    <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs text-foreground">
                      {(() => {
                        try {
                          return JSON.stringify(JSON.parse(viewing.changes), null, 2);
                        } catch {
                          return viewing.changes;
                        }
                      })()}
                    </pre>
                  </dd>
                </div>
              )}
            </dl>
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
            <p className="mb-4 break-all font-mono text-xs text-muted-foreground">{historyFor.path}</p>

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
                                <td className="pr-3 py-0.5 font-medium text-foreground">{d.field}</td>
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
