"use client";

import { useEffect, useState } from "react";
import EmptyState from "@/components/EmptyState";
import { Droplets, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { HandHygieneService } from "@/services/handHygiene.service";
import SearchableSelect from "@/components/SearchableSelect";
import DatePicker from "@/components/DatePicker";
import { DepartmentSerivce } from "@/services/department.service";
import { confirmDeleteToast } from "@/lib/confirmDeleteToast";
import { notifySaveStatus } from "@/lib/saveStatus";
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
  // Set while correcting an existing session - reuses the same form as recording a new one,
  // matching every other add-form-doubles-as-edit-form in this feature. Editing replaces the
  // whole observation batch rather than diffing individual rows.
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

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

  const resetSessionForm = () => {
    setDepartmentId("");
    setWard("");
    setObservationDate("");
    setObservations([{ ...emptyObservation }]);
    setEditingSessionId(null);
  };

  const startEditSession = (s: HandHygieneSessionType) => {
    setDepartmentId(s.departmentId || "");
    setWard(s.ward || "");
    setObservationDate(s.observationDate ? s.observationDate.slice(0, 10) : "");
    setObservations(
      s.observations.length > 0
        ? s.observations.map((o) => ({
            professionalCode: o.professionalCode || "",
            indicationCode: o.indicationCode || "",
            actionCode: o.actionCode || "",
          }))
        : [{ ...emptyObservation }]
    );
    setEditingSessionId(s.handHygieneAuditSessionId);
  };

  const removeSession = (s: HandHygieneSessionType) => {
    confirmDeleteToast(
      <span>Delete this audit session ({s.observationCount} observations)?</span>,
      async () => {
        try {
          await HandHygieneService.removeSession(s.handHygieneAuditSessionId);
          toast.success("Audit session removed");
          await fetchSessions();
        } catch {
          toast.error("Failed to remove audit session");
        }
      }
    );
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

    notifySaveStatus("saving");
    try {
      setIsSaving(true);
      const payload = {
        departmentId: departmentId || undefined,
        ward: ward || undefined,
        observationDate,
        observations: validObservations,
      };
      if (editingSessionId) {
        await HandHygieneService.updateSession(editingSessionId, payload);
        toast.success("Audit session updated");
      } else {
        await HandHygieneService.createSession(payload);
        toast.success("Audit session recorded");
      }
      notifySaveStatus("saved");
      resetSessionForm();
      await fetchSessions();
    } catch {
      notifySaveStatus("error");
      toast.error(editingSessionId ? "Failed to update audit session" : "Failed to record audit session");
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
          <SearchableSelect
            value={departmentId}
            onChange={setDepartmentId}
            options={[
              { value: "", label: "Department" },
              ...departments.map((d) => ({ value: d.departmentId, label: d.name })),
            ]}
          />
          <input
            type="text"
            placeholder="Ward"
            value={ward}
            onChange={(e) => setWard(e.target.value)}
            className="h-10 text-sm"
          />
          <DatePicker
            value={observationDate}
            onChange={setObservationDate}
          />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-foreground/90">Observations</p>
          {observations.map((o, index) => (
            <div key={index} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
              <SearchableSelect
                value={o.professionalCode}
                onChange={(v) => updateObservation(index, "professionalCode", v)}
                options={[
                  { value: "", label: "Professional" },
                  ...PROFESSIONAL_CODES.map((p) => ({ value: p.code, label: p.label })),
                ]}
              />
              <SearchableSelect
                value={o.indicationCode}
                onChange={(v) => updateObservation(index, "indicationCode", v)}
                options={[
                  { value: "", label: "Moment/indication" },
                  ...INDICATION_CODES.map((p) => ({ value: p.code, label: p.label })),
                ]}
              />
              <SearchableSelect
                value={o.actionCode}
                onChange={(v) => updateObservation(index, "actionCode", v)}
                options={[
                  { value: "", label: "Action" },
                  ...ACTION_CODES.map((p) => ({ value: p.code, label: p.label })),
                ]}
              />
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

        <div className="flex items-center gap-3">
          <button
            onClick={submitSession}
            disabled={isSaving}
            className="self-start flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {editingSessionId ? "Save Changes" : "Save Session"}
          </button>
          {editingSessionId && (
            <button onClick={resetSessionForm} className="text-sm font-semibold text-muted-foreground hover:underline">
              Cancel
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : sessions.length === 0 ? (
        <EmptyState
          illustration="hygiene"
          title="No audit sessions recorded yet"
          description="Hand hygiene observation sessions will be listed here."
        />
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
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5">
                  {s.observationCount} observations
                </span>
                <button onClick={() => startEditSession(s)} title="Edit" className="p-1.5 hover:bg-primary/10 rounded-full text-primary">
                  <Pencil size={14} />
                </button>
                <button onClick={() => removeSession(s)} title="Delete" className="p-1.5 hover:bg-destructive/10 rounded-full text-destructive">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
