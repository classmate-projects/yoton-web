"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Smile, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PatientSatisfactionService } from "@/services/patientSatisfaction.service";
import { ReceptionService } from "@/services/reception.service";
import { confirmDeleteToast } from "@/lib/confirmDeleteToast";
import { PatientSatisfactionCreatePayload, PatientSatisfactionType } from "@/types/patientSatisfaction.type";
import { PatientListItemType } from "@/types/appointment.type";

const QUESTIONS: { key: keyof typeof emptyScores; label: string }[] = [
  { key: "q1Score", label: "Q4: Satisfied with scheduling your appointment?" },
  { key: "q2Score", label: "Q5: Satisfied with waiting time to get an appointment?" },
  { key: "q3Score", label: "Q6: Satisfied with parking availability?" },
  { key: "q4Score", label: "Q7: Satisfied with the waiting area/exam room/environment?" },
  { key: "q5Score", label: "Q8: Satisfied with staff politeness/professionalism?" },
  { key: "q6Score", label: "Q9: Satisfied with provider's understanding of medical history?" },
  { key: "q7Score", label: "Q10: Satisfied with respect for privacy during discussions?" },
  { key: "q8Score", label: "Q11: Satisfied with time spent on treatment plan/medication?" },
  { key: "q9Score", label: "Q12: Satisfied with the explanation of illness/treatment/results?" },
  { key: "q10Score", label: "Q13: Satisfied with discharge information (care plan/follow-up)?" },
  { key: "q11Score", label: "Q14: Satisfied with overall visit experience?" },
];

const SCORE_OPTIONS = [
  { value: "1", label: "1 - Very Dissatisfied" },
  { value: "2", label: "2 - Dissatisfied" },
  { value: "3", label: "3 - Neutral" },
  { value: "4", label: "4 - Satisfied" },
  { value: "5", label: "5 - Very Satisfied" },
  { value: "8", label: "N/A" },
];

const emptyScores = {
  q1Score: "", q2Score: "", q3Score: "", q4Score: "", q5Score: "",
  q6Score: "", q7Score: "", q8Score: "", q9Score: "", q10Score: "", q11Score: "",
};

const emptyForm = {
  ...emptyScores,
  patientId: "",
  specialty: "",
  collectedDate: "",
  genderCode: "",
  ageBandCode: "",
  nationalityCode: "",
  whatWorkedWell: "",
  whatNeededImprovement: "",
};

export default function PatientSatisfactionPage() {
  const [responses, setResponses] = useState<PatientSatisfactionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [patients, setPatients] = useState<PatientListItemType[]>([]);
  // Set while correcting an existing response - reuses the same form as logging a new one,
  // matching every other add-form-doubles-as-edit-form in this feature.
  const [editingResponseId, setEditingResponseId] = useState<string | null>(null);

  const fetchResponses = async () => {
    setLoading(true);
    try {
      const res = await PatientSatisfactionService.getAll();
      setResponses(res.data ?? []);
    } catch {
      toast.error("Failed to load patient satisfaction responses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResponses();
    ReceptionService.getAllPatients().then((data) => setPatients(data.patients ?? [])).catch(() => {});
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingResponseId(null);
  };

  const startEditResponse = (r: PatientSatisfactionType) => {
    setForm({
      patientId: r.patientId || "",
      specialty: r.specialty || "",
      collectedDate: r.collectedDate ? r.collectedDate.slice(0, 10) : "",
      genderCode: r.genderCode || "",
      ageBandCode: r.ageBandCode || "",
      nationalityCode: r.nationalityCode || "",
      whatWorkedWell: r.whatWorkedWell || "",
      whatNeededImprovement: r.whatNeededImprovement || "",
      q1Score: r.q1Score != null ? String(r.q1Score) : "",
      q2Score: r.q2Score != null ? String(r.q2Score) : "",
      q3Score: r.q3Score != null ? String(r.q3Score) : "",
      q4Score: r.q4Score != null ? String(r.q4Score) : "",
      q5Score: r.q5Score != null ? String(r.q5Score) : "",
      q6Score: r.q6Score != null ? String(r.q6Score) : "",
      q7Score: r.q7Score != null ? String(r.q7Score) : "",
      q8Score: r.q8Score != null ? String(r.q8Score) : "",
      q9Score: r.q9Score != null ? String(r.q9Score) : "",
      q10Score: r.q10Score != null ? String(r.q10Score) : "",
      q11Score: r.q11Score != null ? String(r.q11Score) : "",
    });
    setEditingResponseId(r.patientSatisfactionResponseId);
    setShowForm(true);
  };

  const removeResponse = (r: PatientSatisfactionType) => {
    confirmDeleteToast(
      <span>Delete this response from <b className="text-red-500 ml-1">{r.patientName || "Anonymous"}</b>?</span>,
      async () => {
        try {
          await PatientSatisfactionService.remove(r.patientSatisfactionResponseId);
          toast.success("Response removed");
          await fetchResponses();
        } catch {
          toast.error("Failed to remove response");
        }
      }
    );
  };

  const submitResponse = async () => {
    if (!form.collectedDate) {
      toast.error("Collected date is required");
      return;
    }
    const payload: PatientSatisfactionCreatePayload = {
      patientId: form.patientId || undefined,
      specialty: form.specialty || undefined,
      collectedDate: form.collectedDate,
      genderCode: form.genderCode || undefined,
      ageBandCode: form.ageBandCode || undefined,
      nationalityCode: form.nationalityCode || undefined,
      whatWorkedWell: form.whatWorkedWell || undefined,
      whatNeededImprovement: form.whatNeededImprovement || undefined,
    };
    const scores: Partial<Record<string, number>> = {};
    for (const q of QUESTIONS) {
      const value = form[q.key];
      if (value) scores[q.key] = Number(value);
    }
    Object.assign(payload, scores);

    try {
      setIsSaving(true);
      if (editingResponseId) {
        await PatientSatisfactionService.update(editingResponseId, payload);
        toast.success("Response updated");
      } else {
        await PatientSatisfactionService.create(payload);
        toast.success("Response recorded");
      }
      resetForm();
      setShowForm(false);
      await fetchResponses();
    } catch {
      toast.error(editingResponseId ? "Failed to update response" : "Failed to record response");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
            <Smile className="text-primary" /> Patient Satisfaction
          </h1>
          <p className="text-sm text-muted-foreground">
            Log offline-collected outpatient satisfaction survey responses — feeds the PL5.1 KPI report.
          </p>
        </div>
        <button
          onClick={() => {
            if (showForm) resetForm();
            setShowForm((v) => !v);
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Cancel" : "Log Response"}
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={form.patientId}
              onChange={(e) => setForm((p) => ({ ...p, patientId: e.target.value }))}
              className="h-10 text-sm"
            >
              <option value="">Patient (optional, anonymous if blank)</option>
              {patients.map((p) => (
                <option key={p.opId} value={p.opId}>{p.name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Specialty"
              value={form.specialty}
              onChange={(e) => setForm((p) => ({ ...p, specialty: e.target.value }))}
              className="h-10 text-sm"
            />
            <input
              type="date"
              value={form.collectedDate}
              onChange={(e) => setForm((p) => ({ ...p, collectedDate: e.target.value }))}
              className="h-10 text-sm"
            />
            <select
              value={form.genderCode}
              onChange={(e) => setForm((p) => ({ ...p, genderCode: e.target.value }))}
              className="h-10 text-sm"
            >
              <option value="">Gender</option>
              <option value="1">Male</option>
              <option value="2">Female</option>
            </select>
            <select
              value={form.ageBandCode}
              onChange={(e) => setForm((p) => ({ ...p, ageBandCode: e.target.value }))}
              className="h-10 text-sm"
            >
              <option value="">Age band</option>
              <option value="1">18-24</option>
              <option value="2">25-34</option>
              <option value="3">35-44</option>
              <option value="4">45-54</option>
              <option value="5">55-64</option>
              <option value="6">65-74</option>
              <option value="7">75 or older</option>
            </select>
            <select
              value={form.nationalityCode}
              onChange={(e) => setForm((p) => ({ ...p, nationalityCode: e.target.value }))}
              className="h-10 text-sm"
            >
              <option value="">Nationality</option>
              <option value="1">Qatari</option>
              <option value="2">Non-Qatari</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            {QUESTIONS.map((q) => (
              <div key={q.key} className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="text-sm text-foreground/90 sm:w-2/3">{q.label}</label>
                <select
                  value={form[q.key]}
                  onChange={(e) => setForm((p) => ({ ...p, [q.key]: e.target.value }))}
                  className="h-9 text-sm sm:w-1/3"
                >
                  <option value="">Not answered</option>
                  {SCORE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <textarea
            placeholder="What worked well"
            value={form.whatWorkedWell}
            onChange={(e) => setForm((p) => ({ ...p, whatWorkedWell: e.target.value }))}
            className="w-full min-h-16 text-sm"
          />
          <textarea
            placeholder="What needed improvement"
            value={form.whatNeededImprovement}
            onChange={(e) => setForm((p) => ({ ...p, whatNeededImprovement: e.target.value }))}
            className="w-full min-h-16 text-sm"
          />

          <button
            onClick={submitResponse}
            disabled={isSaving}
            className="self-start flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {editingResponseId ? "Save Changes" : "Save Response"}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : responses.length === 0 ? (
        <p className="text-sm text-muted-foreground">No responses logged yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {responses.map((r) => (
            <div key={r.patientSatisfactionResponseId} className="card p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{r.patientName || "Anonymous"}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{new Date(r.collectedDate).toLocaleDateString()}</span>
                  <button onClick={() => startEditResponse(r)} title="Edit" className="p-1.5 hover:bg-primary/10 rounded-full text-primary">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => removeResponse(r)} title="Delete" className="p-1.5 hover:bg-destructive/10 rounded-full text-destructive">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {r.specialty && <p className="text-xs text-muted-foreground">{r.specialty}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
