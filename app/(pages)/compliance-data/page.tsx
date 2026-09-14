"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Loader2, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { ComplianceDataService } from "@/services/complianceData.service";
import { StaffFteType, PatientComplianceFlagType } from "@/types/complianceData.type";

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
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const [flags, setFlags] = useState<PatientComplianceFlagType[]>([]);
  const [loadingFlags, setLoadingFlags] = useState(true);
  const [flagSearch, setFlagSearch] = useState("");
  const [savingConditionId, setSavingConditionId] = useState<string | null>(null);
  const [diabetesDrafts, setDiabetesDrafts] = useState<Record<string, string>>({});

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

  const handleSaveFte = async (userId: string) => {
    const raw = fteDrafts[userId];
    const fteValue = raw === undefined || raw === "" ? null : Number(raw);
    if (fteValue !== null && (Number.isNaN(fteValue) || fteValue <= 0 || fteValue > 2)) {
      toast.error("FTE must be a positive number (typically between 0 and 1, up to 2 for rare dual-role staff)");
      return;
    }
    setSavingUserId(userId);
    try {
      await ComplianceDataService.updateStaffFte(userId, fteValue);
      setStaff((prev) => prev.map((s) => (s.userId === userId ? { ...s, fteValue } : s)));
      toast.success("FTE updated");
    } catch {
      toast.error("Failed to update FTE");
    } finally {
      setSavingUserId(null);
    }
  };

  const handleSaveNonacuteAdmission = async (flag: PatientComplianceFlagType, value: boolean) => {
    setSavingConditionId(flag.chronicConditionId);
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
      toast.success("Compliance flag updated");
    } catch {
      toast.error("Failed to update compliance flag");
    } finally {
      setSavingConditionId(null);
    }
  };

  const handleSaveDiabetesType = async (flag: PatientComplianceFlagType) => {
    const draft = diabetesDrafts[flag.chronicConditionId];
    const diabetesType = draft === undefined ? flag.diabetesType ?? "" : draft;
    setSavingConditionId(flag.chronicConditionId);
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
      toast.success("Diabetes type updated");
    } catch {
      toast.error("Failed to update diabetes type");
    } finally {
      setSavingConditionId(null);
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
          <p className="text-sm text-muted-foreground">No active staff found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Designation</th>
                  <th className="py-2 pr-4">Department</th>
                  <th className="py-2 pr-4">FTE</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => {
                  const draft = fteDrafts[s.userId] ?? (s.fteValue != null ? String(s.fteValue) : "");
                  const isSaving = savingUserId === s.userId;
                  return (
                    <tr key={s.userId} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-medium text-foreground">{s.name}</td>
                      <td className="py-2 pr-4 capitalize text-muted-foreground">{s.role ?? "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{s.userDesignation ?? "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{s.departmentName ?? "—"}</td>
                      <td className="py-2 pr-4">
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          max="2"
                          placeholder="1.00"
                          value={draft}
                          onChange={(e) => setFteDrafts((prev) => ({ ...prev, [s.userId]: e.target.value }))}
                          className="h-8 w-24 rounded-md border border-border bg-background px-2 text-sm"
                        />
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => handleSaveFte(s.userId)}
                          disabled={isSaving}
                          title="Save"
                          className="flex items-center justify-center rounded-full p-1.5 text-primary hover:bg-primary/10 disabled:opacity-50"
                        >
                          {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                        </button>
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
          <p className="text-sm text-muted-foreground">No hypertension or diabetes records found.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredFlags.map((f) => {
              const isSaving = savingConditionId === f.chronicConditionId;
              return (
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
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={f.hasNonacuteAdmission}
                        disabled={isSaving}
                        onChange={(e) => handleSaveNonacuteAdmission(f, e.target.checked)}
                      />
                      Nonacute inpatient admission
                    </label>
                  )}

                  {f.isDiabetes && (
                    <div className="flex items-center gap-2">
                      <select
                        value={diabetesDrafts[f.chronicConditionId] ?? f.diabetesType ?? ""}
                        onChange={(e) =>
                          setDiabetesDrafts((prev) => ({ ...prev, [f.chronicConditionId]: e.target.value }))
                        }
                        className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                      >
                        {DIABETES_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleSaveDiabetesType(f)}
                        disabled={isSaving}
                        title="Save"
                        className="flex items-center justify-center rounded-full p-1.5 text-primary hover:bg-primary/10 disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
