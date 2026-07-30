"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  Bandage,
  CheckCircle2,
  ClipboardList,
  Droplets,
  Flag,
  HeartPulse,
  LogOut,
  PlayCircle,
  Save,
  Search,
  ShieldAlert,
  Syringe,
  Thermometer,
  Users,
} from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { EmrService } from "@/services/emr.service";
import { NursingService } from "@/services/nursing.service";
import { EmrPatientListItem, PatientSummaryType } from "@/types/emr.type";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import {
  NurseDashboardSummaryType,
  NursingChartType,
  NursingTaskType,
} from "@/types/nursing.type";

const REMARK_TYPES = ["Refusal", "ClinicalConcern", "Other"];

const errorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.message || fallback : fallback;

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString() : "—";

const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : "—";

function NurseWorkbenchInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const visitIdParam = searchParams.get("visitId") || undefined;
  const patientIdParam = searchParams.get("patientId") || undefined;

  const [checkedAuth, setCheckedAuth] = useState(false);

  const [dashboard, setDashboard] = useState<NurseDashboardSummaryType | null>(null);
  const [tasks, setTasks] = useState<NursingTaskType[]>([]);
  const [patients, setPatients] = useState<EmrPatientListItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingWorkbench, setIsLoadingWorkbench] = useState(true);

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [summary, setSummary] = useState<PatientSummaryType | null>(null);
  const [chart, setChart] = useState<NursingChartType | null>(null);
  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [isEndingEncounter, setIsEndingEncounter] = useState(false);

  // ---------------- ROLE GUARD ----------------
  useEffect(() => {
    const detail = JSON.parse(localStorage.getItem("yoton_user_detail") || "{}");
    const currentRole = (detail.role || "").toLowerCase();
    if (currentRole !== "nurse" && currentRole !== "admin") {
      router.replace("/");
      return;
    }
    setCheckedAuth(true);
  }, [router]);

  // ---------------- WORKBENCH DATA ----------------
  // Patients are fetched system-wide (no doctorId) — any doctor's patient is visible to
  // every nurse, matching how nursing coverage actually works on a ward.
  const fetchWorkbench = async () => {
    try {
      setIsLoadingWorkbench(true);
      const [dashboardRes, tasksRes, patientsRes] = await Promise.all([
        NursingService.getDashboardSummary(),
        NursingService.getTasks("pending"),
        EmrService.getPatients(),
      ]);
      setDashboard(dashboardRes.data || null);
      setTasks(tasksRes.data || []);
      setPatients(patientsRes.data || []);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load workbench data"));
    } finally {
      setIsLoadingWorkbench(false);
    }
  };

  useEffect(() => {
    if (!checkedAuth) return;
    fetchWorkbench();
  }, [checkedAuth]);

  useSignalRRefetch(
    [
      "visitCheckedIn",
      "visitStatusUpdated",
      "patientRegistered",
      "PatientUpdated",
      "nursingEncounterStarted",
      "nursingEncounterEnded",
      "nursingTaskStatusUpdated",
      "vitalsRecorded",
      "injectionRecorded",
      "dressingRecorded",
      "bloodSugarRecorded",
      "ivFluidsRecorded",
    ],
    fetchWorkbench
  );

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      await NursingService.updateTaskStatus(taskId, status);
      toast.success(`Task marked as ${status}`);
      fetchWorkbench();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update task"));
    }
  };

  // ---------------- PATIENT CHART ----------------
  const openPatient = async (patientId: string) => {
    setSelectedPatientId(patientId);
    setIsLoadingChart(true);
    try {
      const [summaryRes, chartRes, encounterRes] = await Promise.all([
        EmrService.getPatientSummary(patientId),
        NursingService.getPatientChart(patientId),
        NursingService.ensureActiveEncounter(patientId, { visitId: visitIdParam }),
      ]);
      setSummary(summaryRes.data);
      setChart(chartRes.data);
      setEncounterId(encounterRes.data?.patientEncounterId || null);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load patient chart"));
    } finally {
      setIsLoadingChart(false);
    }
  };

  // Arriving from the reception visit queue (?patientId=&visitId=) opens that patient's
  // chart directly instead of landing on the workbench list.
  useEffect(() => {
    if (checkedAuth && patientIdParam) {
      openPatient(patientIdParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedAuth, patientIdParam]);

  const endEncounter = async () => {
    if (!encounterId) return;
    try {
      setIsEndingEncounter(true);
      await NursingService.endEncounter(encounterId);
      toast.success("Encounter ended — patient sent to doctor");
      backToWorkbench();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to end encounter"));
    } finally {
      setIsEndingEncounter(false);
    }
  };

  const refreshChart = async () => {
    if (!selectedPatientId) return;
    try {
      const res = await NursingService.getPatientChart(selectedPatientId);
      setChart(res.data);
    } catch {
      // non-fatal — the just-saved entry still succeeded
    }
  };

  const backToWorkbench = () => {
    setSelectedPatientId(null);
    setSummary(null);
    setChart(null);
    setEncounterId(null);
    fetchWorkbench();
  };

  // ---------------- VITALS FORM ----------------
  const [vitalsForm, setVitalsForm] = useState({
    systolic: "",
    diastolic: "",
    heartRate: "",
    temperature: "",
    respiratoryRate: "",
    oxygenSaturation: "",
    notes: "",
  });
  const [savingVitals, setSavingVitals] = useState(false);

  const saveVitals = async () => {
    if (!encounterId) return;
    if (!vitalsForm.systolic || !vitalsForm.diastolic || !vitalsForm.heartRate) {
      toast.error("Blood pressure and heart rate are required");
      return;
    }
    try {
      setSavingVitals(true);
      await NursingService.saveVitals({
        encounterId,
        systolic: Number(vitalsForm.systolic),
        diastolic: Number(vitalsForm.diastolic),
        heartRate: Number(vitalsForm.heartRate),
        temperature: Number(vitalsForm.temperature || 0),
        respiratoryRate: Number(vitalsForm.respiratoryRate || 0),
        oxygenSaturation: Number(vitalsForm.oxygenSaturation || 0),
        notes: vitalsForm.notes.trim() || undefined,
      });
      toast.success("Vitals recorded");
      setVitalsForm({ systolic: "", diastolic: "", heartRate: "", temperature: "", respiratoryRate: "", oxygenSaturation: "", notes: "" });
      await refreshChart();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save vitals"));
    } finally {
      setSavingVitals(false);
    }
  };

  // ---------------- MEDICATION ADMINISTRATION FORM ----------------
  const [injectionForm, setInjectionForm] = useState({ medicineName: "", dose: "", route: "Oral (PO)", notes: "" });
  const [savingInjection, setSavingInjection] = useState(false);

  const saveInjection = async () => {
    if (!encounterId) return;
    if (!injectionForm.medicineName.trim() || !injectionForm.dose.trim()) {
      toast.error("Medicine name and dose are required");
      return;
    }
    try {
      setSavingInjection(true);
      await NursingService.saveInjection({
        encounterId,
        medicineName: injectionForm.medicineName.trim(),
        dose: injectionForm.dose.trim(),
        route: injectionForm.route,
        notes: injectionForm.notes.trim() || undefined,
      });
      toast.success("Medication administration recorded");
      setInjectionForm({ medicineName: "", dose: "", route: "Oral (PO)", notes: "" });
      await refreshChart();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save medication entry"));
    } finally {
      setSavingInjection(false);
    }
  };

  // ---------------- WOUND CARE FORM ----------------
  const [dressingForm, setDressingForm] = useState({
    woundType: "",
    dressingMaterial: "",
    infectionSigns: false,
    notes: "",
  });
  const [savingDressing, setSavingDressing] = useState(false);

  const saveDressing = async () => {
    if (!encounterId) return;
    if (!dressingForm.woundType || !dressingForm.dressingMaterial) {
      toast.error("Wound type and dressing material are required");
      return;
    }
    try {
      setSavingDressing(true);
      await NursingService.saveDressing({
        encounterId,
        woundType: dressingForm.woundType,
        dressingMaterial: dressingForm.dressingMaterial,
        infectionSigns: dressingForm.infectionSigns,
        notes: dressingForm.notes.trim() || undefined,
      });
      toast.success("Wound care entry recorded");
      setDressingForm({ woundType: "", dressingMaterial: "", infectionSigns: false, notes: "" });
      await refreshChart();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save wound care entry"));
    } finally {
      setSavingDressing(false);
    }
  };

  // ---------------- BLOOD SUGAR FORM ----------------
  const [sugarForm, setSugarForm] = useState({ sugarLevel: "", type: "Random", notes: "" });
  const [savingSugar, setSavingSugar] = useState(false);

  const saveBloodSugar = async () => {
    if (!encounterId) return;
    if (!sugarForm.sugarLevel) {
      toast.error("Sugar level is required");
      return;
    }
    try {
      setSavingSugar(true);
      await NursingService.saveBloodSugar({
        encounterId,
        sugarLevel: Number(sugarForm.sugarLevel),
        type: sugarForm.type,
        notes: sugarForm.notes.trim() || undefined,
      });
      toast.success("Blood sugar reading recorded");
      setSugarForm({ sugarLevel: "", type: "Random", notes: "" });
      await refreshChart();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save blood sugar reading"));
    } finally {
      setSavingSugar(false);
    }
  };

  // ---------------- IV FLUIDS FORM ----------------
  const [ivForm, setIvForm] = useState({ fluidType: "", volume: "", rate: "", notes: "" });
  const [savingIv, setSavingIv] = useState(false);

  const saveIVFluids = async () => {
    if (!encounterId) return;
    if (!ivForm.fluidType.trim() || !ivForm.volume || !ivForm.rate) {
      toast.error("Fluid type, volume, and rate are required");
      return;
    }
    try {
      setSavingIv(true);
      await NursingService.saveIVFluids({
        encounterId,
        fluidType: ivForm.fluidType.trim(),
        volume: Number(ivForm.volume),
        rate: Number(ivForm.rate),
        notes: ivForm.notes.trim() || undefined,
      });
      toast.success("IV fluids entry recorded");
      setIvForm({ fluidType: "", volume: "", rate: "", notes: "" });
      await refreshChart();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save IV fluids entry"));
    } finally {
      setSavingIv(false);
    }
  };

  // ---------------- ALLERGY FORM ----------------
  const [allergyForm, setAllergyForm] = useState({ substance: "", reaction: "" });
  const [savingAllergy, setSavingAllergy] = useState(false);

  const saveAllergy = async () => {
    if (!selectedPatientId) return;
    if (!allergyForm.substance.trim()) {
      toast.error("Substance is required");
      return;
    }
    try {
      setSavingAllergy(true);
      await EmrService.addAllergy(selectedPatientId, {
        substance: allergyForm.substance.trim(),
        reaction: allergyForm.reaction.trim() || undefined,
      });
      toast.success("Allergy recorded");
      setAllergyForm({ substance: "", reaction: "" });
      const res = await EmrService.getPatientSummary(selectedPatientId);
      setSummary(res.data);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to record allergy"));
    } finally {
      setSavingAllergy(false);
    }
  };

  // ---------------- SPECIAL REMARK FORM ----------------
  const [remarkForm, setRemarkForm] = useState({ remarkType: REMARK_TYPES[0], description: "" });
  const [savingRemark, setSavingRemark] = useState(false);

  const saveSpecialRemark = async () => {
    if (!selectedPatientId) return;
    if (!remarkForm.description.trim()) {
      toast.error("Description is required");
      return;
    }
    try {
      setSavingRemark(true);
      await NursingService.addSpecialRemark(selectedPatientId, {
        remarkType: remarkForm.remarkType,
        description: remarkForm.description.trim(),
      });
      toast.success("Special remark added");
      setRemarkForm({ remarkType: REMARK_TYPES[0], description: "" });
      await refreshChart();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to add special remark"));
    } finally {
      setSavingRemark(false);
    }
  };

  const filteredPatients = patients.filter(
    (p) =>
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.opId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.assignedDoctorName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!checkedAuth) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // ==================== PATIENT CHART ====================
  if (selectedPatientId) {
    return (
      <div className="py-8 px-10 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={backToWorkbench}
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"
          >
            <ArrowLeft size={16} /> Back to workbench
          </button>
          {encounterId && (
            <button
              onClick={endEncounter}
              disabled={isEndingEncounter}
              className="flex items-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white transition-colors cursor-pointer"
            >
              <LogOut size={15} /> {isEndingEncounter ? "Ending..." : "End Encounter & Send to Doctor"}
            </button>
          )}
        </div>

        {isLoadingChart || !summary ? (
          <LoadingSpinner />
        ) : (
          <div className="flex flex-col gap-6">
            <div className="card p-6 flex flex-col gap-1 border-l-4 border-l-primary">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                    <HeartPulse className="text-primary" /> {summary.name}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    MRN #{summary.opId} · {summary.sex || "—"} · DOB {formatDate(summary.dateOfBirth)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {summary.phone || "No phone"} · {summary.email || "No email"}
                  </p>
                </div>
                {summary.latestEncounter?.chiefComplaint && (
                  <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 max-w-sm">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Chief Complaint</p>
                    <p className="text-sm text-foreground">{summary.latestEncounter.chiefComplaint}</p>
                  </div>
                )}
              </div>

              {summary.allergies.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
                  <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                  {summary.allergies.map((a) => (
                    <span
                      key={a.patientAllergyId}
                      className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-400"
                    >
                      {a.substance} {a.reaction ? `— ${a.reaction}` : ""}
                    </span>
                  ))}
                </div>
              )}

              {chart && chart.specialRemarks.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
                  <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  {chart.specialRemarks.map((r) => (
                    <span
                      key={r.specialRemarkId}
                      className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400"
                      title={r.description}
                    >
                      {r.remarkType}: {r.description}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Read-only clinical snapshot from the doctor's EMR */}
              <div className="card p-6 flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <ClipboardList size={18} className="text-primary" /> Clinical Snapshot
                </h2>
                <div>
                  <p className="text-sm font-semibold text-foreground/90 mb-2">Chronic Conditions</p>
                  {summary.chronicConditions.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {summary.chronicConditions.map((c) => (
                        <div key={c.chronicConditionId} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm">
                          <span className="font-medium">{c.name}</span>
                          <span className="text-xs text-muted-foreground">{c.status}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">None recorded.</p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground/90 mb-2">Current Medications</p>
                  {summary.currentMedications.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {summary.currentMedications.map((m) => (
                        <div key={m.medicationId} className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm">
                          <span className="font-medium">{m.drugName}</span>
                          <span className="text-xs text-muted-foreground ml-2">{m.dosage} {m.frequency}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No active prescriptions.</p>
                  )}
                </div>
              </div>

              {/* Vital Signs */}
              <div className="card p-6 flex flex-col gap-4 lg:col-span-2">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Thermometer size={18} className="text-primary" /> Vital Signs
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="flex gap-2 col-span-2 sm:col-span-1">
                    <input type="number" placeholder="Sys" value={vitalsForm.systolic} onChange={(e) => setVitalsForm((p) => ({ ...p, systolic: e.target.value }))} className="h-10 text-sm w-full" />
                    <input type="number" placeholder="Dia" value={vitalsForm.diastolic} onChange={(e) => setVitalsForm((p) => ({ ...p, diastolic: e.target.value }))} className="h-10 text-sm w-full" />
                  </div>
                  <input type="number" placeholder="Heart Rate (BPM)" value={vitalsForm.heartRate} onChange={(e) => setVitalsForm((p) => ({ ...p, heartRate: e.target.value }))} className="h-10 text-sm" />
                  <input type="number" step="0.1" placeholder="Temp (°C)" value={vitalsForm.temperature} onChange={(e) => setVitalsForm((p) => ({ ...p, temperature: e.target.value }))} className="h-10 text-sm" />
                  <input type="number" placeholder="Resp Rate" value={vitalsForm.respiratoryRate} onChange={(e) => setVitalsForm((p) => ({ ...p, respiratoryRate: e.target.value }))} className="h-10 text-sm" />
                  <input type="number" placeholder="SpO2 (%)" value={vitalsForm.oxygenSaturation} onChange={(e) => setVitalsForm((p) => ({ ...p, oxygenSaturation: e.target.value }))} className="h-10 text-sm" />
                </div>
                <textarea placeholder="Notes..." value={vitalsForm.notes} onChange={(e) => setVitalsForm((p) => ({ ...p, notes: e.target.value }))} className="w-full min-h-14 text-sm" />
                <button onClick={saveVitals} disabled={savingVitals} className="self-start flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  <Save size={15} /> Save Vitals
                </button>

                {chart && chart.vitals.length > 0 && (
                  <div className="overflow-x-auto border-t border-border pt-3">
                    <table>
                      <thead>
                        <tr>
                          <th>Recorded</th><th>BP</th><th>HR</th><th>Temp</th><th>SpO2</th><th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {chart.vitals.slice(0, 5).map((v) => (
                          <tr key={v.vitalsRecordId}>
                            <td className="text-xs">{formatDateTime(v.recordedAt)}</td>
                            <td>{v.systolic}/{v.diastolic}</td>
                            <td>{v.heartRate}</td>
                            <td>{v.temperature}°C</td>
                            <td>{v.oxygenSaturation}%</td>
                            <td>
                              {v.isCritical && (
                                <span className="rounded-full bg-red-100 text-red-700 text-xs px-2 py-0.5 font-semibold">Critical</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Medication Administration */}
              <div className="card p-6 flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Syringe size={18} className="text-primary" /> Medication Administration
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="text" placeholder="Medicine name (e.g. Paracetamol)" value={injectionForm.medicineName} onChange={(e) => setInjectionForm((p) => ({ ...p, medicineName: e.target.value }))} className="h-10 text-sm" />
                  <input type="text" placeholder="Dose (e.g. 500mg)" value={injectionForm.dose} onChange={(e) => setInjectionForm((p) => ({ ...p, dose: e.target.value }))} className="h-10 text-sm" />
                  <select value={injectionForm.route} onChange={(e) => setInjectionForm((p) => ({ ...p, route: e.target.value }))} className="h-10 text-sm sm:col-span-2">
                    <option>Oral (PO)</option>
                    <option>Intravenous (IV)</option>
                    <option>Intramuscular (IM)</option>
                    <option>Subcutaneous (SC)</option>
                    <option>Topical</option>
                  </select>
                </div>
                <textarea placeholder="Notes..." value={injectionForm.notes} onChange={(e) => setInjectionForm((p) => ({ ...p, notes: e.target.value }))} className="w-full min-h-14 text-sm" />
                <button onClick={saveInjection} disabled={savingInjection} className="self-start flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  <Save size={15} /> Save Entry
                </button>

                {chart && chart.injections.length > 0 && (
                  <div className="flex flex-col gap-1.5 border-t border-border pt-3 max-h-40 overflow-y-auto">
                    {chart.injections.slice(0, 5).map((i) => (
                      <div key={i.injectionRecordId} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm">
                        <span className="font-medium">{i.medicineName} · {i.dose} · {i.route}</span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(i.givenAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Wound Care */}
              <div className="card p-6 flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Bandage size={18} className="text-primary" /> Wound Care
                </h2>
                <select value={dressingForm.woundType} onChange={(e) => setDressingForm((p) => ({ ...p, woundType: e.target.value }))} className="h-10 text-sm">
                  <option value="">Select wound type...</option>
                  <option>Surgical Incision</option>
                  <option>Pressure Ulcer</option>
                  <option>Laceration</option>
                  <option>Diabetic Ulcer</option>
                  <option>Burn</option>
                </select>
                <select value={dressingForm.dressingMaterial} onChange={(e) => setDressingForm((p) => ({ ...p, dressingMaterial: e.target.value }))} className="h-10 text-sm">
                  <option value="">Select dressing material...</option>
                  <option>Alginate Dressing</option>
                  <option>Gauze</option>
                  <option>Hydrocolloid</option>
                  <option>Foam Dressing</option>
                  <option>Transparent Film</option>
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={dressingForm.infectionSigns} onChange={(e) => setDressingForm((p) => ({ ...p, infectionSigns: e.target.checked }))} />
                  Signs of infection observed (redness, swelling, warmth, or discharge)
                </label>
                <textarea placeholder="Notes..." value={dressingForm.notes} onChange={(e) => setDressingForm((p) => ({ ...p, notes: e.target.value }))} className="w-full min-h-14 text-sm" />
                <button onClick={saveDressing} disabled={savingDressing} className="self-start flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  <Save size={15} /> Save Entry
                </button>

                {chart && chart.dressings.length > 0 && (
                  <div className="flex flex-col gap-1.5 border-t border-border pt-3 max-h-40 overflow-y-auto">
                    {chart.dressings.slice(0, 5).map((d) => (
                      <div key={d.dressingTaskId} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm">
                        <span className="font-medium">{d.woundType} · {d.dressingMaterial}</span>
                        <span className={`text-xs ${d.infectionSigns ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                          {d.infectionSigns ? "Infection signs" : formatDate(d.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Blood Sugar */}
              <div className="card p-6 flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Droplets size={18} className="text-primary" /> Blood Sugar
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" placeholder="Sugar (mg/dL)" value={sugarForm.sugarLevel} onChange={(e) => setSugarForm((p) => ({ ...p, sugarLevel: e.target.value }))} className="h-10 text-sm" />
                  <select value={sugarForm.type} onChange={(e) => setSugarForm((p) => ({ ...p, type: e.target.value }))} className="h-10 text-sm">
                    <option>Random</option>
                    <option>Fasting</option>
                    <option>Post-Prandial</option>
                  </select>
                </div>
                <textarea placeholder="Notes..." value={sugarForm.notes} onChange={(e) => setSugarForm((p) => ({ ...p, notes: e.target.value }))} className="w-full min-h-14 text-sm" />
                <button onClick={saveBloodSugar} disabled={savingSugar} className="self-start flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  <Save size={15} /> Save Entry
                </button>

                {chart && chart.bloodSugarChecks.length > 0 && (
                  <div className="flex flex-col gap-1.5 border-t border-border pt-3 max-h-32 overflow-y-auto">
                    {chart.bloodSugarChecks.slice(0, 5).map((s) => (
                      <div key={s.bloodSugarTaskId} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm">
                        <span className="font-medium">{s.sugarLevel} mg/dL · {s.type}</span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(s.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* IV Fluids */}
              <div className="card p-6 flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Activity size={18} className="text-primary" /> IV Fluids
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input type="text" placeholder="Fluid type (e.g. Normal Saline)" value={ivForm.fluidType} onChange={(e) => setIvForm((p) => ({ ...p, fluidType: e.target.value }))} className="h-10 text-sm sm:col-span-1" />
                  <input type="number" placeholder="Volume (ml)" value={ivForm.volume} onChange={(e) => setIvForm((p) => ({ ...p, volume: e.target.value }))} className="h-10 text-sm" />
                  <input type="number" placeholder="Rate (ml/hr)" value={ivForm.rate} onChange={(e) => setIvForm((p) => ({ ...p, rate: e.target.value }))} className="h-10 text-sm" />
                </div>
                <textarea placeholder="Notes..." value={ivForm.notes} onChange={(e) => setIvForm((p) => ({ ...p, notes: e.target.value }))} className="w-full min-h-14 text-sm" />
                <button onClick={saveIVFluids} disabled={savingIv} className="self-start flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  <Save size={15} /> Save Entry
                </button>

                {chart && chart.ivFluids.length > 0 && (
                  <div className="flex flex-col gap-1.5 border-t border-border pt-3 max-h-32 overflow-y-auto">
                    {chart.ivFluids.slice(0, 5).map((f) => (
                      <div key={f.ivFluidsTaskId} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm">
                        <span className="font-medium">{f.fluidType} · {f.volume}ml @ {f.rate}ml/hr</span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(f.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Allergies */}
              <div className="card p-6 flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <AlertTriangle size={18} className="text-primary" /> Allergies
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="text" placeholder="Substance (e.g. Penicillin)" value={allergyForm.substance} onChange={(e) => setAllergyForm((p) => ({ ...p, substance: e.target.value }))} className="h-10 text-sm" />
                  <input type="text" placeholder="Reaction (optional)" value={allergyForm.reaction} onChange={(e) => setAllergyForm((p) => ({ ...p, reaction: e.target.value }))} className="h-10 text-sm" />
                </div>
                <button onClick={saveAllergy} disabled={savingAllergy} className="self-start flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  <Save size={15} /> Add Allergy
                </button>
              </div>

              {/* Special Remarks */}
              <div className="card p-6 flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Flag size={18} className="text-primary" /> Special Remark
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select value={remarkForm.remarkType} onChange={(e) => setRemarkForm((p) => ({ ...p, remarkType: e.target.value }))} className="h-10 text-sm">
                    {REMARK_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <input type="text" placeholder="Description" value={remarkForm.description} onChange={(e) => setRemarkForm((p) => ({ ...p, description: e.target.value }))} className="h-10 text-sm" />
                </div>
                <button onClick={saveSpecialRemark} disabled={savingRemark} className="self-start flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  <Save size={15} /> Add Remark
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== WORKBENCH ====================
  return (
    <div className="py-8 px-10 h-full overflow-y-auto">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
            <HeartPulse className="text-primary" /> Nurse Workbench
          </h1>
          <p className="text-sm text-muted-foreground">
            Every patient across all doctors is visible here — open a chart to record vitals and care.
          </p>
        </div>
      </div>

      {isLoadingWorkbench ? (
        <LoadingSpinner />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<Users size={18} />} label="Patients Under Care" value={dashboard?.patientsUnderCare ?? 0} />
            <StatCard icon={<ClipboardList size={18} />} label="Pending Tasks" value={dashboard?.pendingTasks ?? 0} />
            <StatCard icon={<AlertTriangle size={18} />} label="Critical Alerts" value={dashboard?.criticalAlerts ?? 0} accent />
            <StatCard icon={<CheckCircle2 size={18} />} label="Completed Today" value={dashboard?.completedToday ?? 0} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card p-6">
              <div className="flex items-center justify-between mb-4 gap-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Users size={18} className="text-primary" /> Patient Monitoring
                </h2>
                <div className="relative w-64">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by name, MRN, or doctor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-10 pl-9 text-sm"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>MRN</th>
                      <th>Name</th>
                      <th>Assigned Doctor</th>
                      <th>Last Visit</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPatients.length > 0 ? (
                      filteredPatients.map((p) => (
                        <tr key={p.opId}>
                          <td className="font-mono text-xs">#{p.opId}</td>
                          <td className="font-semibold">{p.name}</td>
                          <td>{p.assignedDoctorName || "—"}</td>
                          <td>{formatDate(p.lastAppointmentDate)}</td>
                          <td>
                            <button
                              onClick={() => openPatient(p.opId)}
                              className="text-sm font-semibold text-primary hover:underline"
                            >
                              Open Chart
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center text-muted-foreground py-8">
                          No patients found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <ClipboardList size={18} className="text-primary" /> Pending Tasks
              </h2>
              <div className="flex flex-col gap-3 max-h-[28rem] overflow-y-auto">
                {tasks.length > 0 ? (
                  tasks.map((t) => (
                    <div key={t.nursingTaskId} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm text-foreground">{t.taskType}</p>
                          <p className="text-xs text-muted-foreground">{t.patientName || "Unknown patient"}</p>
                        </div>
                        <span className="rounded-full bg-amber-100 text-amber-700 text-xs px-2 py-0.5 font-semibold shrink-0">
                          {t.status}
                        </span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {t.status === "Pending" && (
                          <button
                            onClick={() => updateTaskStatus(t.nursingTaskId, "InProgress")}
                            className="flex-1 flex items-center justify-center gap-1 bg-primary/10 hover:bg-primary/20 text-primary font-semibold py-1.5 rounded-lg text-xs transition-colors"
                          >
                            <PlayCircle size={13} /> Start
                          </button>
                        )}
                        <button
                          onClick={() => updateTaskStatus(t.nursingTaskId, "Completed")}
                          className="flex-1 flex items-center justify-center gap-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-1.5 rounded-lg text-xs transition-colors"
                        >
                          <CheckCircle2 size={13} /> Complete
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No pending tasks. Great job!</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NurseWorkbenchPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    }>
      <NurseWorkbenchInner />
    </Suspense>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
        <span className={accent && value > 0 ? "text-red-600" : "text-primary"}>{icon}</span>
      </div>
      <p className={`text-2xl font-semibold ${accent && value > 0 ? "text-red-600" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
