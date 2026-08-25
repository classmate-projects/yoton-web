"use client";

import { useEffect, useState } from "react";
import { Droplets, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { HandHygieneService } from "@/services/handHygiene.service";
import { DepartmentSerivce } from "@/services/department.service";
import { HandHygieneObservationInput, HandHygieneSessionType } from "@/types/handHygiene.type";
import { DepartmentTypes } from "@/types/department.type";

const PROFESSIONAL_CODES = [
  { code: "1.1", label: "Nurse" },
  { code: "1.2", label: "Midwife" },
  { code: "1.3", label: "Nurse/midwife" },
  { code: "2", label: "Auxiliary" },
  { code: "3.1", label: "Internal medicine" },
  { code: "3.2", label: "Surgeon" },
  { code: "3.3", label: "Anaesthetist/resuscitator/emergency physician" },
  { code: "3.4", label: "Paediatrician" },
  { code: "3.5", label: "Gynaecologist" },
  { code: "3.6", label: "Consultant" },
  { code: "3.7", label: "Medical student" },
  { code: "3.8", label: "Family physician" },
  { code: "4.1", label: "Therapist" },
  { code: "4.2", label: "Technician" },
  { code: "4.3", label: "Other care professional" },
  { code: "4.4", label: "Dental healthcare worker" },
  { code: "4.5", label: "Student" },
];

const INDICATION_CODES = [
  { code: "1", label: "Before patient contact" },
  { code: "2", label: "Before clean/aseptic procedures" },
  { code: "3", label: "After body fluid exposure risk" },
  { code: "4", label: "After touching a patient" },
  { code: "5", label: "After touching patient surroundings" },
];

const ACTION_CODES = [
  { code: "1", label: "Hand rubbing (alcohol-based)" },
  { code: "2", label: "Hand washing (soap and water)" },
  { code: "3", label: "Missed" },
  { code: "4", label: "Gloves" },
];

const emptyObservation: HandHygieneObservationInput = { professionalCode: "", indicationCode: "", actionCode: "" };

export default function HandHygienePage() {
  const [sessions, setSessions] = useState<HandHygieneSessionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<DepartmentTypes[]>([]);

  const [departmentId, setDepartmentId] = useState("");
  const [ward, setWard] = useState("");
  const [observationDate, setObservationDate] = useState("");
  const [observations, setObservations] = useState<HandHygieneObservationInput[]>([{ ...emptyObservation }]);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await HandHygieneService.getSessions();
      setSessions(res.data ?? []);
    } catch {
      toast.error("Failed to load hand hygiene audit sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    DepartmentSerivce.getAll().then((data) => setDepartments((data || []).filter((d: DepartmentTypes) => d.isActive))).catch(() => {});
  }, []);

  const updateObservation = (index: number, field: keyof HandHygieneObservationInput, value: string) => {
    setObservations((prev) => prev.map((o, i) => (i === index ? { ...o, [field]: value } : o)));
  };

  const submitSession = async () => {
    if (!observationDate) {
      toast.error("Observation date is required");
      return;
    }
    const validObservations = observations.filter((o) => o.actionCode);
    if (validObservations.length === 0) {
      toast.error("At least one observation with an action is required");
      return;
    }

    try {
      setIsSaving(true);
      await HandHygieneService.createSession({
        departmentId: departmentId || undefined,
        ward: ward || undefined,
        observationDate,
        observations: validObservations,
      });
      toast.success("Audit session recorded");
      setDepartmentId("");
      setWard("");
      setObservationDate("");
      setObservations([{ ...emptyObservation }]);
      await fetchSessions();
    } catch {
      toast.error("Failed to record audit session");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
          <Droplets className="text-primary" /> Hand Hygiene Audit
        </h1>
        <p className="text-sm text-muted-foreground">
          Record a batch of hand-hygiene compliance observations from one walk-through — feeds the PL4.1 KPI report.
        </p>
      </div>

      <div className="card p-6 mb-6 flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="h-10 text-sm">
            <option value="">Department</option>
            {departments.map((d) => (
              <option key={d.departmentId} value={d.departmentId}>{d.name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Ward"
            value={ward}
            onChange={(e) => setWard(e.target.value)}
            className="h-10 text-sm"
          />
          <input
            type="date"
            value={observationDate}
            onChange={(e) => setObservationDate(e.target.value)}
            className="h-10 text-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-foreground/90">Observations</p>
          {observations.map((o, index) => (
            <div key={index} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
              <select
                value={o.professionalCode}
                onChange={(e) => updateObservation(index, "professionalCode", e.target.value)}
                className="h-9 text-sm"
              >
                <option value="">Professional</option>
                {PROFESSIONAL_CODES.map((p) => (
                  <option key={p.code} value={p.code}>{p.label}</option>
                ))}
              </select>
              <select
                value={o.indicationCode}
                onChange={(e) => updateObservation(index, "indicationCode", e.target.value)}
                className="h-9 text-sm"
              >
                <option value="">Moment/indication</option>
                {INDICATION_CODES.map((p) => (
                  <option key={p.code} value={p.code}>{p.label}</option>
                ))}
              </select>
              <select
                value={o.actionCode}
                onChange={(e) => updateObservation(index, "actionCode", e.target.value)}
                className="h-9 text-sm"
              >
                <option value="">Action</option>
                {ACTION_CODES.map((p) => (
                  <option key={p.code} value={p.code}>{p.label}</option>
                ))}
              </select>
              <button
                onClick={() => setObservations((prev) => prev.filter((_, i) => i !== index))}
                disabled={observations.length === 1}
                className="flex items-center justify-center gap-1 text-xs font-semibold text-red-600 hover:underline disabled:opacity-40"
              >
                <Trash2 size={14} /> Remove
              </button>
            </div>
          ))}
          <button
            onClick={() => setObservations((prev) => [...prev, { ...emptyObservation }])}
            className="self-start flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <Plus size={14} /> Add observation
          </button>
        </div>

        <button
          onClick={submitSession}
          disabled={isSaving}
          className="self-start flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Save Session
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No audit sessions recorded yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((s) => (
            <div key={s.handHygieneAuditSessionId} className="card p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {s.departmentName || "No department"} {s.ward ? `· ${s.ward}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(s.observationDate).toLocaleDateString()} · {s.auditorName || "Unknown auditor"}
                </p>
              </div>
              <span className="rounded-full bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5">
                {s.observationCount} observations
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
