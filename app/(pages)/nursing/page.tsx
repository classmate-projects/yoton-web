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
  ClipboardCheck,
  ClipboardList,
  Droplets,
  FileText,
  Flag,
  HeartPulse,
  Lock,
  LogOut,
  Pill,
  PlayCircle,
  Save,
  Search,
  ShieldAlert,
  Stethoscope,
  Syringe,
  Thermometer,
  Users,
} from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import RichTextEditor from "@/components/RichTextEditor";
import TrendChart from "@/components/TrendChart";
import { EmrService } from "@/services/emr.service";
import { NursingService } from "@/services/nursing.service";
import { UserService } from "@/services/user.service";
import { UserType } from "@/types/user.type";
import { AssignedDoctorsInfo } from "@/types/assignedDoctors.type";
import { EmrPatientListItem, PatientSummaryType } from "@/types/emr.type";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import {
  NurseDashboardSummaryType,
  NursingChartType,
  WorkQueueItemType,
  NurseOnDutyType,
} from "@/types/nursing.type";

const REMARK_TYPES = ["Refusal", "ClinicalConcern", "Other"];

const EWS_BAND_STYLES: Record<string, string> = {
  Low: "bg-emerald-100 text-emerald-700",
  Medium: "bg-amber-100 text-amber-700",
  High: "bg-red-100 text-red-700",
};

const TREND_METRICS = {
  ewsScore: { label: "EWS Score", color: "#dc2626", unit: "" },
  heartRate: { label: "Heart Rate", color: "#2563eb", unit: " bpm" },
  temperature: { label: "Temperature", color: "#d97706", unit: "°C" },
  oxygenSaturation: { label: "O2 Saturation", color: "#0891b2", unit: "%" },
  respiratoryRate: { label: "Respiratory Rate", color: "#7c3aed", unit: " br/min" },
  systolic: { label: "Systolic BP", color: "#059669", unit: " mmHg" },
} as const;

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
  const [role, setRole] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");

  // Admin has no nurse/doctor identity of their own — every write endpoint that resolves
  // "which nurse/doctor is this?" from the caller's JWT falls back to requiring an explicit
  // id for any non-nurse/non-doctor caller, so admin must pick both before writing anything.
  const [nurses, setNurses] = useState<UserType[]>([]);
  const [selectedNurseId, setSelectedNurseId] = useState<string>("");
  const [assignedDoctors, setAssignedDoctors] = useState<AssignedDoctorsInfo[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");

  const [dashboard, setDashboard] = useState<NurseDashboardSummaryType | null>(null);
  const [workQueue, setWorkQueue] = useState<WorkQueueItemType[]>([]);
  const [onDutyNurses, setOnDutyNurses] = useState<NurseOnDutyType[]>([]);
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
    const allowedModules: string[] = detail.allowedModules || [];
    if (currentRole !== "admin" && !allowedModules.includes("/nursing")) {
      router.replace("/");
      return;
    }
    setRole(currentRole);
    setCurrentUserId(detail.userId || "");
    setCheckedAuth(true);
  }, [router]);

  const isAdmin = role === "admin";
  // Doctor gets read-only visibility into nursing charting (see NursingController — every
  // write endpoint there is locked to admin/nurse specifically). canEdit gates every write
  // form/button below so a doctor viewer only ever sees data, never an input for it.
  const isDoctor = role === "doctor";
  const canEdit = !isDoctor;

  // Admin write actions require an explicit nurse/doctor id in place of the JWT-derived one
  // a real nurse/doctor gets automatically — see NursingController.ResolveNurseId and
  // EmrController.ResolveDoctorScopeAsync.
  const requireNurseSelected = () => {
    if (isAdmin && !selectedNurseId) {
      toast.error("Select a nurse first — you're viewing across all nurses.");
      return false;
    }
    return true;
  };
  const requireDoctorSelectedForAllergy = () => {
    if (isAdmin && !selectedDoctorId) {
      toast.error("Select a doctor first to attribute this allergy record.");
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (!checkedAuth || !isAdmin) return;
    UserService.get_assigned_doctors().then((res) => setAssignedDoctors(res.data || [])).catch(() => {});
  }, [checkedAuth, isAdmin]);

  // Needed by admin (acting-on-behalf-of picker) AND a real nurse (witness picker for
  // high-risk medication administration) — not admin-only like assigned-doctors above.
  useEffect(() => {
    if (!checkedAuth || !(isAdmin || role === "nurse")) return;
    UserService.getAllByRole("nurse").then((res) => setNurses(res.data || [])).catch(() => {});
  }, [checkedAuth, isAdmin, role]);

  // ---------------- WORKBENCH DATA ----------------
  // Patients are fetched system-wide (no doctorId) — any doctor's patient is visible to
  // every nurse, matching how nursing coverage actually works on a ward.
  const fetchWorkbench = async () => {
    try {
      setIsLoadingWorkbench(true);
      const [dashboardRes, workQueueRes, onDutyRes, patientsRes] = await Promise.all([
        NursingService.getDashboardSummary(),
        NursingService.getWorkQueue(),
        NursingService.getOnDutyNow(),
        EmrService.getPatients(),
      ]);
      setDashboard(dashboardRes.data || null);
      setWorkQueue(workQueueRes.data || []);
      setOnDutyNurses(onDutyRes.data || []);
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
      // Reading the chart works fine for admin either way, but starting/resuming an
      // encounter is a write that requires a nurse identity — skip it (read-only view)
      // rather than failing the whole patient-open with a raw 400 if none is picked yet.
      const canStartEncounter = !isAdmin || !!selectedNurseId;
      const [summaryRes, chartRes, encounterRes] = await Promise.all([
        EmrService.getPatientSummary(patientId),
        NursingService.getPatientChart(patientId),
        canStartEncounter
          ? NursingService.ensureActiveEncounter(patientId, {
              visitId: visitIdParam,
              nurseId: isAdmin ? selectedNurseId : undefined,
            })
          : Promise.resolve({ data: null }),
      ]);
      setSummary(summaryRes.data);
      setChart(chartRes.data);
      setEncounterId(encounterRes.data?.patientEncounterId || null);
      if (!canStartEncounter) {
        toast("Select a nurse to start recording for this patient.", { icon: "ℹ️" });
      }
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
    heightCm: "",
    weightKg: "",
    consciousnessLevel: "Alert",
    supplementalOxygen: false,
    notes: "",
  });
  const [savingVitals, setSavingVitals] = useState(false);
  const [vitalsView, setVitalsView] = useState<"table" | "trend">("table");
  const [trendMetric, setTrendMetric] = useState<"heartRate" | "temperature" | "oxygenSaturation" | "respiratoryRate" | "systolic" | "ewsScore">("ewsScore");
  const [painView, setPainView] = useState<"table" | "trend">("table");

  const liveBmi = (() => {
    const height = Number(vitalsForm.heightCm);
    const weight = Number(vitalsForm.weightKg);
    if (!height || !weight) return null;
    return (weight / Math.pow(height / 100, 2)).toFixed(1);
  })();

  // Preview only — the server's own calculation (NursingController.CalculateEws) is what's
  // persisted, same rule as BMI. Mirrors the backend's NEWS2 point table exactly.
  const liveEws = (() => {
    const rr = Number(vitalsForm.respiratoryRate);
    const spo2 = Number(vitalsForm.oxygenSaturation);
    const temp = Number(vitalsForm.temperature);
    const sbp = Number(vitalsForm.systolic);
    const hr = Number(vitalsForm.heartRate);
    if (!rr || !spo2 || !temp || !sbp || !hr) return null;

    const score = (v: number, bands: [number, number][]) => bands.find(([max]) => v <= max)?.[1] ?? bands[bands.length - 1][1];
    const rrScore = score(rr, [[8, 3], [11, 1], [20, 0], [24, 2], [Infinity, 3]]);
    const spo2Score = score(spo2, [[91, 3], [93, 2], [95, 1], [Infinity, 0]]);
    const o2Score = vitalsForm.supplementalOxygen ? 2 : 0;
    const tempScore = score(temp, [[35.0, 3], [36.0, 1], [38.0, 0], [39.0, 1], [Infinity, 2]]);
    const sbpScore = score(sbp, [[90, 3], [100, 2], [110, 1], [219, 0], [Infinity, 3]]);
    const hrScore = score(hr, [[40, 3], [50, 1], [90, 0], [110, 1], [130, 2], [Infinity, 3]]);
    const locScore = vitalsForm.consciousnessLevel === "Alert" ? 0 : 3;

    return rrScore + spo2Score + o2Score + tempScore + sbpScore + hrScore + locScore;
  })();

  const saveVitals = async () => {
    if (!encounterId) return;
    if (!vitalsForm.systolic || !vitalsForm.diastolic || !vitalsForm.heartRate) {
      toast.error("Blood pressure and heart rate are required");
      return;
    }
    if (!requireNurseSelected()) return;
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
        heightCm: Number(vitalsForm.heightCm || 0),
        weightKg: Number(vitalsForm.weightKg || 0),
        consciousnessLevel: vitalsForm.consciousnessLevel,
        supplementalOxygen: vitalsForm.supplementalOxygen,
        notes: vitalsForm.notes.trim() || undefined,
        nurseId: isAdmin ? selectedNurseId : undefined,
      });
      toast.success("Vitals recorded");
      setVitalsForm({ systolic: "", diastolic: "", heartRate: "", temperature: "", respiratoryRate: "", oxygenSaturation: "", heightCm: "", weightKg: "", consciousnessLevel: "Alert", supplementalOxygen: false, notes: "" });
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
    if (!requireNurseSelected()) return;
    try {
      setSavingInjection(true);
      await NursingService.saveInjection({
        encounterId,
        medicineName: injectionForm.medicineName.trim(),
        dose: injectionForm.dose.trim(),
        route: injectionForm.route,
        notes: injectionForm.notes.trim() || undefined,
        nurseId: isAdmin ? selectedNurseId : undefined,
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
    if (!requireNurseSelected()) return;
    try {
      setSavingDressing(true);
      await NursingService.saveDressing({
        encounterId,
        woundType: dressingForm.woundType,
        dressingMaterial: dressingForm.dressingMaterial,
        infectionSigns: dressingForm.infectionSigns,
        notes: dressingForm.notes.trim() || undefined,
        nurseId: isAdmin ? selectedNurseId : undefined,
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
    if (!requireNurseSelected()) return;
    try {
      setSavingSugar(true);
      await NursingService.saveBloodSugar({
        encounterId,
        sugarLevel: Number(sugarForm.sugarLevel),
        type: sugarForm.type,
        notes: sugarForm.notes.trim() || undefined,
        nurseId: isAdmin ? selectedNurseId : undefined,
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
    if (!requireNurseSelected()) return;
    try {
      setSavingIv(true);
      await NursingService.saveIVFluids({
        encounterId,
        fluidType: ivForm.fluidType.trim(),
        volume: Number(ivForm.volume),
        rate: Number(ivForm.rate),
        notes: ivForm.notes.trim() || undefined,
        nurseId: isAdmin ? selectedNurseId : undefined,
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
    // Unlike the NursingController writes above, this one goes through EmrController —
    // real nurses are exempt from its doctorId requirement entirely, but admin isn't.
    if (!requireDoctorSelectedForAllergy()) return;
    try {
      setSavingAllergy(true);
      await EmrService.addAllergy(
        selectedPatientId,
        {
          substance: allergyForm.substance.trim(),
          reaction: allergyForm.reaction.trim() || undefined,
        },
        isAdmin ? selectedDoctorId : undefined
      );
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

  // ---------------- NURSE NOTES (rich text + confidential toggle) ----------------
  const [nurseNoteHtml, setNurseNoteHtml] = useState("");
  const [nurseNoteConfidential, setNurseNoteConfidential] = useState(false);
  const [savingNurseNote, setSavingNurseNote] = useState(false);

  const saveNurseNote = async () => {
    if (!selectedPatientId) return;
    if (!nurseNoteHtml.trim() || nurseNoteHtml === "<p></p>") {
      toast.error("Note content is required");
      return;
    }
    if (!requireNurseSelected()) return;
    try {
      setSavingNurseNote(true);
      const payload = {
        encounterId: encounterId || undefined,
        contentHtml: nurseNoteHtml,
        isConfidential: nurseNoteConfidential,
        nurseId: isAdmin ? selectedNurseId : undefined,
      };
      if (nurseNoteConfidential) {
        await NursingService.addConfidentialNote(selectedPatientId, payload);
        toast.success("Confidential note saved — visible only to you");
      } else {
        await NursingService.addNote(selectedPatientId, payload);
        toast.success("Nurse note added");
      }
      setNurseNoteHtml("");
      setNurseNoteConfidential(false);
      await refreshChart();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save note"));
    } finally {
      setSavingNurseNote(false);
    }
  };

  // ---------------- EXAMINATION NOTES FORM ----------------
  const [examForm, setExamForm] = useState({
    generalAppearance: "",
    painLevel: "0",
    mobility: "",
    clinicalChecks: "",
  });
  const [savingExam, setSavingExam] = useState(false);

  const saveExaminationNote = async () => {
    if (!selectedPatientId) return;
    if (!requireNurseSelected()) return;
    try {
      setSavingExam(true);
      await NursingService.addExaminationNote(selectedPatientId, {
        encounterId: encounterId || undefined,
        generalAppearance: examForm.generalAppearance.trim() || undefined,
        painLevel: Number(examForm.painLevel || 0),
        mobility: examForm.mobility.trim() || undefined,
        clinicalChecks: examForm.clinicalChecks.trim() || undefined,
        nurseId: isAdmin ? selectedNurseId : undefined,
      });
      toast.success("Examination note recorded");
      setExamForm({ generalAppearance: "", painLevel: "0", mobility: "", clinicalChecks: "" });
      await refreshChart();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save examination note"));
    } finally {
      setSavingExam(false);
    }
  };

  // ---------------- TREATMENTS (doctor-ordered, mark done only) ----------------
  const [markingTreatmentId, setMarkingTreatmentId] = useState<string | null>(null);

  const markTreatmentDone = async (treatmentId: string) => {
    if (!requireNurseSelected()) return;
    try {
      setMarkingTreatmentId(treatmentId);
      await NursingService.markTreatmentDone(treatmentId, isAdmin ? selectedNurseId : undefined);
      toast.success("Treatment marked done");
      await refreshChart();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update treatment"));
    } finally {
      setMarkingTreatmentId(null);
    }
  };

  // ---------------- PRESCRIBED MEDICATIONS (administer doctor's prescriptions) ----------------
  const [administeringMedicationId, setAdministeringMedicationId] = useState<string | null>(null);
  const [administerForm, setAdministerForm] = useState({ doseGiven: "", route: "Oral (PO)", remarks: "", witnessUserId: "", witnessPassword: "" });
  const [savingAdministration, setSavingAdministration] = useState(false);

  // High-risk medications need a live, bedside second-nurse check — the witness
  // authenticates in the moment (their own password, verified server-side), not an async
  // approval queue. See NursingController.AdministerMedication.
  const administerMedication = async (medicationId: string, isHighRisk: boolean) => {
    if (!requireNurseSelected()) return;
    if (isHighRisk && (!administerForm.witnessUserId || !administerForm.witnessPassword)) {
      toast.error("This is a high-risk medication — a second nurse must witness and confirm with their password");
      return;
    }
    try {
      setSavingAdministration(true);
      await NursingService.administerMedication(medicationId, {
        doseGiven: administerForm.doseGiven.trim() || undefined,
        route: administerForm.route,
        remarks: administerForm.remarks.trim() || undefined,
        nurseId: isAdmin ? selectedNurseId : undefined,
        witnessUserId: isHighRisk ? administerForm.witnessUserId : undefined,
        witnessPassword: isHighRisk ? administerForm.witnessPassword : undefined,
      });
      toast.success("Medication administration recorded");
      setAdministeringMedicationId(null);
      setAdministerForm({ doseGiven: "", route: "Oral (PO)", remarks: "", witnessUserId: "", witnessPassword: "" });
      if (selectedPatientId) {
        const res = await EmrService.getPatientSummary(selectedPatientId);
        setSummary(res.data);
      }
    } catch (error) {
      toast.error(errorMessage(error, "Failed to record administration"));
    } finally {
      setSavingAdministration(false);
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
      <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6 gap-4">
          <button
            onClick={backToWorkbench}
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"
          >
            <ArrowLeft size={16} /> Back to workbench
          </button>
          {isDoctor && (
            <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Lock size={12} /> Read-only view
            </span>
          )}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <select
                value={selectedNurseId}
                onChange={(e) => setSelectedNurseId(e.target.value)}
                title="Nurse identity for recording vitals, injections, dressings, etc."
                className="h-9 w-44 shrink-0 text-sm"
              >
                <option value="">Acting nurse…</option>
                {nurses.map((n) => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                title="Doctor to attribute allergy records to"
                className="h-9 w-44 shrink-0 text-sm"
              >
                <option value="">Acting doctor (for allergies)…</option>
                {assignedDoctors.map((d) => (
                  <option key={String(d.doctorId)} value={String(d.doctorId)}>{d.userName}</option>
                ))}
              </select>
            </div>
          )}
          {encounterId && canEdit && (
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

                {/* Doctor's encounter - surfaced here instead of the nurse needing to go
                    find it on the "Electronic Medical Record" page separately. */}
                {(summary.latestEncounter?.chiefComplaint ||
                  summary.diagnoses.length > 0 ||
                  summary.latestEncounter?.examinationNotes ||
                  summary.latestEncounter?.clinicalExamination) && (
                  <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-sm font-semibold text-foreground/90 flex items-center gap-1.5">
                      <Stethoscope size={14} className="text-primary" /> Doctor&apos;s Encounter
                    </p>
                    {summary.latestEncounter?.chiefComplaint && (
                      <p className="text-sm text-foreground">
                        <span className="font-semibold">Chief complaint:</span> {summary.latestEncounter.chiefComplaint}
                      </p>
                    )}
                    {summary.diagnoses.length > 0 && (
                      <p className="text-sm text-foreground">
                        <span className="font-semibold">Diagnosis:</span>{" "}
                        {summary.diagnoses.map((d) => d.diagnosisName).join(", ")}
                      </p>
                    )}
                    {summary.latestEncounter?.clinicalExamination && (
                      <p className="text-sm text-foreground">
                        <span className="font-semibold">Clinical examination:</span> {summary.latestEncounter.clinicalExamination}
                      </p>
                    )}
                    {summary.latestEncounter?.examinationNotes && (
                      <p className="text-sm text-foreground">
                        <span className="font-semibold">Examination notes:</span> {summary.latestEncounter.examinationNotes}
                      </p>
                    )}
                  </div>
                )}

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
                {canEdit && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="flex items-center gap-1 col-span-2 sm:col-span-1">
                        <input type="number" placeholder="Sys" value={vitalsForm.systolic} onChange={(e) => setVitalsForm((p) => ({ ...p, systolic: e.target.value }))} className="h-10 text-sm w-full" />
                        <span className="text-xs text-muted-foreground shrink-0">/</span>
                        <input type="number" placeholder="Dia" value={vitalsForm.diastolic} onChange={(e) => setVitalsForm((p) => ({ ...p, diastolic: e.target.value }))} className="h-10 text-sm w-full" />
                        <span className="text-xs text-muted-foreground shrink-0">mmHg</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input type="number" placeholder="Pulse" value={vitalsForm.heartRate} onChange={(e) => setVitalsForm((p) => ({ ...p, heartRate: e.target.value }))} className="h-10 text-sm w-full" />
                        <span className="text-xs text-muted-foreground shrink-0">bpm</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input type="number" step="0.1" placeholder="Temp" value={vitalsForm.temperature} onChange={(e) => setVitalsForm((p) => ({ ...p, temperature: e.target.value }))} className="h-10 text-sm w-full" />
                        <span className="text-xs text-muted-foreground shrink-0">°C</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input type="number" placeholder="Resp Rate" value={vitalsForm.respiratoryRate} onChange={(e) => setVitalsForm((p) => ({ ...p, respiratoryRate: e.target.value }))} className="h-10 text-sm w-full" />
                        <span className="text-xs text-muted-foreground shrink-0">br/min</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input type="number" placeholder="SpO2" value={vitalsForm.oxygenSaturation} onChange={(e) => setVitalsForm((p) => ({ ...p, oxygenSaturation: e.target.value }))} className="h-10 text-sm w-full" />
                        <span className="text-xs text-muted-foreground shrink-0">%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input type="number" step="0.1" placeholder="Height" value={vitalsForm.heightCm} onChange={(e) => setVitalsForm((p) => ({ ...p, heightCm: e.target.value }))} className="h-10 text-sm w-full" />
                        <span className="text-xs text-muted-foreground shrink-0">cm</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input type="number" step="0.1" placeholder="Weight" value={vitalsForm.weightKg} onChange={(e) => setVitalsForm((p) => ({ ...p, weightKg: e.target.value }))} className="h-10 text-sm w-full" />
                        <span className="text-xs text-muted-foreground shrink-0">kg</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input type="text" readOnly disabled placeholder="BMI" value={liveBmi ?? ""} className="h-10 text-sm w-full" />
                        <span className="text-xs text-muted-foreground shrink-0">kg/m²</span>
                      </div>
                      <select
                        value={vitalsForm.consciousnessLevel}
                        onChange={(e) => setVitalsForm((p) => ({ ...p, consciousnessLevel: e.target.value }))}
                        className="h-10 text-sm w-full"
                        title="Consciousness (AVPU)"
                      >
                        <option value="Alert">Alert</option>
                        <option value="Voice">Voice</option>
                        <option value="Pain">Pain</option>
                        <option value="Unresponsive">Unresponsive</option>
                      </select>
                      <label className="flex items-center gap-2 h-10 text-sm px-2 rounded-lg border border-border">
                        <input
                          type="checkbox"
                          checked={vitalsForm.supplementalOxygen}
                          onChange={(e) => setVitalsForm((p) => ({ ...p, supplementalOxygen: e.target.checked }))}
                        />
                        On oxygen
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input type="text" readOnly disabled placeholder="EWS" value={liveEws ?? ""} className="h-10 text-sm w-full font-semibold" />
                        <span className="text-xs text-muted-foreground shrink-0">EWS</span>
                      </div>
                    </div>
                    <textarea placeholder="Notes..." value={vitalsForm.notes} onChange={(e) => setVitalsForm((p) => ({ ...p, notes: e.target.value }))} className="w-full min-h-14 text-sm" />
                    <button onClick={saveVitals} disabled={savingVitals} className="self-start flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                      <Save size={15} /> Save Vitals
                    </button>
                  </>
                )}

                {chart && chart.vitals.length > 0 && (
                  <div className="border-t border-border pt-3 flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                        <button
                          onClick={() => setVitalsView("table")}
                          className={`px-3 py-1.5 font-semibold ${vitalsView === "table" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-muted"}`}
                        >
                          Table
                        </button>
                        <button
                          onClick={() => setVitalsView("trend")}
                          className={`px-3 py-1.5 font-semibold ${vitalsView === "trend" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-muted"}`}
                        >
                          Trend
                        </button>
                      </div>
                      {vitalsView === "trend" && (
                        <select
                          value={trendMetric}
                          onChange={(e) => setTrendMetric(e.target.value as typeof trendMetric)}
                          className="h-8 text-xs"
                        >
                          {Object.entries(TREND_METRICS).map(([key, m]) => (
                            <option key={key} value={key}>{m.label}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {vitalsView === "table" ? (
                      <div className="overflow-x-auto">
                        <table>
                          <thead>
                            <tr>
                              <th>Recorded</th><th>BP</th><th>HR</th><th>Temp</th><th>SpO2</th><th>Ht/Wt</th><th>BMI</th><th>EWS</th><th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {chart.vitals.slice(0, 5).map((v) => (
                              <tr key={v.vitalsRecordId}>
                                <td className="text-xs">{formatDateTime(v.recordedAt)}</td>
                                <td>{v.systolic}/{v.diastolic} mmHg</td>
                                <td>{v.heartRate} bpm</td>
                                <td>{v.temperature}°C</td>
                                <td>{v.oxygenSaturation}%</td>
                                <td className="text-xs">{v.heightCm ? `${v.heightCm}cm` : "—"} / {v.weightKg ? `${v.weightKg}kg` : "—"}</td>
                                <td>{v.bmi ? v.bmi.toFixed(1) : "—"}</td>
                                <td>
                                  <span className={`rounded-full text-xs px-2 py-0.5 font-semibold ${EWS_BAND_STYLES[v.ewsBand]}`}>
                                    {v.ewsScore}
                                  </span>
                                </td>
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
                    ) : (
                      <TrendChart
                        color={TREND_METRICS[trendMetric].color}
                        formatValue={(v) => `${v}${TREND_METRICS[trendMetric].unit}`}
                        data={[...chart.vitals].reverse().map((v) => ({
                          label: new Date(v.recordedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
                          fullLabel: formatDateTime(v.recordedAt),
                          value: v[trendMetric],
                        }))}
                      />
                    )}
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
                {canEdit && (
                  <>
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
                  </>
                )}

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
                {canEdit && (
                  <>
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
                  </>
                )}

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
                {canEdit && (
                  <>
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
                  </>
                )}

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
                {canEdit && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input type="text" placeholder="Fluid type (e.g. Normal Saline)" value={ivForm.fluidType} onChange={(e) => setIvForm((p) => ({ ...p, fluidType: e.target.value }))} className="h-10 text-sm sm:col-span-1" />
                      <input type="number" placeholder="Volume (ml)" value={ivForm.volume} onChange={(e) => setIvForm((p) => ({ ...p, volume: e.target.value }))} className="h-10 text-sm" />
                      <input type="number" placeholder="Rate (ml/hr)" value={ivForm.rate} onChange={(e) => setIvForm((p) => ({ ...p, rate: e.target.value }))} className="h-10 text-sm" />
                    </div>
                    <textarea placeholder="Notes..." value={ivForm.notes} onChange={(e) => setIvForm((p) => ({ ...p, notes: e.target.value }))} className="w-full min-h-14 text-sm" />
                    <button onClick={saveIVFluids} disabled={savingIv} className="self-start flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                      <Save size={15} /> Save Entry
                    </button>
                  </>
                )}

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

            {canEdit && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Allergies — write-only here; already shown as chips in the header card above */}
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

                {/* Special Remarks — write-only here; already shown as chips in the header card above */}
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
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Nurse Notes */}
              <div className="card p-6 flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <FileText size={18} className="text-primary" /> Nurse Notes
                </h2>
                {canEdit && (
                  <>
                    <RichTextEditor value={nurseNoteHtml} onChange={setNurseNoteHtml} placeholder="Structured note with formatting..." />
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={nurseNoteConfidential} onChange={(e) => setNurseNoteConfidential(e.target.checked)} />
                      <Lock size={13} className="text-muted-foreground" /> Mark as confidential (visible only to me)
                    </label>
                    <button onClick={saveNurseNote} disabled={savingNurseNote} className="self-start flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                      <Save size={15} /> {nurseNoteConfidential ? "Save Confidentially" : "Save Note"}
                    </button>
                  </>
                )}

                {chart && chart.nurseNotes.length > 0 && (
                  <div className="flex flex-col gap-1.5 border-t border-border pt-3 max-h-40 overflow-y-auto">
                    {chart.nurseNotes.slice(0, 5).map((n) => (
                      <div key={n.nurseNoteId} className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm">
                        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: n.contentHtml }} />
                        <span className="text-xs text-muted-foreground">{n.nurseName || "Nurse"} · {formatDateTime(n.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Examination Notes */}
              <div className="card p-6 flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Stethoscope size={18} className="text-primary" /> Examination Notes
                </h2>
                {canEdit && (
                  <>
                    <input type="text" placeholder="General appearance" value={examForm.generalAppearance} onChange={(e) => setExamForm((p) => ({ ...p, generalAppearance: e.target.value }))} className="h-10 text-sm" />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-1.5">
                        <input type="number" min={0} max={10} placeholder="Pain level" value={examForm.painLevel} onChange={(e) => setExamForm((p) => ({ ...p, painLevel: e.target.value }))} className="h-10 text-sm w-full" />
                        <span className="text-xs text-muted-foreground shrink-0">/10</span>
                      </div>
                      <input type="text" placeholder="Mobility" value={examForm.mobility} onChange={(e) => setExamForm((p) => ({ ...p, mobility: e.target.value }))} className="h-10 text-sm" />
                    </div>
                    <textarea placeholder="Other clinical checks..." value={examForm.clinicalChecks} onChange={(e) => setExamForm((p) => ({ ...p, clinicalChecks: e.target.value }))} className="w-full min-h-14 text-sm" />
                    <button onClick={saveExaminationNote} disabled={savingExam} className="self-start flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                      <Save size={15} /> Save Examination
                    </button>
                  </>
                )}

                {chart && chart.examinationNotes.length > 0 && (
                  <div className="border-t border-border pt-3 flex flex-col gap-3">
                    <div className="flex rounded-lg border border-border overflow-hidden text-xs w-fit">
                      <button
                        onClick={() => setPainView("table")}
                        className={`px-3 py-1.5 font-semibold ${painView === "table" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-muted"}`}
                      >
                        Table
                      </button>
                      <button
                        onClick={() => setPainView("trend")}
                        className={`px-3 py-1.5 font-semibold ${painView === "trend" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-muted"}`}
                      >
                        Trend
                      </button>
                    </div>

                    {painView === "table" ? (
                      <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
                        {chart.examinationNotes.slice(0, 5).map((e) => (
                          <div key={e.examinationNoteId} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm">
                            <span className="font-medium">{e.generalAppearance || "—"} · Pain {e.painLevel}/10</span>
                            <span className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <TrendChart
                        color="#dc2626"
                        formatValue={(v) => `${v}/10`}
                        data={[...chart.examinationNotes].reverse().map((e) => ({
                          label: new Date(e.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
                          fullLabel: formatDateTime(e.createdAt),
                          value: e.painLevel,
                        }))}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Treatments ordered by the doctor — nurse may only mark them Done */}
              <div className="card p-6 flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <ClipboardCheck size={18} className="text-primary" /> Doctor&apos;s Treatments
                </h2>
                {chart && chart.treatments.length > 0 ? (
                  <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
                    {chart.treatments.map((t) => (
                      <div key={t.treatmentId} className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-foreground">{t.description}</p>
                            {t.instructions && <p className="text-xs text-muted-foreground">{t.instructions}</p>}
                          </div>
                          {t.status === "Pending" ? (
                            canEdit ? (
                              <button
                                onClick={() => markTreatmentDone(t.treatmentId)}
                                disabled={markingTreatmentId === t.treatmentId}
                                className="shrink-0 flex items-center gap-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-1 px-2 rounded-lg text-xs transition-colors"
                              >
                                <CheckCircle2 size={13} /> Mark Done
                              </button>
                            ) : (
                              <span className="shrink-0 rounded-full bg-amber-100 text-amber-700 text-xs px-2 py-0.5 font-semibold">Pending</span>
                            )
                          ) : (
                            <span className="shrink-0 rounded-full bg-green-100 text-green-700 text-xs px-2 py-0.5 font-semibold">Done</span>
                          )}
                        </div>
                        {t.status === "Done" && (
                          <p className="text-xs text-muted-foreground mt-1">
                            by {t.doneByName || "nurse"} · {formatDateTime(t.doneAt)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No treatments ordered.</p>
                )}
              </div>

              {/* Prescribed Medications — administer only, nurse cannot add/modify prescriptions */}
              <div className="card p-6 flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Pill size={18} className="text-primary" /> Prescribed Medications
                </h2>
                {summary.currentMedications.length > 0 ? (
                  <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                    {summary.currentMedications.map((m) => (
                      <div key={m.medicationId} className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-foreground flex items-center gap-1.5">
                              {m.drugName}
                              {m.isHighRisk && (
                                <span className="flex items-center gap-0.5 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                                  <ShieldAlert size={10} /> High-risk
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">{m.dosage} {m.frequency}</p>
                          </div>
                          {canEdit && (
                            <button
                              onClick={() => setAdministeringMedicationId(administeringMedicationId === m.medicationId ? null : m.medicationId)}
                              className="shrink-0 flex items-center gap-1 bg-primary/10 hover:bg-primary/20 text-primary font-semibold py-1 px-2 rounded-lg text-xs transition-colors"
                            >
                              <Syringe size={13} /> Administer
                            </button>
                          )}
                        </div>

                        {canEdit && administeringMedicationId === m.medicationId && (
                          <div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
                            <div className="grid grid-cols-2 gap-2">
                              <input type="text" placeholder="Dose given" value={administerForm.doseGiven} onChange={(ev) => setAdministerForm((p) => ({ ...p, doseGiven: ev.target.value }))} className="h-9 text-sm" />
                              <select value={administerForm.route} onChange={(ev) => setAdministerForm((p) => ({ ...p, route: ev.target.value }))} className="h-9 text-sm">
                                <option>Oral (PO)</option>
                                <option>Intravenous (IV)</option>
                                <option>Intramuscular (IM)</option>
                                <option>Subcutaneous (SC)</option>
                                <option>Topical</option>
                              </select>
                            </div>
                            <input type="text" placeholder="Remarks (optional)" value={administerForm.remarks} onChange={(ev) => setAdministerForm((p) => ({ ...p, remarks: ev.target.value }))} className="h-9 text-sm" />

                            {m.isHighRisk && (
                              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 flex flex-col gap-2">
                                <p className="text-xs font-semibold text-destructive flex items-center gap-1">
                                  <ShieldAlert size={12} /> High-risk medication — a second nurse must witness this
                                </p>
                                <select
                                  value={administerForm.witnessUserId}
                                  onChange={(ev) => setAdministerForm((p) => ({ ...p, witnessUserId: ev.target.value }))}
                                  className="h-9 text-sm"
                                >
                                  <option value="">Select witnessing nurse</option>
                                  {nurses.filter((n) => n.id !== currentUserId).map((n) => (
                                    <option key={n.id} value={n.id}>{n.name}</option>
                                  ))}
                                </select>
                                <input
                                  type="password"
                                  placeholder="Witness's password"
                                  value={administerForm.witnessPassword}
                                  onChange={(ev) => setAdministerForm((p) => ({ ...p, witnessPassword: ev.target.value }))}
                                  className="h-9 text-sm"
                                />
                              </div>
                            )}

                            <button
                              onClick={() => administerMedication(m.medicationId, m.isHighRisk)}
                              disabled={savingAdministration}
                              className="self-start flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                            >
                              <Save size={13} /> Confirm Administration
                            </button>
                          </div>
                        )}

                        {m.administrations.length > 0 && (
                          <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
                            {m.administrations.slice(0, 3).map((a) => (
                              <div key={a.medicationAdministrationId} className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{a.doseGiven} · {a.route} {a.remarks ? `· ${a.remarks}` : ""}</span>
                                <span>{a.nurseName || "Nurse"} · {formatDateTime(a.administeredAt)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No active prescriptions.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== WORKBENCH ====================
  return (
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
            <HeartPulse className="text-primary" /> Nurse Workbench
          </h1>
          <p className="text-sm text-muted-foreground">
            Every patient across all doctors is visible here — open a chart to record vitals and care.
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <select
              value={selectedNurseId}
              onChange={(e) => setSelectedNurseId(e.target.value)}
              title="Nurse identity for recording vitals, injections, dressings, etc."
              className="h-9 w-48 shrink-0 text-sm"
            >
              <option value="">Acting nurse…</option>
              {nurses.map((n) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
            <select
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              title="Doctor to attribute allergy records to"
              className="h-9 w-48 shrink-0 text-sm"
            >
              <option value="">Acting doctor (for allergies)…</option>
              {assignedDoctors.map((d) => (
                <option key={String(d.doctorId)} value={String(d.doctorId)}>{d.userName}</option>
              ))}
            </select>
          </div>
        )}
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <ClipboardList size={18} className="text-primary" /> Work Queue
                </h2>
                {onDutyNurses.length > 0 && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground" title={onDutyNurses.map((n) => n.nurseName).join(", ")}>
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    {onDutyNurses.length} on duty
                  </span>
                )}
              </div>
              {/* Unifies NursingTask (self-charting), Treatment (doctor-ordered), Lab/
                  Radiology sample collection, and active Medications into one queue — see
                  NursingController.GetWorkQueue. Only Task rows carry the Start/Complete
                  status actions below; the other item types are just click-through to the
                  patient's chart, since they're driven by their own dedicated workflows. */}
              <div className="flex flex-col gap-3 max-h-[28rem] overflow-y-auto">
                {workQueue.length > 0 ? (
                  workQueue.map((item) => (
                    <div
                      key={`${item.itemType}-${item.sourceId}`}
                      className="rounded-lg border border-border bg-muted/30 px-3 py-2 cursor-pointer hover:bg-muted/50"
                      onClick={() => item.patientId && openPatient(item.patientId)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm text-foreground">{item.description}</p>
                          <p className="text-xs text-muted-foreground">{item.patientName || "Unknown patient"}</p>
                        </div>
                        <span className="rounded-full bg-amber-100 text-amber-700 text-xs px-2 py-0.5 font-semibold shrink-0">
                          {item.priority && item.priority !== "Normal" && item.priority !== "Routine" ? item.priority : item.itemType}
                        </span>
                      </div>
                      {canEdit && item.itemType === "Task" && (
                        <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => updateTaskStatus(item.sourceId, "InProgress")}
                            className="flex-1 flex items-center justify-center gap-1 bg-primary/10 hover:bg-primary/20 text-primary font-semibold py-1.5 rounded-lg text-xs transition-colors"
                          >
                            <PlayCircle size={13} /> Start
                          </button>
                          <button
                            onClick={() => updateTaskStatus(item.sourceId, "Completed")}
                            className="flex-1 flex items-center justify-center gap-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-1.5 rounded-lg text-xs transition-colors"
                          >
                            <CheckCircle2 size={13} /> Complete
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No pending work. Great job!</p>
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
