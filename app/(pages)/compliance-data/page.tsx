"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import EmptyState from "@/components/EmptyState";
import { ShieldCheck, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { ComplianceDataService } from "@/services/complianceData.service";
import SearchableSelect from "@/components/SearchableSelect";
import { StaffFteType, PatientComplianceFlagType } from "@/types/complianceData.type";
import { notifySaveStatus } from "@/lib/saveStatus";

const DIABETES_TYPE_OPTIONS = [
  { value: "", label: "Unspecified" },
  { value: "Type1", label: "Type 1" },
  { value: "Type2", label: "Type 2" },
  { value: "Gestational", label: "Gestational" },
  { value: "SteroidInduced", label: "Steroid-Induced" },
  { value: "Other", label: "Other" },
];

export default function ComplianceDataPage() {
  const [staff, setStaff] = useState<StaffFteType[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [fteDrafts, setFteDrafts] = useState<Record<string, string>>({});

  const [flags, setFlags] = useState<PatientComplianceFlagType[]>([]);
  const [loadingFlags, setLoadingFlags] = useState(true);
  const [flagSearch, setFlagSearch] = useState("");
  const [diabetesDrafts, setDiabetesDrafts] = useState<Record<string, string>>({});

  // Per-user debounce timers for FTE text input
  const fteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await ComplianceDataService.getStaffFte();
        setStaff(res.data ?? []);
      } catch {
        toast.error("Failed to load staff FTE list");
      } finally {
        setLoadingStaff(false);
      }
    })();
    (async () => {
      try {
        const res = await ComplianceDataService.getPatientFlags();
        setFlags(res.data ?? []);
      } catch {
        toast.error("Failed to load patient compliance flags");
      } finally {
        setLoadingFlags(false);
      }
    })();
  }, []);

  const handleFteDraftChange = (userId: string, raw: string) => {
    setFteDrafts((prev) => ({ ...prev, [userId]: raw }));

    if (fteTimers.current[userId]) clearTimeout(fteTimers.current[userId]);
    notifySaveStatus("saving");

    fteTimers.current[userId] = setTimeout(async () => {
      const fteValue = raw === "" ? null : Number(raw);
      if (fteValue !== null && (Number.isNaN(fteValue) || fteValue <= 0 || fteValue > 2)) {
        notifySaveStatus("error");
        toast.error("FTE must be between 0 and 2");
        return;
      }
      try {
        await ComplianceDataService.updateStaffFte(userId, fteValue);
        setStaff((prev) => prev.map((s) => (s.userId === userId ? { ...s, fteValue } : s)));
        notifySaveStatus("saved");
      } catch {
        notifySaveStatus("error");
        toast.error("Failed to update FTE");
      }
    }, 800);
  };

  const handleNonacuteChange = async (flag: PatientComplianceFlagType, value: boolean) => {
    notifySaveStatus("saving");
    try {
      const res = await ComplianceDataService.updatePatientFlags(flag.chronicConditionId, { hasNonacuteAdmission: value });
      const newId = res.data as string;
      setFlags((prev) =>
        prev.map((f) =>
          f.chronicConditionId === flag.chronicConditionId
            ? { ...f, chronicConditionId: newId, hasNonacuteAdmission: value }
            : f
        )
      );
      notifySaveStatus("saved");
    } catch {
      notifySaveStatus("error");
      toast.error("Failed to update compliance flag");
    }
  };

  const handleDiabetesTypeChange = async (flag: PatientComplianceFlagType, diabetesType: string) => {
    setDiabetesDrafts((prev) => ({ ...prev, [flag.chronicConditionId]: diabetesType }));
    notifySaveStatus("saving");
    try {
      const res = await ComplianceDataService.updatePatientFlags(flag.chronicConditionId, { diabetesType });
      const newId = res.data as string;
      setFlags((prev) =>
        prev.map((f) =>
          f.chronicConditionId === flag.chronicConditionId
            ? { ...f, chronicConditionId: newId, diabetesType: diabetesType || null }
            : f
        )
      );
      notifySaveStatus("saved");
    } catch {
      notifySaveStatus("error");
      toast.error("Failed to update diabetes type");
    }
  };

  const filteredFlags = useMemo(() => {
    const q = flagSearch.trim().toLowerCase();
    if (!q) return flags;
    return flags.filter(
      (f) =>
        f.patientName.toLowerCase().includes(q) ||
        (f.patientOPNumber ?? "").toLowerCase().includes(q) ||
        f.conditionName.toLowerCase().includes(q)
    );
  }, [flags, flagSearch]);

  return (
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
          <ShieldCheck className="text-primary" /> Compliance Data
        </h1>
        <p className="text-sm text-muted-foreground">
          Regulatory data points the KPI reports need but that have no other home in the EMR —
          staff FTE (feeds PL4.2) and patient exclusion flags (feed PL4.8/PL4.9/PL4.10).
        </p>
      </div>

      {/* Staff FTE */}
      <div className="mb-10 rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Staff FTE</h2>
        {loadingStaff ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : staff.length === 0 ? (
          <EmptyState illustration="users" title="No active staff found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Designation</th>
                  <th className="py-2 pr-4">Department</th>
                  <th className="py-2">FTE</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => {
                  const draft = fteDrafts[s.userId] ?? (s.fteValue != null ? String(s.fteValue) : "");
                  return (
                    <tr key={s.userId} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-medium text-foreground">{s.name}</td>
                      <td className="py-2 pr-4 capitalize text-muted-foreground">{s.role ?? "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{s.userDesignation ?? "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{s.departmentName ?? "—"}</td>
                      <td className="py-2">
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          max="2"
                          placeholder="1.00"
                          value={draft}
                          onChange={(e) => handleFteDraftChange(s.userId, e.target.value)}
                          className="h-8 w-24 rounded-md border border-border bg-background px-2 text-sm"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Patient Compliance Flags */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Patient Compliance Flags</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <input
              type="text"
              placeholder="Search patient or MRN..."
              value={flagSearch}
              onChange={(e) => setFlagSearch(e.target.value)}
              className="h-9 w-64 rounded-md border border-border bg-background pl-8 pr-3 text-sm"
            />
          </div>
        </div>
        {loadingFlags ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : filteredFlags.length === 0 ? (
          <EmptyState illustration="chart" title="No hypertension or diabetes records found" />
        ) : (
          <div className="flex flex-col gap-3">
            {filteredFlags.map((f) => (
              <div
                key={f.chronicConditionId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {f.patientName} <span className="text-muted-foreground">({f.patientOPNumber ?? "—"})</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{f.conditionName}</p>
                </div>

                {f.isHypertension && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={f.hasNonacuteAdmission}
                      onChange={(e) => handleNonacuteChange(f, e.target.checked)}
                    />
                    Nonacute inpatient admission
                  </label>
                )}

                {f.isDiabetes && (
                  <SearchableSelect
                    value={diabetesDrafts[f.chronicConditionId] ?? f.diabetesType ?? ""}
                    onChange={(v) => handleDiabetesTypeChange(f, v)}
                    options={DIABETES_TYPE_OPTIONS}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
