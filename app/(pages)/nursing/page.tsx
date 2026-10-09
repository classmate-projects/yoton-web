"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import EmptyState from "@/components/EmptyState";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Ban,
  Bandage,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Download,
  Droplets,
  FileText,
  Flag,
  FlaskConical,
  HeartPulse,
  Lock,
  LogOut,
  Pencil,
  Pill,
  PlayCircle,
  Save,
  Search,
  Settings,
  ShieldAlert,
  Stethoscope,
  Syringe,
  Thermometer,
  Trash2,
  Undo2,
  Upload,
  Users,
  X,
} from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { notifySaveStatus } from "@/lib/saveStatus";
import PasswordInput from "@/components/PasswordInput";
import RichTextEditor from "@/components/RichTextEditor";
import ToggleButton from "@/components/ToggleButton";
import DatePicker from "@/components/DatePicker";
import SearchableSelect, { standaloneSelectClass } from "@/components/SearchableSelect";
import CorrectedFromNote from "@/components/CorrectedFromNote";
import FamilyHistorySection from "@/components/FamilyHistorySection";
import PatientMedicalFormsSection from "@/components/medicalForms/PatientMedicalFormsSection";
import OrderedItemsList from "@/components/orders/OrderedItemsList";
import TreatmentConfigModal from "@/components/orders/TreatmentConfigModal";
import LabRadiologyConfigModal from "@/components/orders/LabRadiologyConfigModal";
import { confirmDeleteToast } from "@/lib/confirmDeleteToast";
import { EmrService } from "@/services/emr.service";
import { backendAssetUrl } from "@/lib/backendAsset";
import { NursingService } from "@/services/nursing.service";
import { TreatmentService } from "@/services/treatment.service";
import { UserService } from "@/services/user.service";
import { UserType } from "@/types/user.type";
import { AssignedDoctorsInfo } from "@/types/assignedDoctors.type";
import { AllergyPayload, AllergyType, EmrPatientListItem, PatientSummaryType, SpecialRemarkType } from "@/types/emr.type";
import { TreatmentType } from "@/types/treatment.type";
import { LabRequestType } from "@/types/lab.type";
import { RadiologyRequestType } from "@/types/radiology.type";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  NurseDashboardSummaryType,
  NursingChartType,
  WorkQueueItemType,
  NurseOnDutyType,
  UntouchedPatientType,
  TriageVitalField,
  TriagePayload,
  VitalsType,
  InjectionType,
  DressingType,
  BloodSugarType,
  IVFluidsType,
  NurseNoteType,
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

const isSameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// "Last Visit" reads better as Today/Yesterday than a repeated date the nurse already knows
// they're looking at "today" for - anything older just falls back to the plain date.
const formatVisitDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  const today = new Date();
  if (isSameLocalDay(date, today)) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameLocalDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString();
};

// How long a patient has been waiting untouched, for the grid cards below.
const formatWaitingSince = (checkedInAt: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(checkedInAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
};

// <input type="datetime-local"> needs "YYYY-MM-DDTHH:mm" in local time, not an ISO string.
const toDateTimeLocalValue = (value: string | null | undefined) => {
  const date = value ? new Date(value) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

type TriageFieldType = "number" | "date";

interface TriageFieldConfig {
  key: TriageVitalField;
  label: string;
  unit?: string;
  type: TriageFieldType;
  step?: string;
}

// Rendered generically (see renderTriageVitalRow below) rather than one hand-written JSX
// block per field - keeps the ~15 fields from Triage/SaveTriageRequest and this form in sync
// by construction instead of by careful copy-pasting.
const TRIAGE_VITAL_FIELDS: TriageFieldConfig[] = [
  { key: "Height", label: "Height", unit: "cm", type: "number" },
  { key: "Weight", label: "Weight", unit: "kg", type: "number" },
  { key: "Temperature", label: "Temperature", unit: "deg C", type: "number", step: "0.1" },
  { key: "HeartRate", label: "Heart rate", unit: "BPM", type: "number" },
  { key: "BPSystolic", label: "B.P (Systolic)", unit: "mmHg", type: "number" },
  { key: "BPDiastolic", label: "B.P (Diastolic)", unit: "mmHg", type: "number" },
  { key: "BPMean", label: "B.P (M)", unit: "mmHg", type: "number" },
  { key: "Chest", label: "Chest", unit: "cm", type: "number" },
  { key: "Waist", label: "Waist", unit: "cm", type: "number" },
  { key: "Respiratory", label: "Respiratory", unit: "bpm", type: "number" },
  { key: "OxygenSaturation", label: "O2 Saturation", unit: "%", type: "number" },
  { key: "BloodSugar", label: "Blood Sugar", unit: "mmol/L", type: "number", step: "0.1" },
  { key: "Hip", label: "Hip", unit: "cm", type: "number" },
];

const TRIAGE_OBSTETRIC_FIELDS: TriageFieldConfig[] = [
  { key: "Edd", label: "EDD", type: "date" },
  { key: "Para", label: "Para", type: "number" },
  { key: "Gravida", label: "Gravida", type: "number" },
  { key: "Lmp", label: "LMP", type: "date" },
];

// Idle state uses the app's usual light-tint-badge idiom (bg-X-50 dark:bg-X-950/30 + matching
// border/text) rather than a full-saturation fill - the saturated color is reserved for
// whichever level is actually selected, so the row reads as "one clear choice" instead of a
// wall of five equally loud colors.
const TRIAGE_PRIORITY_LEVELS = [
  {
    level: 1, label: "Level I", name: "Resuscitation", eta: "Immediate",
    idle: "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400",
    active: "border-red-600 bg-red-600 text-white shadow-md shadow-red-600/30",
  },
  {
    level: 2, label: "Level II", name: "UCC", eta: "15 min",
    idle: "border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400",
    active: "border-orange-500 bg-orange-500 text-white shadow-md shadow-orange-500/30",
  },
  {
    level: 3, label: "Level III", name: "Urgent", eta: "30 min",
    idle: "border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400",
    active: "border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/30",
  },
  {
    level: 4, label: "Level IV", name: "Less Urgent", eta: "60 min",
    idle: "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400",
    active: "border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/30",
  },
  {
    level: 5, label: "Level V", name: "Non Urgent", eta: "120 min",
    idle: "border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400",
    active: "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/30",
  },
] as const;

const TRIAGE_SYMPTOM_ROWS = [
  { key: "burnOrTrauma", label: "Does the patient present Burn or Trauma symptoms?" },
  { key: "cardiacRespiratoryDigestive", label: "Is the patient experiencing Cardiac Respiratory & Digestive symptoms?" },
  { key: "otherEmergencySymptoms", label: "Any Other emergency symptoms?" },
] as const;

interface TriageFormState {
  priorityLevel: number | null;
  burnOrTrauma: string;
  burnOrTraumaDetail: string;
  cardiacRespiratoryDigestive: string;
  cardiacRespiratoryDigestiveDetail: string;
  otherEmergencySymptoms: string;
  otherEmergencySymptomsDetail: string;
  tempSite: string;
  patientRefused: boolean;
  actionDateTime: string;
  values: Record<TriageVitalField, string>;
}

const emptyTriageValues = (): Record<TriageVitalField, string> => ({
  Height: "",
  Weight: "",
  Temperature: "",
  HeartRate: "",
  BPSystolic: "",
  BPDiastolic: "",
  BPMean: "",
  Chest: "",
  Waist: "",
  Respiratory: "",
  OxygenSaturation: "",
  BloodSugar: "",
  Hip: "",
  Edd: "",
  Para: "",
  Gravida: "",
  Lmp: "",
});

const emptyTriageForm = (): TriageFormState => ({
  priorityLevel: null,
  burnOrTrauma: "",
  burnOrTraumaDetail: "",
  cardiacRespiratoryDigestive: "",
  cardiacRespiratoryDigestiveDetail: "",
  otherEmergencySymptoms: "",
  otherEmergencySymptomsDetail: "",
  tempSite: "",
  patientRefused: false,
  actionDateTime: toDateTimeLocalValue(null),
  values: emptyTriageValues(),
});

function NurseWorkbenchInner() {
  const router = useRouter();
  const pathname = usePathname();
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
  // Checked-in visits no nurse has opened yet (Visit.Status still "CheckedIn") - see
  // NursingController.GetUntouchedPatients. Fetched in the same fetchWorkbench bundle below
  // so it rides that same SignalR-triggered live refresh for free.
  const [untouchedPatients, setUntouchedPatients] = useState<UntouchedPatientType[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  // Filters Patient Monitoring to patients whose last visit falls on this exact date -
  // "YYYY-MM-DD" from a plain <input type="date">, so the nurse can jump to a specific past
  // or future day instead of only ever seeing everyone's most recent visit.
  const [dateFilter, setDateFilter] = useState("");
  const [isLoadingWorkbench, setIsLoadingWorkbench] = useState(true);

  const PAGE_SIZE = 10;
  const [untouchedPage, setUntouchedPage] = useState(0);
  const [monitoringPage, setMonitoringPage] = useState(0);
  const [workQueuePage, setWorkQueuePage] = useState(0);

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [summary, setSummary] = useState<PatientSummaryType | null>(null);
  const [chart, setChart] = useState<NursingChartType | null>(null);
  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [isEndingEncounter, setIsEndingEncounter] = useState(false);

  // ---------------- DOCUMENTS ----------------
  type DocumentItem = { patientDocumentId: string; documentType: string; filePath: string | null; viewedByNurse: boolean; createdAt: string };
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [unviewedDocumentCount, setUnviewedDocumentCount] = useState(0);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [uploadDocFile, setUploadDocFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState("Report");
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // ---------------- TRIAGE FORM ----------------
  const [triageForm, setTriageForm] = useState<TriageFormState>(emptyTriageForm());
  // Which vitals are toggled "patient refused" - key present (even with an empty-string
  // reason, before the nurse fills it in) means refused; absence means recorded normally.
  const [triageRefusals, setTriageRefusals] = useState<Partial<Record<TriageVitalField, string>>>({});
  const [savingTriage, setSavingTriage] = useState(false);
  // Collapsed by default - triage is a one-time intake assessment, not something a nurse
  // reopens on every visit to this patient's chart the way vitals/tasks are, so it shouldn't
  // eat the top of the screen unless a nurse actually clicks in to use or review it.
  const [showTriageModal, setShowTriageModal] = useState(false);

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
      const [dashboardRes, workQueueRes, onDutyRes, patientsRes, untouchedRes] = await Promise.all([
        NursingService.getDashboardSummary(),
        NursingService.getWorkQueue(),
        NursingService.getOnDutyNow(),
        EmrService.getPatients(),
        NursingService.getUntouchedPatients(),
      ]);
      setDashboard(dashboardRes.data || null);
      setWorkQueue(workQueueRes.data || []);
      setOnDutyNurses(onDutyRes.data || []);
      setPatients(patientsRes.data || []);
      setUntouchedPatients(untouchedRes.data || []);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load workbench data"));
    } finally {
      setIsLoadingWorkbench(false);
    }
  };

  // Re-fetch the patient list when the nurse changes the date filter — the backend scopes
  // results to that calendar day so past patients (Completed visits) become visible.
  // Skipped on the very first mount (dateFilterChanged.current stays false until the nurse
  // actually touches the picker) so fetchWorkbench's initial load is not duplicated.
  const [isLoadingPatientsByDate, setIsLoadingPatientsByDate] = useState(false);
  const dateFilterChanged = useRef(false);
  useEffect(() => {
    if (!checkedAuth) return;
    if (!dateFilterChanged.current) { dateFilterChanged.current = true; return; }
    setIsLoadingPatientsByDate(true);
    EmrService.getPatients(undefined, dateFilter || undefined)
      .then((res) => setPatients(res.data || []))
      .catch(() => toast.error("Failed to load patients for the selected date"))
      .finally(() => setIsLoadingPatientsByDate(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, checkedAuth]);

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
  const [currentVisitId, setCurrentVisitId] = useState<string | null>(null);

  // visitId is normally implied by the page's own URL (?visitId=, arriving from Reception's
  // visit queue) - but a click from the Untouched Patients grid below knows its own visit
  // directly, so it needs to be able to pass it through explicitly instead. That's what
  // actually advances Visit.Status CheckedIn -> WithNurse (see EnsureActiveEncounter), which
  // is what makes that patient drop off the grid.
  const fetchDocuments = async (patientId: string) => {
    try {
      const res = await EmrService.getDocuments(patientId);
      setDocuments(res.data?.items || []);
      setUnviewedDocumentCount(res.data?.unviewedCount || 0);
    } catch {
      setDocuments([]);
      setUnviewedDocumentCount(0);
    }
  };

  const markDocumentViewed = async (id: string) => {
    if (!selectedPatientId) return;
    try {
      await EmrService.markDocumentViewed(selectedPatientId, id);
      await fetchDocuments(selectedPatientId);
    } catch {
      // silently ignore
    }
  };

  // Only these render natively in-browser (an <img> / a PDF <iframe>) - everything else
  // (xlsx, docx, csv, zip, ...) has no in-browser preview, so clicking it just downloads
  // the file instead of showing a blank/broken preview pane.
  const PREVIEWABLE_IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp"];
  const PREVIEWABLE_EXTS = [...PREVIEWABLE_IMAGE_EXTS, "pdf"];

  const downloadDocument = (fileUrl: string, fileName: string) => {
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const openDocument = (d: DocumentItem, fileUrl: string, ext: string) => {
    if (!d.viewedByNurse) markDocumentViewed(d.patientDocumentId);
    if (PREVIEWABLE_EXTS.includes(ext)) {
      window.open(fileUrl, "_blank", "noopener,noreferrer");
      return;
    }
    downloadDocument(fileUrl, d.documentType);
    toast(`Preview isn't available for ${ext ? `.${ext}` : "this"} files — downloading it instead.`, { icon: "ℹ️" });
  };

  const handleUploadDocument = async () => {
    if (!selectedPatientId || !uploadDocFile) return;
    setIsUploadingDoc(true);
    try {
      await EmrService.uploadDocument(selectedPatientId, {
        documentType: uploadDocType,
        file: uploadDocFile,
        visitId: currentVisitId ?? undefined,
      });
      toast.success("Document uploaded");
      setUploadDocFile(null);
      setUploadDocType("Report");
      await fetchDocuments(selectedPatientId);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to upload document"));
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const openPatient = async (patientId: string, visitId?: string) => {
    if (patientId !== patientIdParam) {
      const params = new URLSearchParams();
      params.set("patientId", patientId);
      if (visitId ?? visitIdParam) params.set("visitId", (visitId ?? visitIdParam)!);
      router.push(`${pathname}?${params.toString()}`);
    }
    const resolvedVisitId = visitId ?? visitIdParam;
    setSelectedPatientId(patientId);
    setCurrentVisitId(resolvedVisitId ?? null);
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
              visitId: resolvedVisitId,
              nurseId: isAdmin ? selectedNurseId : undefined,
            })
          : Promise.resolve({ data: null }),
      ]);
      setSummary(summaryRes.data);
      setChart(chartRes.data);
      setEncounterId(encounterRes.data?.patientEncounterId || null);
      // The backend can now resolve/attach the patient's own active visit itself (see
      // EnsureActiveEncounter) even when this open didn't already know which one to use -
      // always trust whatever it actually ended up using, not just what was passed in above.
      if (encounterRes.data?.visitId) {
        setCurrentVisitId(encounterRes.data.visitId);
      }
      if (!canStartEncounter) {
        toast("Select a nurse to start recording for this patient.", { icon: "ℹ️" });
      }
      fetchDocuments(patientId);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load patient chart"));
    } finally {
      setIsLoadingChart(false);
    }
  };

  // Arriving from the reception visit queue (?patientId=&visitId=) opens that patient's
  // chart directly instead of landing on the workbench list.
  useEffect(() => {
    if (!checkedAuth) return;
    if (patientIdParam) {
      openPatient(patientIdParam);
    } else if (selectedPatientId) {
      // URL params cleared by browser back button — return to workbench.
      setSelectedPatientId(null);
      setSummary(null);
      setChart(null);
      setEncounterId(null);
      setCurrentVisitId(null);
      setDateFilter("");
      fetchWorkbench();
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
    setCurrentVisitId(null);
    setDateFilter("");
    fetchWorkbench();
    if (patientIdParam) router.push(pathname);
  };

  // Prefills from the active encounter's saved triage (if any) whenever a different patient/
  // encounter is opened - keyed on encounterId rather than chart.triage itself so an
  // unrelated refreshChart() elsewhere (after saving vitals, a note, etc.) can't clobber
  // whatever the nurse is still mid-typing into this form.
  useEffect(() => {
    if (!encounterId) {
      setTriageForm(emptyTriageForm());
      setTriageRefusals({});
      return;
    }
    const t = chart?.triage;
    if (!t) {
      setTriageForm(emptyTriageForm());
      setTriageRefusals({});
      return;
    }
    setTriageForm({
      priorityLevel: t.priorityLevel,
      burnOrTrauma: t.burnOrTrauma ?? "",
      burnOrTraumaDetail: t.burnOrTraumaDetail ?? "",
      cardiacRespiratoryDigestive: t.cardiacRespiratoryDigestive ?? "",
      cardiacRespiratoryDigestiveDetail: t.cardiacRespiratoryDigestiveDetail ?? "",
      otherEmergencySymptoms: t.otherEmergencySymptoms ?? "",
      otherEmergencySymptomsDetail: t.otherEmergencySymptomsDetail ?? "",
      tempSite: t.tempSite ?? "",
      patientRefused: t.patientRefused,
      actionDateTime: toDateTimeLocalValue(t.actionDateTime),
      values: {
        Height: t.heightCm?.toString() ?? "",
        Weight: t.weightKg?.toString() ?? "",
        Temperature: t.temperature?.toString() ?? "",
        HeartRate: t.heartRate?.toString() ?? "",
        BPSystolic: t.bpSystolic?.toString() ?? "",
        BPDiastolic: t.bpDiastolic?.toString() ?? "",
        BPMean: t.bpMean?.toString() ?? "",
        Chest: t.chest?.toString() ?? "",
        Waist: t.waist?.toString() ?? "",
        Respiratory: t.respiratory?.toString() ?? "",
        OxygenSaturation: t.oxygenSaturation?.toString() ?? "",
        BloodSugar: t.bloodSugar?.toString() ?? "",
        Hip: t.hip?.toString() ?? "",
        Edd: t.edd ?? "",
        Para: t.para?.toString() ?? "",
        Gravida: t.gravida?.toString() ?? "",
        Lmp: t.lmp ?? "",
      },
    });
    setTriageRefusals(Object.fromEntries(t.refusals.map((r) => [r.vitalField, r.reason])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterId]);

  const toggleTriageVitalRefusal = (field: TriageVitalField) => {
    setTriageRefusals((prev) => {
      if (field in prev) {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return { ...prev, [field]: "" };
    });
  };

  const handleSaveTriage = async () => {
    if (!encounterId) return;
    if (!requireNurseSelected()) return;
    notifySaveStatus("saving");

    const missingReason = Object.entries(triageRefusals).find(([, reason]) => !reason?.trim());
    if (missingReason) {
      toast.error("Enter a reason for every refused vital before saving.");
      return;
    }

    const numberOrUndefined = (field: TriageVitalField) => {
      if (field in triageRefusals) return undefined;
      const raw = triageForm.values[field];
      if (!raw || raw.trim() === "") return undefined;
      const n = Number(raw);
      return Number.isNaN(n) ? undefined : n;
    };
    const dateOrUndefined = (field: TriageVitalField) => {
      if (field in triageRefusals) return undefined;
      const raw = triageForm.values[field];
      return raw ? raw : undefined;
    };

    const payload: TriagePayload = {
      encounterId,
      visitId: currentVisitId ?? undefined,
      priorityLevel: triageForm.priorityLevel ?? undefined,
      burnOrTrauma: triageForm.burnOrTrauma || undefined,
      burnOrTraumaDetail: triageForm.burnOrTraumaDetail || undefined,
      cardiacRespiratoryDigestive: triageForm.cardiacRespiratoryDigestive || undefined,
      cardiacRespiratoryDigestiveDetail: triageForm.cardiacRespiratoryDigestiveDetail || undefined,
      otherEmergencySymptoms: triageForm.otherEmergencySymptoms || undefined,
      otherEmergencySymptomsDetail: triageForm.otherEmergencySymptomsDetail || undefined,
      heightCm: numberOrUndefined("Height"),
      weightKg: numberOrUndefined("Weight"),
      temperature: numberOrUndefined("Temperature"),
      tempSite: triageForm.tempSite || undefined,
      heartRate: numberOrUndefined("HeartRate"),
      bpSystolic: numberOrUndefined("BPSystolic"),
      bpDiastolic: numberOrUndefined("BPDiastolic"),
      bpMean: numberOrUndefined("BPMean"),
      chest: numberOrUndefined("Chest"),
      waist: numberOrUndefined("Waist"),
      respiratory: numberOrUndefined("Respiratory"),
      oxygenSaturation: numberOrUndefined("OxygenSaturation"),
      bloodSugar: numberOrUndefined("BloodSugar"),
      hip: numberOrUndefined("Hip"),
      edd: dateOrUndefined("Edd"),
      para: numberOrUndefined("Para"),
      gravida: numberOrUndefined("Gravida"),
      lmp: dateOrUndefined("Lmp"),
      patientRefused: triageForm.patientRefused,
      actionDateTime: triageForm.actionDateTime ? new Date(triageForm.actionDateTime).toISOString() : undefined,
      refusals: Object.entries(triageRefusals).map(([vitalField, reason]) => ({
        vitalField: vitalField as TriageVitalField,
        reason: reason ?? "",
      })),
      nurseId: isAdmin ? selectedNurseId : undefined,
    };

    try {
      setSavingTriage(true);
      await NursingService.saveTriage(selectedPatientId!, payload);
      toast.success("Triage saved");
      notifySaveStatus("saved");
      await refreshChart();
    } catch (error) {
      notifySaveStatus("error");
      toast.error(errorMessage(error, "Failed to save triage"));
    } finally {
      setSavingTriage(false);
    }
  };

  const triageBmi = (() => {
    const h = parseFloat(triageForm.values.Height);
    const w = parseFloat(triageForm.values.Weight);
    if (!h || !w) return null;
    return Math.round((w / Math.pow(h / 100, 2)) * 10) / 10;
  })();

  // One row per "Vital Signs in Triage" field - shared by the vitals and obstetric groups
  // below, since both are the same {label, input, refuse-toggle} shape (see
  // TRIAGE_VITAL_FIELDS/TRIAGE_OBSTETRIC_FIELDS).
  const renderTriageVitalRow = (field: TriageFieldConfig) => {
    const isRefused = field.key in triageRefusals;
    return (
      <div key={field.key} className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            {field.label}
            {field.unit ? ` (${field.unit})` : ""}
          </label>
          <button
            type="button"
            onClick={() => toggleTriageVitalRefusal(field.key)}
            title={isRefused ? "Patient refused this vital — click to undo" : "Mark patient refused"}
            // Out of the tab order on purpose - it sits right before each field's own input
            // in DOM order, so left tabbable it stole focus on the way to every next field
            // instead of just the fields themselves. Still fully clickable with the mouse.
            tabIndex={-1}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors cursor-pointer ${isRefused ? "bg-red-100 text-red-600 dark:bg-red-950/40" : "text-muted-foreground hover:bg-muted"}`}
          >
            <Ban size={16} />
          </button>
        </div>
        {field.type === "date" ? (
          <DatePicker
            value={triageForm.values[field.key]}
            onChange={(v) =>
              setTriageForm((prev) => ({ ...prev, values: { ...prev.values, [field.key]: v } }))
            }
            disabled={isRefused}
            dateFormat="dd-MM-yyyy"
            placeholder="DD-MM-YYYY"
          />
        ) : (
          <input
            type={field.type}
            step={field.step}
            disabled={isRefused}
            value={triageForm.values[field.key]}
            onChange={(e) =>
              setTriageForm((prev) => ({ ...prev, values: { ...prev.values, [field.key]: e.target.value } }))
            }
            className="text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          />
        )}
        {field.key === "Temperature" && !isRefused && (
          <div className="mt-0.5">
            <SearchableSelect
              value={triageForm.tempSite}
              onChange={(v) => setTriageForm((prev) => ({ ...prev, tempSite: v }))}
              options={[
                { value: "", label: "Site…" },
                { value: "Oral", label: "Oral" },
                { value: "Axillary", label: "Axillary" },
                { value: "Tympanic", label: "Tympanic" },
                { value: "Rectal", label: "Rectal" },
              ]}
            />
          </div>
        )}
        {isRefused && (
          <input
            type="text"
            required
            placeholder="Refusal reason (required)"
            value={triageRefusals[field.key] ?? ""}
            onChange={(e) => setTriageRefusals((prev) => ({ ...prev, [field.key]: e.target.value }))}
            className="text-xs border-red-300 focus:border-red-400"
          />
        )}
      </div>
    );
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
    bmiExclusionReason: "",
    notes: "",
  });
  const [savingVitals, setSavingVitals] = useState(false);
  // Set while correcting an existing vitals row (reuses the same form/button as adding a
  // new one, mirroring how Department/Role edit reuses their own create form). A correction
  // never overwrites the original in place - the API soft-deletes it and inserts a fresh,
  // linked row - so this only changes which endpoint saveVitals calls, not what it sends.
  const [editingVitalsId, setEditingVitalsId] = useState<string | null>(null);
  const [vitalsView, setVitalsView] = useState<"table" | "trend">("table");
  // Read-only mirror of the doctor workbench's Medication Tracking tabs - nurses can see
  // current and past medications here but add/correct/discontinue stays doctor-only.
  const [medHistoryTab, setMedHistoryTab] = useState<"current" | "history">("current");
  // Which TREND_METRICS keys are currently plotted - multi-select via checkboxes (see the
  // Trend view below) rather than TrendChart's old one-metric-at-a-time dropdown, each its
  // own colored line on one shared chart. Starts with every metric checked.
  const [visibleTrendMetrics, setVisibleTrendMetrics] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(Object.keys(TREND_METRICS).map((k) => [k, true]))
  );
  const toggleTrendMetric = (key: string) =>
    setVisibleTrendMetrics((prev) => ({ ...prev, [key]: !prev[key] }));

  const liveBmi = (() => {
    const height = Number(vitalsForm.heightCm);
    const weight = Number(vitalsForm.weightKg);
    if (!height || !weight) return null;
    return (weight / Math.pow(height / 100, 2)).toFixed(1);
  })();

  // ---------------- ENCOUNTER LOCK (password re-auth after nurse closes the encounter) ----------------
  // Once EndEncounter has run, the 5 clinical-task write endpoints below (vitals, injection,
  // dressing, blood sugar, IV fluids) respond 423 instead of saving - this catches that,
  // parks the retry, and lets the password-prompt modal replay the exact same save once
  // confirmed, instead of duplicating this handling in every save function.
  const [encounterLock, setEncounterLock] = useState<{ retry: (password: string) => Promise<boolean> } | null>(null);
  const [encounterLockPassword, setEncounterLockPassword] = useState("");
  const [submittingEncounterLock, setSubmittingEncounterLock] = useState(false);

  const handleEncounterLockError = (error: unknown, retry: (password: string) => Promise<boolean>): boolean => {
    if (axios.isAxiosError(error) && error.response?.status === 423) {
      setEncounterLock({ retry });
      return true;
    }
    return false;
  };

  // Only closes the modal once the retried save actually succeeds - a wrong password on
  // retry shows its own toast (from the save function's own catch block) and leaves the
  // modal open so the user can just try again, instead of forcing them to re-trigger the
  // whole save from scratch.
  const confirmEncounterLockPassword = async () => {
    if (!encounterLock || !encounterLockPassword.trim()) return;
    setSubmittingEncounterLock(true);
    try {
      const succeeded = await encounterLock.retry(encounterLockPassword);
      if (succeeded) {
        setEncounterLock(null);
        setEncounterLockPassword("");
      }
    } finally {
      setSubmittingEncounterLock(false);
    }
  };

  const saveVitals = async (passwordOverride?: string): Promise<boolean> => {
    if (!encounterId) return false;
    if (!vitalsForm.systolic || !vitalsForm.diastolic || !vitalsForm.heartRate) {
      toast.error("Blood pressure and heart rate are required");
      return false;
    }
    if (!requireNurseSelected()) return false;
    notifySaveStatus("saving");
    try {
      setSavingVitals(true);
      const payload = {
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
        bmiExclusionReason: vitalsForm.bmiExclusionReason || undefined,
        notes: vitalsForm.notes.trim() || undefined,
        nurseId: isAdmin ? selectedNurseId : undefined,
        password: passwordOverride,
      };
      if (editingVitalsId) {
        await NursingService.updateVitals(editingVitalsId, payload);
        toast.success("Vitals corrected");
      } else {
        await NursingService.saveVitals(payload);
        toast.success("Vitals recorded");
      }
      notifySaveStatus("saved");
      setVitalsForm({ systolic: "", diastolic: "", heartRate: "", temperature: "", respiratoryRate: "", oxygenSaturation: "", heightCm: "", weightKg: "", consciousnessLevel: "Alert", supplementalOxygen: false, bmiExclusionReason: "", notes: "" });
      setEditingVitalsId(null);
      await refreshChart();
      return true;
    } catch (error) {
      if (handleEncounterLockError(error, (pw) => saveVitals(pw))) return false;
      notifySaveStatus("error");
      toast.error(errorMessage(error, "Failed to save vitals"));
      return false;
    } finally {
      setSavingVitals(false);
    }
  };

  const startEditVitals = (v: VitalsType) => {
    setEditingVitalsId(v.vitalsRecordId);
    setVitalsForm({
      systolic: String(v.systolic ?? ""),
      diastolic: String(v.diastolic ?? ""),
      heartRate: String(v.heartRate ?? ""),
      temperature: String(v.temperature ?? ""),
      respiratoryRate: String(v.respiratoryRate ?? ""),
      oxygenSaturation: String(v.oxygenSaturation ?? ""),
      heightCm: v.heightCm ? String(v.heightCm) : "",
      weightKg: v.weightKg ? String(v.weightKg) : "",
      consciousnessLevel: v.consciousnessLevel || "Alert",
      supplementalOxygen: v.supplementalOxygen,
      bmiExclusionReason: v.bmiExclusionReason || "",
      notes: v.notes || "",
    });
  };

  const cancelEditVitals = () => {
    setEditingVitalsId(null);
    setVitalsForm({ systolic: "", diastolic: "", heartRate: "", temperature: "", respiratoryRate: "", oxygenSaturation: "", heightCm: "", weightKg: "", consciousnessLevel: "Alert", supplementalOxygen: false, bmiExclusionReason: "", notes: "" });
  };

  const removeVitalsRecord = async (v: VitalsType, passwordOverride?: string): Promise<boolean> => {
    if (!requireNurseSelected()) return false;
    try {
      await NursingService.removeVitals(v.vitalsRecordId, isAdmin ? selectedNurseId : undefined, passwordOverride);
      toast.success("Vitals record removed");
      await refreshChart();
      return true;
    } catch (error) {
      if (handleEncounterLockError(error, (pw) => removeVitalsRecord(v, pw))) return false;
      toast.error(errorMessage(error, "Failed to remove vitals record"));
      return false;
    }
  };

  const confirmRemoveVitals = (v: VitalsType) => {
    confirmDeleteToast(
      <span>Delete this vitals record?</span>,
      () => removeVitalsRecord(v)
    );
  };

  // ---------------- MEDICATION ADMINISTRATION FORM ----------------
  const [injectionForm, setInjectionForm] = useState({ medicineName: "", dose: "", route: "Oral (PO)", notes: "" });
  const [savingInjection, setSavingInjection] = useState(false);
  const [editingInjectionId, setEditingInjectionId] = useState<string | null>(null);

  const saveInjection = async (passwordOverride?: string): Promise<boolean> => {
    if (!encounterId) return false;
    if (!injectionForm.medicineName.trim() || !injectionForm.dose.trim()) {
      toast.error("Medicine name and dose are required");
      return false;
    }
    if (!requireNurseSelected()) return false;
    notifySaveStatus("saving");
    try {
      setSavingInjection(true);
      const payload = {
        encounterId,
        medicineName: injectionForm.medicineName.trim(),
        dose: injectionForm.dose.trim(),
        route: injectionForm.route,
        notes: injectionForm.notes.trim() || undefined,
        nurseId: isAdmin ? selectedNurseId : undefined,
        password: passwordOverride,
      };
      if (editingInjectionId) {
        await NursingService.updateInjection(editingInjectionId, payload);
        toast.success("Medication administration corrected");
      } else {
        await NursingService.saveInjection(payload);
        toast.success("Medication administration recorded");
      }
      notifySaveStatus("saved");
      setInjectionForm({ medicineName: "", dose: "", route: "Oral (PO)", notes: "" });
      setEditingInjectionId(null);
      await refreshChart();
      return true;
    } catch (error) {
      if (handleEncounterLockError(error, (pw) => saveInjection(pw))) return false;
      notifySaveStatus("error");
      toast.error(errorMessage(error, "Failed to save medication entry"));
      return false;
    } finally {
      setSavingInjection(false);
    }
  };

  const startEditInjection = (i: InjectionType) => {
    setEditingInjectionId(i.injectionRecordId);
    setInjectionForm({ medicineName: i.medicineName, dose: i.dose, route: i.route || "Oral (PO)", notes: i.notes || "" });
  };

  const cancelEditInjection = () => {
    setEditingInjectionId(null);
    setInjectionForm({ medicineName: "", dose: "", route: "Oral (PO)", notes: "" });
  };

  const removeInjectionRecord = async (i: InjectionType, passwordOverride?: string): Promise<boolean> => {
    if (!requireNurseSelected()) return false;
    try {
      await NursingService.removeInjection(i.injectionRecordId, isAdmin ? selectedNurseId : undefined, passwordOverride);
      toast.success("Medication administration record removed");
      await refreshChart();
      return true;
    } catch (error) {
      if (handleEncounterLockError(error, (pw) => removeInjectionRecord(i, pw))) return false;
      toast.error(errorMessage(error, "Failed to remove medication administration record"));
      return false;
    }
  };

  const confirmRemoveInjection = (i: InjectionType) => {
    confirmDeleteToast(<span>Delete this medication administration record?</span>, () => removeInjectionRecord(i));
  };

  // ---------------- WOUND CARE FORM ----------------
  const [dressingForm, setDressingForm] = useState({
    woundType: "",
    dressingMaterial: "",
    infectionSigns: false,
    notes: "",
  });
  const [savingDressing, setSavingDressing] = useState(false);
  const [editingDressingId, setEditingDressingId] = useState<string | null>(null);

  const saveDressing = async (passwordOverride?: string): Promise<boolean> => {
    if (!encounterId) return false;
    if (!dressingForm.woundType || !dressingForm.dressingMaterial) {
      toast.error("Wound type and dressing material are required");
      return false;
    }
    if (!requireNurseSelected()) return false;
    notifySaveStatus("saving");
    try {
      setSavingDressing(true);
      const payload = {
        encounterId,
        woundType: dressingForm.woundType,
        dressingMaterial: dressingForm.dressingMaterial,
        infectionSigns: dressingForm.infectionSigns,
        notes: dressingForm.notes.trim() || undefined,
        nurseId: isAdmin ? selectedNurseId : undefined,
        password: passwordOverride,
      };
      if (editingDressingId) {
        await NursingService.updateDressing(editingDressingId, payload);
        toast.success("Wound care entry updated");
      } else {
        await NursingService.saveDressing(payload);
        toast.success("Wound care entry recorded");
      }
      notifySaveStatus("saved");
      setDressingForm({ woundType: "", dressingMaterial: "", infectionSigns: false, notes: "" });
      setEditingDressingId(null);
      await refreshChart();
      return true;
    } catch (error) {
      if (handleEncounterLockError(error, (pw) => saveDressing(pw))) return false;
      notifySaveStatus("error");
      toast.error(errorMessage(error, "Failed to save wound care entry"));
      return false;
    } finally {
      setSavingDressing(false);
    }
  };

  const startEditDressing = (d: DressingType) => {
    setEditingDressingId(d.dressingTaskId);
    setDressingForm({ woundType: d.woundType || "", dressingMaterial: d.dressingMaterial || "", infectionSigns: d.infectionSigns, notes: d.notes || "" });
  };

  const cancelEditDressing = () => {
    setEditingDressingId(null);
    setDressingForm({ woundType: "", dressingMaterial: "", infectionSigns: false, notes: "" });
  };

  const removeDressingRecord = (d: DressingType) => {
    confirmDeleteToast(<span>Delete this wound care entry?</span>, async () => {
      try {
        await NursingService.removeDressing(d.dressingTaskId);
        toast.success("Wound care entry removed");
        await refreshChart();
      } catch (error) {
        toast.error(errorMessage(error, "Failed to remove wound care entry"));
      }
    });
  };

  // ---------------- BLOOD SUGAR FORM ----------------
  const [sugarForm, setSugarForm] = useState({ sugarLevel: "", type: "Random", notes: "" });
  const [savingSugar, setSavingSugar] = useState(false);
  const [editingSugarId, setEditingSugarId] = useState<string | null>(null);

  const saveBloodSugar = async (passwordOverride?: string): Promise<boolean> => {
    if (!encounterId) return false;
    if (!sugarForm.sugarLevel) {
      toast.error("Sugar level is required");
      return false;
    }
    if (!requireNurseSelected()) return false;
    notifySaveStatus("saving");
    try {
      setSavingSugar(true);
      const payload = {
        encounterId,
        sugarLevel: Number(sugarForm.sugarLevel),
        type: sugarForm.type,
        notes: sugarForm.notes.trim() || undefined,
        nurseId: isAdmin ? selectedNurseId : undefined,
        password: passwordOverride,
      };
      if (editingSugarId) {
        await NursingService.updateBloodSugar(editingSugarId, payload);
        toast.success("Blood sugar reading updated");
      } else {
        await NursingService.saveBloodSugar(payload);
        toast.success("Blood sugar reading recorded");
      }
      notifySaveStatus("saved");
      setSugarForm({ sugarLevel: "", type: "Random", notes: "" });
      setEditingSugarId(null);
      await refreshChart();
      return true;
    } catch (error) {
      if (handleEncounterLockError(error, (pw) => saveBloodSugar(pw))) return false;
      notifySaveStatus("error");
      toast.error(errorMessage(error, "Failed to save blood sugar reading"));
      return false;
    } finally {
      setSavingSugar(false);
    }
  };

  const startEditSugar = (b: BloodSugarType) => {
    setEditingSugarId(b.bloodSugarTaskId);
    setSugarForm({ sugarLevel: String(b.sugarLevel), type: b.type || "Random", notes: b.notes || "" });
  };

  const cancelEditSugar = () => {
    setEditingSugarId(null);
    setSugarForm({ sugarLevel: "", type: "Random", notes: "" });
  };

  const removeSugarRecord = (b: BloodSugarType) => {
    confirmDeleteToast(<span>Delete this blood sugar reading?</span>, async () => {
      try {
        await NursingService.removeBloodSugar(b.bloodSugarTaskId);
        toast.success("Blood sugar reading removed");
        await refreshChart();
      } catch (error) {
        toast.error(errorMessage(error, "Failed to remove blood sugar reading"));
      }
    });
  };

  // ---------------- IV FLUIDS FORM ----------------
  const [ivForm, setIvForm] = useState({ fluidType: "", volume: "", rate: "", notes: "" });
  const [savingIv, setSavingIv] = useState(false);
  const [editingIvId, setEditingIvId] = useState<string | null>(null);

  const saveIVFluids = async (passwordOverride?: string): Promise<boolean> => {
    if (!encounterId) return false;
    if (!ivForm.fluidType.trim() || !ivForm.volume || !ivForm.rate) {
      toast.error("Fluid type, volume, and rate are required");
      return false;
    }
    if (!requireNurseSelected()) return false;
    notifySaveStatus("saving");
    try {
      setSavingIv(true);
      const payload = {
        encounterId,
        fluidType: ivForm.fluidType.trim(),
        volume: Number(ivForm.volume),
        rate: Number(ivForm.rate),
        notes: ivForm.notes.trim() || undefined,
        nurseId: isAdmin ? selectedNurseId : undefined,
        password: passwordOverride,
      };
      if (editingIvId) {
        await NursingService.updateIVFluids(editingIvId, payload);
        toast.success("IV fluids entry updated");
      } else {
        await NursingService.saveIVFluids(payload);
        toast.success("IV fluids entry recorded");
      }
      notifySaveStatus("saved");
      setIvForm({ fluidType: "", volume: "", rate: "", notes: "" });
      setEditingIvId(null);
      await refreshChart();
      return true;
    } catch (error) {
      if (handleEncounterLockError(error, (pw) => saveIVFluids(pw))) return false;
      notifySaveStatus("error");
      toast.error(errorMessage(error, "Failed to save IV fluids entry"));
      return false;
    } finally {
      setSavingIv(false);
    }
  };

  const startEditIv = (f: IVFluidsType) => {
    setEditingIvId(f.ivFluidsTaskId);
    setIvForm({ fluidType: f.fluidType || "", volume: String(f.volume), rate: String(f.rate), notes: f.notes || "" });
  };

  const cancelEditIv = () => {
    setEditingIvId(null);
    setIvForm({ fluidType: "", volume: "", rate: "", notes: "" });
  };

  const removeIvRecord = (f: IVFluidsType) => {
    confirmDeleteToast(<span>Delete this IV fluids entry?</span>, async () => {
      try {
        await NursingService.removeIVFluids(f.ivFluidsTaskId);
        toast.success("IV fluids entry removed");
        await refreshChart();
      } catch (error) {
        toast.error(errorMessage(error, "Failed to remove IV fluids entry"));
      }
    });
  };

  // ---------------- ALLERGY FORM ----------------
  // Same fields/options as the Doctor Workbench's allergy form (app/(pages)/doctor/page.tsx) -
  // kept in sync so a nurse-recorded allergy carries the same clinical detail as a doctor-recorded one.
  const emptyAllergyForm = { substance: "", reaction: "", allergyCategory: "", severity: "", identifiedDate: "", status: "Active", remarks: "" };
  const [allergyForm, setAllergyForm] = useState(emptyAllergyForm);
  const [savingAllergy, setSavingAllergy] = useState(false);
  const [editingAllergyId, setEditingAllergyId] = useState<string | null>(null);
  // Lets "Correct" (clicked on the allergy box up in the patient header, far from
  // the edit form down in the canEdit section) jump the nurse straight to the form and
  // keep its border blinking - up to 15s, or until the nurse clicks or types anywhere,
  // whichever comes first - so it's unmistakable which section moved even after the
  // scroll animation itself has finished.
  const allergySectionRef = useRef<HTMLDivElement>(null);
  const [allergySectionFlash, setAllergySectionFlash] = useState(false);

  useEffect(() => {
    if (!allergySectionFlash) return;
    const stop = () => setAllergySectionFlash(false);
    document.addEventListener("mousedown", stop);
    document.addEventListener("keydown", stop);
    const timer = setTimeout(stop, 15000);
    return () => {
      document.removeEventListener("mousedown", stop);
      document.removeEventListener("keydown", stop);
      clearTimeout(timer);
    };
  }, [allergySectionFlash]);

  const ALLERGY_CATEGORIES = ["Drug", "Food", "Environmental", "Latex", "Contrast Media", "Other"];
  const ALLERGENS_BY_CATEGORY: Record<string, string[]> = {
    Drug: ["Penicillin", "Amoxicillin", "Aspirin", "NSAIDs", "Sulfonamides", "Codeine", "Morphine", "Tetracycline", "Other Drug"],
    Food: ["Peanuts", "Tree Nuts", "Shellfish", "Fish", "Milk (Dairy)", "Eggs", "Wheat (Gluten)", "Soy", "Other Food"],
    Environmental: ["Pollen", "Dust Mites", "Pet Dander", "Mold", "Grass", "Trees", "Other Environmental"],
    Latex: ["Latex Gloves", "Latex Products", "Other Latex"],
    "Contrast Media": ["Iodinated Contrast", "Gadolinium Contrast", "Other Contrast Media"],
    Other: ["Other"],
  };
  const SEVERITIES = ["Mild", "Moderate", "Severe", "Life-threatening"];
  const REACTIONS = ["Rash", "Hives (Urticaria)", "Itching (Pruritus)", "Swelling (Angioedema)", "Anaphylaxis", "Nausea/Vomiting", "Diarrhea", "Respiratory Distress", "Contact Dermatitis", "Other"];
  const ALLERGY_STATUSES = ["Active", "Inactive", "Resolved"];

  // A record's stored value (especially on allergies recorded before this richer form
  // existed, or any value entered outside these fixed lists) may not be one of the
  // predefined options - without this, correcting such a record would silently blank out
  // that field in the <select> (no matching <option>), even though the data is intact.
  const withCurrentOption = (list: string[], current: string) =>
    current && !list.includes(current) ? [current, ...list] : list;

  const saveAllergy = async () => {
    if (!selectedPatientId) return;
    if (!allergyForm.substance.trim()) {
      toast.error("Allergen is required");
      return;
    }
    if (!allergyForm.allergyCategory) {
      toast.error("Allergy category is required");
      return;
    }
    // Unlike the NursingController writes above, this one goes through EmrController —
    // real nurses are exempt from its doctorId requirement entirely, but admin isn't.
    if (!requireDoctorSelectedForAllergy()) return;
    notifySaveStatus("saving");
    try {
      setSavingAllergy(true);
      const payload: AllergyPayload = {
        substance: allergyForm.substance.trim(),
        reaction: allergyForm.reaction.trim() || undefined,
        allergyCategory: allergyForm.allergyCategory || undefined,
        severity: allergyForm.severity || undefined,
        identifiedDate: allergyForm.identifiedDate || undefined,
        status: allergyForm.status || "Active",
        remarks: allergyForm.remarks.trim() || undefined,
      };
      if (editingAllergyId) {
        await EmrService.updateAllergy(editingAllergyId, payload, isAdmin ? selectedDoctorId : undefined);
        toast.success("Allergy corrected");
      } else {
        await EmrService.addAllergy(selectedPatientId, payload, isAdmin ? selectedDoctorId : undefined);
        toast.success("Allergy recorded");
      }
      notifySaveStatus("saved");
      setAllergyForm(emptyAllergyForm);
      setEditingAllergyId(null);
      const res = await EmrService.getPatientSummary(selectedPatientId);
      setSummary(res.data);
    } catch (error) {
      notifySaveStatus("error");
      toast.error(errorMessage(error, "Failed to record allergy"));
    } finally {
      setSavingAllergy(false);
    }
  };

  const startEditAllergy = (a: AllergyType) => {
    setEditingAllergyId(a.patientAllergyId);
    setAllergyForm({
      substance: a.substance,
      reaction: a.reaction || "",
      allergyCategory: a.allergyCategory || "",
      severity: a.severity || "",
      identifiedDate: a.identifiedDate || "",
      status: a.status || "Active",
      remarks: a.remarks || "",
    });
    allergySectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setAllergySectionFlash(true);
  };

  const cancelEditAllergy = () => {
    setEditingAllergyId(null);
    setAllergyForm(emptyAllergyForm);
  };

  const removeAllergyRecord = (a: AllergyType) => {
    if (!selectedPatientId) return;
    confirmDeleteToast(
      <span>Delete allergy <b className="text-red-500 ml-1">{a.substance}</b>?</span>,
      async () => {
        try {
          await EmrService.removeAllergy(a.patientAllergyId, isAdmin ? selectedDoctorId : undefined);
          toast.success("Allergy removed");
          const res = await EmrService.getPatientSummary(selectedPatientId);
          setSummary(res.data);
        } catch (error) {
          toast.error(errorMessage(error, "Failed to remove allergy"));
        }
      }
    );
  };

  // ---------------- SPECIAL REMARK FORM ----------------
  const [remarkForm, setRemarkForm] = useState({ remarkType: REMARK_TYPES[0], description: "" });
  const [savingRemark, setSavingRemark] = useState(false);
  const [editingRemarkId, setEditingRemarkId] = useState<string | null>(null);

  const saveSpecialRemark = async () => {
    if (!selectedPatientId) return;
    if (!remarkForm.description.trim()) {
      toast.error("Description is required");
      return;
    }
    notifySaveStatus("saving");
    try {
      setSavingRemark(true);
      const payload = {
        remarkType: remarkForm.remarkType,
        description: remarkForm.description.trim(),
      };
      if (editingRemarkId) {
        await NursingService.updateSpecialRemark(editingRemarkId, payload);
        toast.success("Special remark updated");
      } else {
        await NursingService.addSpecialRemark(selectedPatientId, payload);
        toast.success("Special remark added");
      }
      notifySaveStatus("saved");
      setRemarkForm({ remarkType: REMARK_TYPES[0], description: "" });
      setEditingRemarkId(null);
      await refreshChart();
    } catch (error) {
      notifySaveStatus("error");
      toast.error(errorMessage(error, "Failed to add special remark"));
    } finally {
      setSavingRemark(false);
    }
  };

  const startEditRemark = (r: SpecialRemarkType) => {
    setEditingRemarkId(r.specialRemarkId);
    setRemarkForm({ remarkType: r.remarkType, description: r.description });
  };

  const cancelEditRemark = () => {
    setEditingRemarkId(null);
    setRemarkForm({ remarkType: REMARK_TYPES[0], description: "" });
  };

  const removeSpecialRemark = (r: SpecialRemarkType) => {
    confirmDeleteToast(<span>Delete this special remark?</span>, async () => {
      try {
        await NursingService.removeSpecialRemark(r.specialRemarkId);
        toast.success("Special remark removed");
        await refreshChart();
      } catch (error) {
        toast.error(errorMessage(error, "Failed to remove special remark"));
      }
    });
  };

  // ---------------- NURSE NOTES (rich text + confidential toggle) ----------------
  // Confidential notes are write-only from this composer (no confidential-note list is
  // rendered on this page - see the standalone /nursing/confidential-notes page for that,
  // which has its own edit/delete). Only the shared Nurse Notes list below is editable here.
  const [nurseNoteHtml, setNurseNoteHtml] = useState("");
  const [nurseNoteConfidential, setNurseNoteConfidential] = useState(false);
  const [savingNurseNote, setSavingNurseNote] = useState(false);
  const [editingNurseNoteId, setEditingNurseNoteId] = useState<string | null>(null);

  const saveNurseNote = async () => {
    if (!selectedPatientId) return;
    if (!nurseNoteHtml.trim() || nurseNoteHtml === "<p></p>") {
      toast.error("Note content is required");
      return;
    }
    if (!requireNurseSelected()) return;
    notifySaveStatus("saving");
    try {
      setSavingNurseNote(true);
      const payload = {
        encounterId: encounterId || undefined,
        contentHtml: nurseNoteHtml,
        isConfidential: nurseNoteConfidential,
        nurseId: isAdmin ? selectedNurseId : undefined,
      };
      if (editingNurseNoteId) {
        await NursingService.updateNote(editingNurseNoteId, payload);
        toast.success("Nurse note updated");
      } else if (nurseNoteConfidential) {
        await NursingService.addConfidentialNote(selectedPatientId, payload);
        toast.success("Confidential note saved — visible only to you");
      } else {
        await NursingService.addNote(selectedPatientId, payload);
        toast.success("Nurse note added");
      }
      notifySaveStatus("saved");
      setNurseNoteHtml("");
      setNurseNoteConfidential(false);
      setEditingNurseNoteId(null);
      await refreshChart();
    } catch (error) {
      notifySaveStatus("error");
      toast.error(errorMessage(error, "Failed to save note"));
    } finally {
      setSavingNurseNote(false);
    }
  };

  const startEditNurseNote = (n: NurseNoteType) => {
    setEditingNurseNoteId(n.nurseNoteId);
    setNurseNoteHtml(n.contentHtml);
    setNurseNoteConfidential(false);
  };

  const cancelEditNurseNote = () => {
    setEditingNurseNoteId(null);
    setNurseNoteHtml("");
    setNurseNoteConfidential(false);
  };

  const removeNurseNote = (n: NurseNoteType) => {
    confirmDeleteToast(<span>Delete this nurse note?</span>, async () => {
      try {
        await NursingService.removeNote(n.nurseNoteId);
        toast.success("Nurse note removed");
        await refreshChart();
      } catch (error) {
        toast.error(errorMessage(error, "Failed to remove note"));
      }
    });
  };

  // ---------------- TREATMENTS (doctor-ordered; nurse Starts, Marks Done, or Reverts a
  // start to hand editing back to the doctor - see Controllers/TreatmentController.cs) ----------------
  const [markingTreatmentId, setMarkingTreatmentId] = useState<string | null>(null);
  const [viewingTreatment, setViewingTreatment] = useState<TreatmentType | null>(null);
  // Read-only investigation config views (see the Investigations card below) - sample
  // collection itself happens on the Lab workbench, not here.
  const [viewingLabRequest, setViewingLabRequest] = useState<LabRequestType | null>(null);
  const [viewingRadiologyRequest, setViewingRadiologyRequest] = useState<RadiologyRequestType | null>(null);

  const startTreatment = async (treatmentId: string) => {
    if (!requireNurseSelected()) return;
    try {
      setMarkingTreatmentId(treatmentId);
      await TreatmentService.start(treatmentId, isAdmin ? selectedNurseId : undefined);
      toast.success("Treatment started");
      await refreshChart();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to start treatment"));
    } finally {
      setMarkingTreatmentId(null);
    }
  };

  const revertTreatment = async (treatmentId: string) => {
    try {
      setMarkingTreatmentId(treatmentId);
      await TreatmentService.revert(treatmentId);
      toast.success("Treatment reverted to Pending — the doctor can edit it again");
      await refreshChart();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to revert treatment"));
    } finally {
      setMarkingTreatmentId(null);
    }
  };

  const markTreatmentDone = async (treatmentId: string) => {
    if (!requireNurseSelected()) return;
    try {
      setMarkingTreatmentId(treatmentId);
      await TreatmentService.markDone(treatmentId, isAdmin ? selectedNurseId : undefined);
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

  // Date filtering is handled server-side (EmrController.GetPatients accepts a ?date= param
  // and scopes results to that calendar day). Client-side we only apply the search term.
  const filteredPatients = patients.filter((p) =>
    !searchTerm ||
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.opNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.opId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.assignedDoctorName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const patientWorkQueue = workQueue.filter((item) => item.patientId === selectedPatientId);
  const pendingMedicationCount = patientWorkQueue.filter((item) => item.itemType === "Medication").length;
  const pendingInvestigationCount = patientWorkQueue.filter((item) => item.itemType === "LabSample" || item.itemType === "RadiologySample").length;

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
      <div className="h-full flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-10 py-4 border-b border-border gap-4">
          {isDoctor && (
            <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Lock size={12} /> Read-only view
            </span>
          )}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <div className="w-48 shrink-0">
                <SearchableSelect
                  value={selectedNurseId}
                  onChange={setSelectedNurseId}
                  className={standaloneSelectClass}
                  options={[
                    { value: "", label: "Acting nurse…" },
                    ...nurses.map((n) => ({ value: n.id, label: n.name })),
                  ]}
                />
              </div>
              <div className="w-48 shrink-0">
                <SearchableSelect
                  value={selectedDoctorId}
                  onChange={setSelectedDoctorId}
                  className={standaloneSelectClass}
                  options={[
                    { value: "", label: "Acting doctor (for allergies)…" },
                    ...assignedDoctors.map((d) => ({ value: String(d.doctorId), label: d.userName })),
                  ]}
                />
              </div>
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

        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-10 py-6 sm:py-8">
        {!summary ? (
          <LoadingSpinner />
        ) : (
          <div className="flex flex-col gap-6">
            <div className="card p-6 flex flex-col gap-1 border-l-4 border-l-primary">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                    <HeartPulse className="text-primary" /> {summary.name}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    MRN {summary.opNumber || summary.opId} · {summary.sex || "—"} · DOB {formatDate(summary.dateOfBirth)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {summary.phone ? `${summary.phoneCode ? `${summary.phoneCode} ` : ""}${summary.phone}` : "No phone"} · {summary.email || "No email"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowTriageModal(true)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      chart?.triage
                        ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                        : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <ClipboardCheck size={13} />
                    Triage
                    {chart?.triage && <span className="ml-0.5 text-[10px] font-bold rounded-full bg-primary text-primary-foreground px-1.5 py-0.5">✓</span>}
                  </button>
                  <button
                    onClick={() => setShowDocumentsModal(true)}
                    className={`relative flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      unviewedDocumentCount > 0
                        ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                        : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <FileText size={13} />
                    Patient Documents
                    {documents.length > 0 && (
                      <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        unviewedDocumentCount > 0 ? "bg-blue-600 text-white" : "bg-muted-foreground/20 text-muted-foreground"
                      }`}>
                        {documents.length}
                      </span>
                    )}
                    {unviewedDocumentCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-blue-500 border-2 border-card" />
                    )}
                  </button>
                  </div>
                  {summary.latestEncounter?.chiefComplaint && (
                    <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 max-w-sm">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Chief Complaint</p>
                      <p className="text-sm text-foreground">{summary.latestEncounter.chiefComplaint}</p>
                    </div>
                  )}
                </div>
              </div>

              {summary.allergies.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={16} className="text-red-600 shrink-0" />
                    <h3 className="text-xs font-bold uppercase tracking-wide text-red-700 dark:text-red-400">
                      Known Allergies
                    </h3>
                  </div>
                  <div className="flex flex-col gap-2">
                    {summary.allergies.map((a) => {
                      const severityClass =
                        a.severity === "Life-threatening" ? "text-red-800 dark:text-red-200" :
                        a.severity === "Severe" ? "text-orange-700 dark:text-orange-300" :
                        a.severity === "Moderate" ? "text-yellow-700 dark:text-yellow-300" :
                        a.severity === "Mild" ? "text-green-700 dark:text-green-300" : "text-foreground/90";
                      return (
                        <div
                          key={a.patientAllergyId}
                          className="group rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-bold text-red-700 dark:text-red-400">{a.substance}</p>
                            <span className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <button onClick={() => startEditAllergy(a)} title="Correct" className="rounded-full p-1 hover:bg-black/10">
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => removeAllergyRecord(a)} title="Delete" className="rounded-full p-1 hover:bg-black/10">
                                <Trash2 size={13} />
                              </button>
                            </span>
                          </div>
                          <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                            <p><span className="text-muted-foreground">Allergy Category: </span><span className="font-medium text-foreground/90">{a.allergyCategory || "—"}</span></p>
                            <p><span className="text-muted-foreground">Allergen: </span><span className="font-medium text-foreground/90">{a.substance}</span></p>
                            <p><span className="text-muted-foreground">Severity: </span><span className={`font-medium ${severityClass}`}>{a.severity || "—"}</span></p>
                            <p><span className="text-muted-foreground">Reaction: </span><span className="font-medium text-foreground/90">{a.reaction || "—"}</span></p>
                            <p><span className="text-muted-foreground">Identified Date: </span><span className="font-medium text-foreground/90">{a.identifiedDate || "—"}</span></p>
                            <p><span className="text-muted-foreground">Status: </span><span className="font-medium text-foreground/90">{a.status || "Active"}</span></p>
                          </div>
                          {a.remarks && (
                            <p className="mt-1.5 text-xs italic text-foreground/70">Remarks: {a.remarks}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {summary.allergies.some((a) => a.correctedFrom) && (
                    <div className="mt-1 flex flex-col gap-0.5">
                      {summary.allergies.filter((a) => a.correctedFrom).map((a) => (
                        <CorrectedFromNote key={a.patientAllergyId}>
                          <p>Previous ({a.substance}): {a.correctedFrom!.substance}{a.correctedFrom!.reaction ? ` · reaction: ${a.correctedFrom!.reaction}` : ""}</p>
                        </CorrectedFromNote>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {chart && chart.specialRemarks.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
                  <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  {chart.specialRemarks.map((r) => (
                    <span
                      key={r.specialRemarkId}
                      className="group flex items-center gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400"
                      title={r.description}
                    >
                      {r.remarkType}: {r.description}
                      <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEditRemark(r)} title="Edit" className="p-0.5 hover:bg-black/10 rounded-full">
                          <Pencil size={10} />
                        </button>
                        <button onClick={() => removeSpecialRemark(r)} title="Delete" className="p-0.5 hover:bg-black/10 rounded-full">
                          <Trash2 size={10} />
                        </button>
                      </span>
                    </span>
                  ))}
                </div>
              )}

              {/* Medical History - read-only here; only the doctor workbench can edit it
                  (EmrController.UpdateMedicalHistory is doctor/admin-only). Always shown,
                  not gated on having data (unlike allergies/remarks above), so the section
                  itself is never mistaken for missing - an empty record just reads "—". */}
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-2 mb-2">
                  <ClipboardList size={16} className="text-primary shrink-0" />
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Medical History
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-0.5">Past Medical History</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {summary.pastMedicalHistory || <span className="text-muted-foreground italic">No past medical history</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-0.5">Past Surgical History</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {summary.pastSurgicalHistory || <span className="text-muted-foreground italic">No past surgical history</span>}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Medication History - read-only mirror of the doctor workbench's Medication
                Tracking panel (current + past meds), placed right after Medical History
                above. Actually administering a dose is a separate, always-visible action
                further down ("Prescribed Medications") - this is reference only, so no
                add/correct/discontinue controls here. */}
            <div className="card p-6 flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Pill size={18} className="text-primary" /> Medication History
              </h2>

              <div className="flex border-b border-border">
                <button
                  onClick={() => setMedHistoryTab("current")}
                  className={`relative px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                    medHistoryTab === "current"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  } ${pendingMedicationCount > 0 ? "animate-pulse" : ""}`}
                >
                  Current Medications
                  {summary.currentMedications.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                      {summary.currentMedications.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setMedHistoryTab("history")}
                  className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                    medHistoryTab === "history"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Medication History
                  {summary.medicationHistory.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                      {summary.medicationHistory.length}
                    </span>
                  )}
                </button>
              </div>

              {medHistoryTab === "current" && (
                <div>
                  {summary.currentMedications.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table>
                        <thead>
                          <tr>
                            <th>Drug</th>
                            <th>Dosage</th>
                            <th>Route</th>
                            <th>Frequency</th>
                            <th>Priority</th>
                            <th>Instructions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.currentMedications.map((m) => (
                            <tr key={m.medicationId}>
                              <td className="font-semibold">
                                {m.drugName}
                                {m.isHighRisk && (
                                  <span className="ml-2 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive align-middle">
                                    High-risk
                                  </span>
                                )}
                              </td>
                              <td>{m.dosage ? `${m.dosage}${m.dosageUnit ? ` ${m.dosageUnit}` : ""}` : "—"}</td>
                              <td>{m.route || "—"}</td>
                              <td>{m.frequency || "—"}</td>
                              <td>
                                {m.priority !== "Routine" ? (
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${m.priority === "STAT" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                                    {m.priority}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">Routine</span>
                                )}
                              </td>
                              <td className="text-xs text-muted-foreground max-w-48 truncate">{m.instructions || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState size="compact" illustration="pharmacy" title="No active medications" />
                  )}
                </div>
              )}

              {medHistoryTab === "history" && (
                <div>
                  {summary.medicationHistory.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table>
                        <thead>
                          <tr>
                            <th>Drug</th>
                            <th>Dosage</th>
                            <th>Route</th>
                            <th>Frequency</th>
                            <th>Duration</th>
                            <th>Ended</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.medicationHistory.map((m) => (
                            <tr key={m.medicationId}>
                              <td className="font-semibold">{m.drugName}</td>
                              <td>{m.dosage ? `${m.dosage}${m.dosageUnit ? ` ${m.dosageUnit}` : ""}` : "—"}</td>
                              <td>{m.route || "—"}</td>
                              <td>{m.frequency || "—"}</td>
                              <td>{m.durationDays ? `${m.durationDays} days` : "—"}</td>
                              <td className="text-xs text-muted-foreground">{m.endedAt ? formatDate(m.endedAt) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState size="compact" illustration="medicationHistory" title="No medication history recorded" />
                  )}
                </div>
              )}
            </div>

            <FamilyHistorySection
              patientId={selectedPatientId}
              familyHistory={summary.familyHistory}
              doctorId={isAdmin ? selectedDoctorId : undefined}
              requireAttribution={requireDoctorSelectedForAllergy}
              onSaved={async () => {
                const res = await EmrService.getPatientSummary(selectedPatientId);
                setSummary(res.data);
              }}
            />
            </div>

            {/* Triage modal */}
            {showTriageModal && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-card rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                  {/* Modal header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <ClipboardCheck size={18} className="text-primary" /> Triage — {summary.name}
                      </h2>
                      {chart?.triage && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Last saved by {chart.triage.nurseName || "—"} · {formatDateTime(chart.triage.createdAt)}
                        </p>
                      )}
                    </div>
                    <button onClick={() => setShowTriageModal(false)} className="p-2 rounded-full hover:bg-muted transition-colors">
                      <X size={18} />
                    </button>
                  </div>

                  {/* Modal body — scrollable */}
                  <div className="overflow-y-auto flex-1 p-6 flex flex-col gap-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm rounded-lg border border-border bg-muted/20 p-3">
                      <div>
                        <p className="text-xs text-muted-foreground">IP Number</p>
                        <p className="font-semibold text-foreground">{summary.opNumber || summary.opId}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Marital Status</p>
                        <p className="font-semibold text-foreground">{summary.maritalStatus || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Gender / Age / DOB</p>
                        <p className="font-semibold text-foreground">{summary.sex || "—"} · {formatDate(summary.dateOfBirth)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Nationality</p>
                        <p className="font-semibold text-foreground">{summary.nationality || "—"}</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                        <FileText size={13} /> Chief Complaint
                      </h3>
                      {summary.latestEncounter?.chiefComplaint ? (
                        <p className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
                          {summary.latestEncounter.chiefComplaint}
                        </p>
                      ) : (
                        <p className="w-full rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                          Not yet documented by the doctor.
                        </p>
                      )}
                    </div>

                    <div className="border-t border-border pt-5">
                      <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
                        <Flag size={13} /> Triage Priority
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                        {TRIAGE_PRIORITY_LEVELS.map((lvl) => {
                          const selected = triageForm.priorityLevel === lvl.level;
                          return (
                            <label
                              key={lvl.level}
                              className={`relative flex flex-col gap-1 rounded-xl border p-3 transition-all ${
                                canEdit ? "cursor-pointer" : "cursor-default"
                              } ${selected ? lvl.active : `${lvl.idle} ${canEdit ? "hover:opacity-80" : ""}`}`}
                            >
                              <input
                                type="radio"
                                className="sr-only"
                                disabled={!canEdit}
                                checked={selected}
                                onChange={() => setTriageForm((prev) => ({ ...prev, priorityLevel: lvl.level }))}
                              />
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-wide">{lvl.label}</span>
                                {selected && <CheckCircle2 size={14} className="shrink-0" />}
                              </div>
                              <p className="text-sm font-bold leading-tight">{lvl.name}</p>
                              <p className={`text-xs ${selected ? "text-white/80" : "opacity-70"}`}>{lvl.eta}</p>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border-t border-border pt-5 flex flex-col gap-3">
                      <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        <Stethoscope size={13} /> Symptoms
                      </h3>
                      {TRIAGE_SYMPTOM_ROWS.map((row) => {
                        const detailKey = `${row.key}Detail` as const;
                        return (
                          <div key={row.key} className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 rounded-lg border border-border bg-muted/20 p-3">
                            <p className="text-sm text-foreground flex-1 sm:pt-2">{row.label}</p>
                            <div className="inline-flex rounded-lg border border-border bg-muted p-0.5 shrink-0">
                              {(["Yes", "No", "Unknown"] as const).map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  disabled={!canEdit}
                                  onClick={() => setTriageForm((prev) => ({ ...prev, [row.key]: opt }))}
                                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                                    triageForm[row.key] === opt
                                      ? "bg-card text-foreground shadow-sm"
                                      : "text-muted-foreground hover:text-foreground"
                                  } ${canEdit ? "cursor-pointer" : "cursor-default"}`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                            <textarea
                              placeholder="Details"
                              disabled={!canEdit}
                              value={triageForm[detailKey]}
                              onChange={(e) => setTriageForm((prev) => ({ ...prev, [detailKey]: e.target.value }))}
                              rows={1}
                              className="text-sm sm:flex-1 sm:min-w-64 resize-y"
                            />
                          </div>
                        );
                      })}
                    </div>

                    <fieldset disabled={!canEdit} className="contents">
                      <div className="border-t border-border pt-5">
                        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
                          <Activity size={13} /> Vital Signs in Triage
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          {TRIAGE_VITAL_FIELDS.map(renderTriageVitalRow)}
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-muted-foreground">BMI (kg/m2)</label>
                            <input type="text" disabled value={triageBmi != null ? String(triageBmi) : ""} className="text-sm opacity-70" />
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-border pt-5">
                        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
                          <HeartPulse size={13} /> Obstetric
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          {TRIAGE_OBSTETRIC_FIELDS.map(renderTriageVitalRow)}
                        </div>
                      </div>
                    </fieldset>

                    <div className="border-t border-border pt-5 flex flex-wrap items-end justify-between gap-4">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <ToggleButton
                            disabled={!canEdit}
                            checked={triageForm.patientRefused}
                            onChange={(checked) => setTriageForm((prev) => ({ ...prev, patientRefused: checked }))}
                          />
                          <span className="text-sm font-semibold text-foreground">Patient Refused (entire assessment)</span>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground block mb-1">Action Date Time</label>
                          <input
                            type="datetime-local"
                            disabled={!canEdit}
                            value={triageForm.actionDateTime}
                            onChange={(e) => setTriageForm((prev) => ({ ...prev, actionDateTime: e.target.value }))}
                            className="text-sm"
                          />
                        </div>
                      </div>
                      {canEdit && (
                        <button
                          onClick={async () => { await handleSaveTriage(); setShowTriageModal(false); }}
                          disabled={savingTriage || !encounterId}
                          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                        >
                          <Save size={15} /> Save Triage
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                    <EmptyState size="compact" illustration="vitals" title="No chronic conditions recorded" />
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
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-muted-foreground">Blood Pressure — Systolic <span className="text-destructive">*</span></label>
                        <input type="number" min="0" placeholder="e.g. 120 mmHg" value={vitalsForm.systolic} onChange={(e) => setVitalsForm((p) => ({ ...p, systolic: e.target.value.replace(/-/g, "") }))} className="h-10 text-sm w-full" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-muted-foreground">Blood Pressure — Diastolic <span className="text-destructive">*</span></label>
                        <input type="number" min="0" placeholder="e.g. 80 mmHg" value={vitalsForm.diastolic} onChange={(e) => setVitalsForm((p) => ({ ...p, diastolic: e.target.value.replace(/-/g, "") }))} className="h-10 text-sm w-full" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-muted-foreground">Heart Rate / Pulse <span className="text-destructive">*</span></label>
                        <input type="number" min="0" placeholder="e.g. 72 bpm" value={vitalsForm.heartRate} onChange={(e) => setVitalsForm((p) => ({ ...p, heartRate: e.target.value.replace(/-/g, "") }))} className="h-10 text-sm w-full" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-muted-foreground">Temperature</label>
                        <input type="number" step="0.1" min="0" placeholder="e.g. 37.0 °C" value={vitalsForm.temperature} onChange={(e) => setVitalsForm((p) => ({ ...p, temperature: e.target.value.replace(/-/g, "") }))} className="h-10 text-sm w-full" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-muted-foreground">Respiratory Rate</label>
                        <input type="number" min="0" placeholder="e.g. 16 br/min" value={vitalsForm.respiratoryRate} onChange={(e) => setVitalsForm((p) => ({ ...p, respiratoryRate: e.target.value.replace(/-/g, "") }))} className="h-10 text-sm w-full" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-muted-foreground">Oxygen Saturation (SpO2)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="e.g. 98 %"
                          value={vitalsForm.oxygenSaturation}
                          onChange={(e) => {
                            let v = e.target.value.replace(/-/g, "");
                            if (v !== "" && Number(v) > 100) v = "100";
                            setVitalsForm((p) => ({ ...p, oxygenSaturation: v }));
                          }}
                          className="h-10 text-sm w-full"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-muted-foreground">Height</label>
                        <input type="number" step="0.1" min="0" placeholder="e.g. 170 cm" value={vitalsForm.heightCm} onChange={(e) => setVitalsForm((p) => ({ ...p, heightCm: e.target.value.replace(/-/g, "") }))} className="h-10 text-sm w-full" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-muted-foreground">Weight</label>
                        <input type="number" step="0.1" min="0" placeholder="e.g. 70 kg" value={vitalsForm.weightKg} onChange={(e) => setVitalsForm((p) => ({ ...p, weightKg: e.target.value.replace(/-/g, "") }))} className="h-10 text-sm w-full" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-muted-foreground">BMI (auto-calculated)</label>
                        <input type="text" readOnly disabled placeholder="kg/m²" value={liveBmi ?? ""} className="h-10 text-sm w-full" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted-foreground">BMI screening exclusion (if any)</label>
                      <SearchableSelect
                        value={vitalsForm.bmiExclusionReason}
                        onChange={(v) => setVitalsForm((p) => ({ ...p, bmiExclusionReason: v }))}
                        options={[
                          { value: "", label: "None" },
                          { value: "Pregnant", label: "Pregnant" },
                          { value: "PalliativeCare", label: "Receiving palliative care" },
                          { value: "MedicalReason", label: "Documented medical reason (urgent/emergent)" },
                        ]}
                      />
                    </div>
                    <textarea placeholder="Notes..." value={vitalsForm.notes} onChange={(e) => setVitalsForm((p) => ({ ...p, notes: e.target.value }))} className="w-full min-h-14 text-sm" />
                    <div className="flex items-center gap-3">
                      <button onClick={() => saveVitals()} disabled={savingVitals} className="self-start flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                        <Save size={15} /> {editingVitalsId ? "Save Correction" : "Save Vitals"}
                      </button>
                      {editingVitalsId && (
                        <button onClick={cancelEditVitals} className="text-sm font-semibold text-muted-foreground hover:underline">
                          Cancel
                        </button>
                      )}
                    </div>
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
                        <div className="flex flex-wrap gap-3">
                          {Object.entries(TREND_METRICS).map(([key, m]) => (
                            <label
                              key={key}
                              className="flex items-center gap-1.5 text-xs font-medium cursor-pointer select-none"
                            >
                              <input
                                type="checkbox"
                                checked={visibleTrendMetrics[key] ?? true}
                                onChange={() => toggleTrendMetric(key)}
                                className="h-3.5 w-3.5 cursor-pointer"
                                style={{ accentColor: m.color }}
                              />
                              <span style={{ color: m.color }}>{m.label}</span>
                            </label>
                          ))}
                        </div>
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
                                <td className="text-xs">
                                  {formatDateTime(v.recordedAt)}
                                  {v.correctedFrom && (
                                    <CorrectedFromNote>
                                      <div>
                                        Previous: {v.correctedFrom.systolic}/{v.correctedFrom.diastolic} mmHg · HR {v.correctedFrom.heartRate} · Temp {v.correctedFrom.temperature}°C · SpO2 {v.correctedFrom.oxygenSaturation}%
                                      </div>
                                      <div>
                                        Recorded {formatDateTime(v.correctedFrom.recordedAt)} by {v.correctedFrom.nurseName ?? "—"}
                                      </div>
                                    </CorrectedFromNote>
                                  )}
                                </td>
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
                                  <div className="flex items-center gap-1.5">
                                    {v.isCritical && (
                                      <span className="rounded-full bg-red-100 text-red-700 text-xs px-2 py-0.5 font-semibold">Critical</span>
                                    )}
                                    <button
                                      onClick={() => startEditVitals(v)}
                                      title="Correct this reading"
                                      className="p-1 hover:bg-primary/10 rounded-full text-primary"
                                    >
                                      <Pencil size={13} />
                                    </button>
                                    <button
                                      onClick={() => confirmRemoveVitals(v)}
                                      title="Delete this reading"
                                      className="p-1 hover:bg-destructive/10 rounded-full text-destructive"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={[...chart.vitals].reverse().map((v) => ({
                              label: new Date(v.recordedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
                              fullLabel: formatDateTime(v.recordedAt),
                              ...v,
                            }))}
                            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? ""} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            {Object.entries(TREND_METRICS)
                              .filter(([key]) => visibleTrendMetrics[key])
                              .map(([key, m]) => (
                                <Line
                                  key={key}
                                  type="monotone"
                                  dataKey={key}
                                  name={m.label}
                                  stroke={m.color}
                                  connectNulls
                                  dot={{ r: 3 }}
                                  isAnimationActive={false}
                                />
                              ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
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
                      <div className="sm:col-span-2">
                        <SearchableSelect
                          value={injectionForm.route}
                          onChange={(v) => setInjectionForm((p) => ({ ...p, route: v }))}
                          options={[
                            { value: "Oral (PO)", label: "Oral (PO)" },
                            { value: "Intravenous (IV)", label: "Intravenous (IV)" },
                            { value: "Intramuscular (IM)", label: "Intramuscular (IM)" },
                            { value: "Subcutaneous (SC)", label: "Subcutaneous (SC)" },
                            { value: "Topical", label: "Topical" },
                          ]}
                        />
                      </div>
                    </div>
                    <textarea placeholder="Notes..." value={injectionForm.notes} onChange={(e) => setInjectionForm((p) => ({ ...p, notes: e.target.value }))} className="w-full min-h-14 text-sm" />
                    <div className="flex items-center gap-3">
                      <button onClick={() => saveInjection()} disabled={savingInjection} className="self-start flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                        <Save size={15} /> {editingInjectionId ? "Save Correction" : "Save Entry"}
                      </button>
                      {editingInjectionId && (
                        <button onClick={cancelEditInjection} className="text-sm font-semibold text-muted-foreground hover:underline">
                          Cancel
                        </button>
                      )}
                    </div>
                  </>
                )}

                {chart && chart.injections.length > 0 && (
                  <div className="flex flex-col gap-1.5 border-t border-border pt-3 max-h-40 overflow-y-auto">
                    {chart.injections.slice(0, 5).map((i) => (
                      <div key={i.injectionRecordId} className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm">
                        <div className="group flex items-center justify-between">
                          <span className="font-medium">{i.medicineName} · {i.dose} · {i.route}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{formatDateTime(i.givenAt)}</span>
                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => startEditInjection(i)} title="Correct" className="p-1 hover:bg-primary/10 rounded-full text-primary">
                                <Pencil size={12} />
                              </button>
                              <button onClick={() => confirmRemoveInjection(i)} title="Delete" className="p-1 hover:bg-destructive/10 rounded-full text-destructive">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                        {i.correctedFrom && (
                          <CorrectedFromNote>
                            <div>
                              Previous: {i.correctedFrom.medicineName} · {i.correctedFrom.dose} · {i.correctedFrom.route}
                            </div>
                            {i.correctedFrom.notes && <div>{i.correctedFrom.notes}</div>}
                            <div>
                              Given {formatDateTime(i.correctedFrom.givenAt)} by {i.correctedFrom.nurseName ?? "—"}
                            </div>
                          </CorrectedFromNote>
                        )}
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
                    <SearchableSelect
                      value={dressingForm.woundType}
                      onChange={(v) => setDressingForm((p) => ({ ...p, woundType: v }))}
                      options={[
                        { value: "", label: "Select wound type..." },
                        { value: "Surgical Incision", label: "Surgical Incision" },
                        { value: "Pressure Ulcer", label: "Pressure Ulcer" },
                        { value: "Laceration", label: "Laceration" },
                        { value: "Diabetic Ulcer", label: "Diabetic Ulcer" },
                        { value: "Burn", label: "Burn" },
                      ]}
                    />
                    <SearchableSelect
                      value={dressingForm.dressingMaterial}
                      onChange={(v) => setDressingForm((p) => ({ ...p, dressingMaterial: v }))}
                      options={[
                        { value: "", label: "Select dressing material..." },
                        { value: "Alginate Dressing", label: "Alginate Dressing" },
                        { value: "Gauze", label: "Gauze" },
                        { value: "Hydrocolloid", label: "Hydrocolloid" },
                        { value: "Foam Dressing", label: "Foam Dressing" },
                        { value: "Transparent Film", label: "Transparent Film" },
                      ]}
                    />
                    <div className="flex items-center gap-3">
                      <ToggleButton
                        checked={dressingForm.infectionSigns}
                        onChange={(checked) => setDressingForm((p) => ({ ...p, infectionSigns: checked }))}
                      />
                      <span className="text-sm">Signs of infection observed (redness, swelling, warmth, or discharge)</span>
                    </div>
                    <textarea placeholder="Notes..." value={dressingForm.notes} onChange={(e) => setDressingForm((p) => ({ ...p, notes: e.target.value }))} className="w-full min-h-14 text-sm" />
                    <div className="flex items-center gap-3">
                      <button onClick={() => saveDressing()} disabled={savingDressing} className="self-start flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                        <Save size={15} /> {editingDressingId ? "Save Changes" : "Save Entry"}
                      </button>
                      {editingDressingId && (
                        <button onClick={cancelEditDressing} className="text-sm font-semibold text-muted-foreground hover:underline">
                          Cancel
                        </button>
                      )}
                    </div>
                  </>
                )}

                {chart && chart.dressings.length > 0 && (
                  <div className="flex flex-col gap-1.5 border-t border-border pt-3 max-h-40 overflow-y-auto">
                    {chart.dressings.slice(0, 5).map((d) => (
                      <div key={d.dressingTaskId} className="group flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm">
                        <span className="font-medium">{d.woundType} · {d.dressingMaterial}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${d.infectionSigns ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                            {d.infectionSigns ? "Infection signs" : formatDate(d.createdAt)}
                          </span>
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEditDressing(d)} title="Edit" className="p-1 hover:bg-primary/10 rounded-full text-primary">
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => removeDressingRecord(d)} title="Delete" className="p-1 hover:bg-destructive/10 rounded-full text-destructive">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Blood Sugar — merged into Vital Signs card */}
                <div className="border-t border-border pt-4 flex flex-col gap-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Droplets size={15} className="text-primary" /> Blood Sugar
                  </h3>
                  {canEdit && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <input type="number" min="0" placeholder="Sugar (mg/dL)" value={sugarForm.sugarLevel} onChange={(e) => setSugarForm((p) => ({ ...p, sugarLevel: e.target.value.replace(/-/g, "") }))} className="h-10 text-sm" />
                        <SearchableSelect
                          value={sugarForm.type}
                          onChange={(v) => setSugarForm((p) => ({ ...p, type: v }))}
                          options={[
                            { value: "Random", label: "Random" },
                            { value: "Fasting", label: "Fasting" },
                            { value: "Post-Prandial", label: "Post-Prandial" },
                          ]}
                        />
                      </div>
                      <textarea placeholder="Notes..." value={sugarForm.notes} onChange={(e) => setSugarForm((p) => ({ ...p, notes: e.target.value }))} className="w-full min-h-14 text-sm" />
                      <div className="flex items-center gap-3">
                        <button onClick={() => saveBloodSugar()} disabled={savingSugar} className="self-start flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                          <Save size={15} /> {editingSugarId ? "Save Changes" : "Save Entry"}
                        </button>
                        {editingSugarId && (
                          <button onClick={cancelEditSugar} className="text-sm font-semibold text-muted-foreground hover:underline">
                            Cancel
                          </button>
                        )}
                      </div>
                    </>
                  )}
                  {chart && chart.bloodSugarChecks.length > 0 && (
                    <div className="flex flex-col gap-1.5 border-t border-border pt-3 max-h-32 overflow-y-auto">
                      {chart.bloodSugarChecks.slice(0, 5).map((s) => (
                        <div key={s.bloodSugarTaskId} className="group flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm">
                          <span className="font-medium">{s.sugarLevel} mg/dL · {s.type}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{formatDateTime(s.createdAt)}</span>
                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => startEditSugar(s)} title="Edit" className="p-1 hover:bg-primary/10 rounded-full text-primary">
                                <Pencil size={12} />
                              </button>
                              <button onClick={() => removeSugarRecord(s)} title="Delete" className="p-1 hover:bg-destructive/10 rounded-full text-destructive">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>


            {canEdit && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Allergies — write-only here; already shown in the "Known Allergies" box in the
                    header card above. Same fields as the Doctor Workbench's allergy form, so a
                    nurse-recorded allergy carries the same clinical detail as a doctor-recorded one.
                    "Correct" up in the header scrolls here and flashes the border (allergySectionFlash)
                    so the nurse can find this section immediately. */}
                <div
                  ref={allergySectionRef}
                  className={`card p-6 flex flex-col gap-4 ${allergySectionFlash ? "animate-section-flash" : ""}`}
                >
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <AlertTriangle size={18} className="text-primary" /> {editingAllergyId ? "Correct Allergy Entry" : "Allergies"}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Allergy Category <span className="text-destructive">*</span></label>
                      <SearchableSelect
                        value={allergyForm.allergyCategory}
                        onChange={(v) => setAllergyForm((p) => ({ ...p, allergyCategory: v, substance: "" }))}
                        options={[
                          { value: "", label: "Select category" },
                          ...withCurrentOption(ALLERGY_CATEGORIES, allergyForm.allergyCategory).map((s) => ({ value: s, label: s })),
                        ]}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Allergen <span className="text-destructive">*</span></label>
                      <SearchableSelect
                        value={allergyForm.substance}
                        onChange={(v) => setAllergyForm((p) => ({ ...p, substance: v }))}
                        disabled={!allergyForm.allergyCategory}
                        options={[
                          { value: "", label: "Select allergen" },
                          ...withCurrentOption(ALLERGENS_BY_CATEGORY[allergyForm.allergyCategory] ?? [], allergyForm.substance).map((s) => ({ value: s, label: s })),
                        ]}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Severity</label>
                      <SearchableSelect
                        value={allergyForm.severity}
                        onChange={(v) => setAllergyForm((p) => ({ ...p, severity: v }))}
                        options={[
                          { value: "", label: "Select severity" },
                          ...withCurrentOption(SEVERITIES, allergyForm.severity).map((s) => ({ value: s, label: s })),
                        ]}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Reaction</label>
                      <SearchableSelect
                        value={allergyForm.reaction}
                        onChange={(v) => setAllergyForm((p) => ({ ...p, reaction: v }))}
                        options={[
                          { value: "", label: "Select reaction" },
                          ...withCurrentOption(REACTIONS, allergyForm.reaction).map((s) => ({ value: s, label: s })),
                        ]}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Identified Date</label>
                      <div className="mt-1">
                        <DatePicker
                          value={allergyForm.identifiedDate}
                          onChange={(v) => setAllergyForm((p) => ({ ...p, identifiedDate: v }))}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Status</label>
                      <SearchableSelect
                        value={allergyForm.status}
                        onChange={(v) => setAllergyForm((p) => ({ ...p, status: v }))}
                        options={withCurrentOption(ALLERGY_STATUSES, allergyForm.status).map((s) => ({ value: s, label: s }))}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Remarks</label>
                    <textarea
                      rows={2}
                      placeholder="Additional clinical notes…"
                      value={allergyForm.remarks}
                      onChange={(e) => setAllergyForm((p) => ({ ...p, remarks: e.target.value }))}
                      className="text-sm resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={saveAllergy} disabled={savingAllergy} className="self-start flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                      <Save size={15} /> {editingAllergyId ? "Save Correction" : "Add Allergy"}
                    </button>
                    {editingAllergyId && (
                      <button onClick={cancelEditAllergy} className="text-sm font-semibold text-muted-foreground hover:underline">
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Special Remarks — write-only here; already shown as chips in the header card above */}
                <div className="card p-6 flex flex-col gap-4">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Flag size={18} className="text-primary" /> Special Remark
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SearchableSelect
                      value={remarkForm.remarkType}
                      onChange={(v) => setRemarkForm((p) => ({ ...p, remarkType: v }))}
                      options={REMARK_TYPES.map((type) => ({ value: type, label: type }))}
                    />
                    <input type="text" placeholder="Description" value={remarkForm.description} onChange={(e) => setRemarkForm((p) => ({ ...p, description: e.target.value }))} className="h-10 text-sm" />
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={saveSpecialRemark} disabled={savingRemark} className="self-start flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                      <Save size={15} /> {editingRemarkId ? "Save Changes" : "Add Remark"}
                    </button>
                    {editingRemarkId && (
                      <button onClick={cancelEditRemark} className="text-sm font-semibold text-muted-foreground hover:underline">
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Nurse Notes + Medical Forms */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6 flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <FileText size={18} className="text-primary" /> Nurse Notes
              </h2>
              {canEdit && (
                <>
                  <RichTextEditor value={nurseNoteHtml} onChange={setNurseNoteHtml} placeholder="Structured note with formatting..." />
                  <div className="flex items-center gap-3">
                    <ToggleButton checked={nurseNoteConfidential} onChange={setNurseNoteConfidential} />
                    <span className="flex items-center gap-1.5 text-sm">
                      <Lock size={13} className="text-muted-foreground" /> Mark as confidential (visible only to me)
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={saveNurseNote} disabled={savingNurseNote} className="self-start flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                      <Save size={15} /> {editingNurseNoteId ? "Save Changes" : nurseNoteConfidential ? "Save Confidentially" : "Save Note"}
                    </button>
                    {editingNurseNoteId && (
                      <button onClick={cancelEditNurseNote} className="text-sm font-semibold text-muted-foreground hover:underline">
                        Cancel
                      </button>
                    )}
                  </div>
                </>
              )}

              {chart && chart.nurseNotes.length > 0 && (
                <div className="flex flex-col gap-1.5 border-t border-border pt-3 max-h-40 overflow-y-auto">
                  {chart.nurseNotes.slice(0, 5).map((n) => (
                    <div key={n.nurseNoteId} className="group rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm">
                      <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: n.contentHtml }} />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{n.nurseName || "Nurse"} · {formatDateTime(n.createdAt)}</span>
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEditNurseNote(n)} title="Edit" className="p-1 hover:bg-primary/10 rounded-full text-primary">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => removeNurseNote(n)} title="Delete" className="p-1 hover:bg-destructive/10 rounded-full text-destructive">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <PatientMedicalFormsSection
              patientId={selectedPatientId}
              visitId={currentVisitId}
              patientName={summary?.name}
              patientNumber={summary?.opNumber || summary?.opId}
            />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Treatments ordered by the doctor — nurse Starts it (locks the doctor out of
                  editing), Marks it Done, or Reverts a start back to Pending to hand editing
                  back to the doctor. Gear icon opens the same config popup the doctor uses,
                  read-only here. */}
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
                          <div className="flex shrink-0 items-center gap-1.5">
                            {t.status === "Pending" &&
                              (canEdit ? (
                                <button
                                  onClick={() => startTreatment(t.treatmentId)}
                                  disabled={markingTreatmentId === t.treatmentId}
                                  className="flex items-center gap-1 bg-primary/10 hover:bg-primary/20 disabled:opacity-50 text-primary font-semibold py-1 px-2 rounded-lg text-xs transition-colors"
                                >
                                  <PlayCircle size={13} /> Start
                                </button>
                              ) : (
                                <span className="rounded-full bg-amber-100 text-amber-700 text-xs px-2 py-0.5 font-semibold">Pending</span>
                              ))}
                            {t.status === "InProgress" &&
                              (canEdit ? (
                                <>
                                  <button
                                    onClick={() => markTreatmentDone(t.treatmentId)}
                                    disabled={markingTreatmentId === t.treatmentId}
                                    className="flex items-center gap-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-1 px-2 rounded-lg text-xs transition-colors"
                                  >
                                    <CheckCircle2 size={13} /> Mark Done
                                  </button>
                                  <button
                                    onClick={() => revertTreatment(t.treatmentId)}
                                    disabled={markingTreatmentId === t.treatmentId}
                                    title="Undo start — hand editing back to the doctor"
                                    className="flex items-center justify-center rounded-lg p-1 text-muted-foreground hover:bg-muted disabled:opacity-50"
                                  >
                                    <Undo2 size={13} />
                                  </button>
                                </>
                              ) : (
                                <span className="rounded-full bg-blue-100 text-blue-700 text-xs px-2 py-0.5 font-semibold">In progress</span>
                              ))}
                            {t.status === "Done" && (
                              <span className="rounded-full bg-green-100 text-green-700 text-xs px-2 py-0.5 font-semibold">Done</span>
                            )}
                            <button
                              onClick={() => setViewingTreatment(t)}
                              title="Configuration"
                              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            >
                              <Settings size={13} />
                            </button>
                          </div>
                        </div>
                        {t.status === "InProgress" && t.startedByName && (
                          <p className="text-xs text-muted-foreground mt-1">
                            started by {t.startedByName} · {formatDateTime(t.startedAt)}
                          </p>
                        )}
                        {t.status === "Done" && (
                          <p className="text-xs text-muted-foreground mt-1">
                            by {t.doneByName || "nurse"} · {formatDateTime(t.doneAt)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState size="compact" illustration="clipboard" title="No treatments ordered" />
                )}
              </div>

              {/* Lab/Radiology orders — read-only here (sample collection happens on the Lab
                  workbench itself); shows the doctor's configuration for reviewing. */}
              <div className="card p-6 flex flex-col gap-4">
                <h2 className={`text-lg font-semibold text-foreground flex items-center gap-2 ${pendingInvestigationCount > 0 ? "animate-pulse" : ""}`}>
                  <FlaskConical size={18} className="text-primary" /> Investigations
                </h2>
                {summary ? (
                  <div className="max-h-64 overflow-y-auto">
                    <OrderedItemsList
                      labRequests={summary.labRequests}
                      radiologyRequests={summary.radiologyRequests}
                      treatments={[]}
                      onOpenLab={(item) => setViewingLabRequest(item)}
                      onOpenRadiology={(item) => setViewingRadiologyRequest(item)}
                      onOpenTreatment={() => {}}
                      emptyMessage="No investigations ordered"
                      emptyIllustration="lab"
                    />
                  </div>
                ) : (
                  <EmptyState size="compact" illustration="lab" title="No investigations ordered" />
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
                      <input type="number" min="0" placeholder="Volume (ml)" value={ivForm.volume} onChange={(e) => setIvForm((p) => ({ ...p, volume: e.target.value.replace(/-/g, "") }))} className="h-10 text-sm" />
                      <input type="number" min="0" placeholder="Rate (ml/hr)" value={ivForm.rate} onChange={(e) => setIvForm((p) => ({ ...p, rate: e.target.value.replace(/-/g, "") }))} className="h-10 text-sm" />
                    </div>
                    <textarea placeholder="Notes..." value={ivForm.notes} onChange={(e) => setIvForm((p) => ({ ...p, notes: e.target.value }))} className="w-full min-h-14 text-sm" />
                    <div className="flex items-center gap-3">
                      <button onClick={() => saveIVFluids()} disabled={savingIv} className="self-start flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                        <Save size={15} /> {editingIvId ? "Save Changes" : "Save Entry"}
                      </button>
                      {editingIvId && (
                        <button onClick={cancelEditIv} className="text-sm font-semibold text-muted-foreground hover:underline">
                          Cancel
                        </button>
                      )}
                    </div>
                  </>
                )}
                {chart && chart.ivFluids.length > 0 && (
                  <div className="flex flex-col gap-1.5 border-t border-border pt-3 max-h-32 overflow-y-auto">
                    {chart.ivFluids.slice(0, 5).map((f) => (
                      <div key={f.ivFluidsTaskId} className="group flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm">
                        <span className="font-medium">{f.fluidType} · {f.volume}ml @ {f.rate}ml/hr</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{formatDateTime(f.createdAt)}</span>
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEditIv(f)} title="Edit" className="p-1 hover:bg-primary/10 rounded-full text-primary">
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => removeIvRecord(f)} title="Delete" className="p-1 hover:bg-destructive/10 rounded-full text-destructive">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
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
                              <SearchableSelect
                                value={administerForm.route}
                                onChange={(v) => setAdministerForm((p) => ({ ...p, route: v }))}
                                options={[
                                  { value: "Oral (PO)", label: "Oral (PO)" },
                                  { value: "Intravenous (IV)", label: "Intravenous (IV)" },
                                  { value: "Intramuscular (IM)", label: "Intramuscular (IM)" },
                                  { value: "Subcutaneous (SC)", label: "Subcutaneous (SC)" },
                                  { value: "Topical", label: "Topical" },
                                ]}
                              />
                            </div>
                            <input type="text" placeholder="Remarks (optional)" value={administerForm.remarks} onChange={(ev) => setAdministerForm((p) => ({ ...p, remarks: ev.target.value }))} className="h-9 text-sm" />

                            {m.isHighRisk && (
                              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 flex flex-col gap-2">
                                <p className="text-xs font-semibold text-destructive flex items-center gap-1">
                                  <ShieldAlert size={12} /> High-risk medication — a second nurse must witness this
                                </p>
                                <SearchableSelect
                                  value={administerForm.witnessUserId}
                                  onChange={(v) => setAdministerForm((p) => ({ ...p, witnessUserId: v }))}
                                  options={[
                                    { value: "", label: "Select witnessing nurse" },
                                    ...nurses.filter((n) => n.id !== currentUserId).map((n) => ({ value: n.id, label: n.name })),
                                  ]}
                                />
                                <PasswordInput
                                  placeholder="Witness's password"
                                  value={administerForm.witnessPassword}
                                  onChange={(ev) => setAdministerForm((p) => ({ ...p, witnessPassword: ev.target.value }))}
                                  className="h-9 text-sm w-full"
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
                  <EmptyState size="compact" illustration="pharmacy" title="No active prescriptions" />
                )}
              </div>
            </div>

          </div>
        )}

        {encounterLock && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
            <div className="card w-full max-w-sm rounded-xl border border-border p-6 shadow-2xl mx-4">
              <h2 className="text-lg font-semibold text-foreground">Encounter Closed</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                This encounter has already been sent to the doctor. Enter your password to continue editing it.
              </p>
              <PasswordInput
                autoFocus
                autoComplete="new-password"
                value={encounterLockPassword}
                onChange={(e) => setEncounterLockPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmEncounterLockPassword()}
                placeholder="Your password"
              />
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setEncounterLock(null);
                    setEncounterLockPassword("");
                  }}
                  className="w-1/3 border border-border text-muted-foreground font-semibold py-2.5 rounded-lg hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmEncounterLockPassword}
                  disabled={submittingEncounterLock || !encounterLockPassword.trim()}
                  className="w-full bg-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-semibold py-2.5 rounded-lg transition-colors"
                >
                  {submittingEncounterLock ? "Verifying..." : "Confirm & Save"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Patient Documents modal */}
        {showDocumentsModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <FileText size={18} className="text-primary" /> Patient Documents
                  {documents.length > 0 && (
                    <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {documents.length}
                    </span>
                  )}
                </h2>
                <button
                  onClick={() => setShowDocumentsModal(false)}
                  className="p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="overflow-y-auto flex-1 p-5">
                {documents.length === 0 ? (
                  <EmptyState illustration="documents" title="No documents available for this patient yet" />
                ) : (
                  <div className="flex flex-col gap-2">
                    {documents.map((d) => {
                      const fileUrl = backendAssetUrl(d.filePath);
                      const ext = d.filePath?.split(".").pop()?.toLowerCase() ?? "";
                      const isImage = PREVIEWABLE_IMAGE_EXTS.includes(ext);
                      const isPdf = ext === "pdf";
                      const isPreviewable = isImage || isPdf;
                      return (
                          <div
                            key={d.patientDocumentId}
                            className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-3 transition-colors ${
                              !d.viewedByNurse
                                ? "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20"
                                : "border-border bg-muted/20"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold uppercase ${
                                isPdf ? "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400" :
                                isImage ? "bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400" :
                                "bg-muted text-muted-foreground"
                              }`}>
                                {isPdf ? "PDF" : isImage ? "IMG" : ext.toUpperCase() || "?"}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{d.documentType}</p>
                                <p className="text-xs text-muted-foreground">{formatDateTime(d.createdAt)}</p>
                              </div>
                              {!d.viewedByNurse && (
                                <span className="shrink-0 rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white">NEW</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {fileUrl ? (
                                <>
                                  <button
                                    onClick={() => openDocument(d, fileUrl, ext)}
                                    className="flex items-center gap-1 rounded-lg bg-primary/10 hover:bg-primary/20 px-3 py-1.5 text-xs font-semibold text-primary transition-colors"
                                  >
                                    {isPreviewable ? "Preview" : (<><Download size={12} /> Download</>)}
                                  </button>
                                  {isPreviewable && (
                                    <button
                                      onClick={() => downloadDocument(fileUrl, d.documentType)}
                                      title="Download"
                                      className="flex items-center gap-1 rounded-lg border border-border hover:bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition-colors"
                                    >
                                      <Download size={12} />
                                    </button>
                                  )}
                                </>
                              ) : (
                                !d.viewedByNurse && (
                                  <button onClick={() => markDocumentViewed(d.patientDocumentId)} className="text-xs font-semibold text-primary hover:underline">
                                    Mark reviewed
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Upload section */}
              <div className="px-5 py-4 border-t border-border flex flex-col gap-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Upload size={12} /> Attach Document
                </p>
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="min-w-32">
                    <SearchableSelect
                      value={uploadDocType}
                      onChange={setUploadDocType}
                      options={[
                        { value: "Report", label: "Report" },
                        { value: "Lab Result", label: "Lab Result" },
                        { value: "Radiology Image", label: "Radiology Image" },
                        { value: "Prescription", label: "Prescription" },
                        { value: "Referral Letter", label: "Referral Letter" },
                        { value: "Insurance", label: "Insurance" },
                        { value: "Other", label: "Other" },
                      ]}
                    />
                  </div>
                  <label className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted cursor-pointer transition-colors">
                    <Upload size={13} />
                    {uploadDocFile ? uploadDocFile.name : "Choose file"}
                    <input type="file" className="hidden" onChange={(e) => setUploadDocFile(e.target.files?.[0] ?? null)} />
                  </label>
                  {uploadDocFile && (
                    <button
                      onClick={handleUploadDocument}
                      disabled={isUploadingDoc}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      {isUploadingDoc ? "Uploading…" : "Upload"}
                    </button>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-border flex justify-end">
                <button
                  onClick={() => setShowDocumentsModal(false)}
                  className="rounded-lg border border-border px-5 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    );
  }

  // ==================== WORKBENCH ====================
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between px-4 sm:px-10 py-4 border-b border-border">
        <div>
          <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
            <HeartPulse className="text-primary" /> Nurse Workbench
          </h1>
          <p className="text-sm text-muted-foreground">
            Every patient across all doctors is visible here — open a chart to record vitals and care.
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-56 shrink-0">
              <label htmlFor="workbench-acting-nurse" className="mb-1 block text-xs font-semibold text-muted-foreground">
                Acting nurse
              </label>
              <SearchableSelect
                id="workbench-acting-nurse"
                value={selectedNurseId}
                onChange={setSelectedNurseId}
                className={standaloneSelectClass}
                options={[
                  { value: "", label: "Select nurse…" },
                  ...nurses.map((n) => ({ value: n.id, label: n.name })),
                ]}
              />
            </div>
            <div className="w-56 shrink-0">
              <label htmlFor="workbench-acting-doctor" className="mb-1 block text-xs font-semibold text-muted-foreground">
                Acting doctor (for allergies)
              </label>
              <SearchableSelect
                id="workbench-acting-doctor"
                value={selectedDoctorId}
                onChange={setSelectedDoctorId}
                className={standaloneSelectClass}
                options={[
                  { value: "", label: "Select doctor…" },
                  ...assignedDoctors.map((d) => ({ value: String(d.doctorId), label: d.userName })),
                ]}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-10 py-6 sm:py-8">
      {isLoadingWorkbench ? (
        <div className="flex flex-col gap-6">
          <div className="card p-6">
            <div className="h-5 w-40 mb-4 animate-pulse rounded bg-muted/60" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-muted/50" />
              ))}
            </div>
          </div>
          <div className="card p-6">
            <div className="h-5 w-48 mb-4 animate-pulse rounded bg-muted/60" />
            <div className="flex flex-col gap-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/50" />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Untouched Patients - every checked-in visit no nurse has opened yet (see
              NursingController.GetUntouchedPatients). Opening one here (or from anywhere
              else - Patient Monitoring, Work Queue) advances it past "CheckedIn" and it
              drops off this grid live, no separate "start" step. Hidden entirely once empty
              so a quiet day doesn't leave a permanent empty box at the top of the page. */}
          {untouchedPatients.length > 0 && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-600" /> Untouched Patients
                </h2>
                <span className="text-xs font-semibold text-muted-foreground">
                  {untouchedPatients.length} waiting
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {untouchedPatients.slice(untouchedPage * PAGE_SIZE, (untouchedPage + 1) * PAGE_SIZE).map((p) => (
                  <div
                    key={p.visitId}
                    onClick={() => p.patientId && openPatient(p.patientId, p.visitId)}
                    className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 cursor-pointer hover:bg-muted/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm text-foreground truncate">{p.patientName || "Unknown patient"}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="rounded-full bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 font-semibold">
                          {p.visitType === "WalkIn" ? "Walk-in" : "Appointment"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p className="text-xs text-muted-foreground">
                        {p.age != null ? `${p.age}y` : "—"} {p.sex ? `· ${p.sex}` : ""}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-amber-700 font-semibold shrink-0">
                        <Clock size={12} /> {formatWaitingSince(p.checkedInAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {untouchedPatients.length > PAGE_SIZE && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    {untouchedPage * PAGE_SIZE + 1}–{Math.min((untouchedPage + 1) * PAGE_SIZE, untouchedPatients.length)} of {untouchedPatients.length}
                  </span>
                  <div className="flex gap-2">
                    <button disabled={untouchedPage === 0} onClick={() => setUntouchedPage(p => p - 1)} className="px-3 py-1 rounded-lg border border-border text-xs font-medium disabled:opacity-40 hover:bg-muted">Previous</button>
                    <button disabled={(untouchedPage + 1) * PAGE_SIZE >= untouchedPatients.length} onClick={() => setUntouchedPage(p => p + 1)} className="px-3 py-1 rounded-lg border border-border text-xs font-medium disabled:opacity-40 hover:bg-muted">Next</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<Users size={18} />} label="Patients Under Care" value={dashboard?.patientsUnderCare ?? 0} />
            <StatCard icon={<ClipboardList size={18} />} label="Pending Tasks" value={dashboard?.pendingTasks ?? 0} />
            <StatCard icon={<AlertTriangle size={18} />} label="Critical Alerts" value={dashboard?.criticalAlerts ?? 0} accent />
            <StatCard icon={<CheckCircle2 size={18} />} label="Completed Today" value={dashboard?.completedToday ?? 0} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card p-6">
              <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Users size={18} className="text-primary" /> Patient Monitoring
                </h2>
                <div className="flex items-center gap-2">
                  <div className="relative w-56 sm:w-64">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search by name, MRN, or doctor..."
                      value={searchTerm}
                      onChange={(e) => { setSearchTerm(e.target.value); setMonitoringPage(0); }}
                      className="w-full h-10 pl-9 text-sm"
                    />
                  </div>
                  {/* Filters by lastAppointmentDate (which can be a future scheduled visit,
                      not only a past one) - lets a nurse jump straight to a specific day
                      instead of only ever seeing everyone's single most recent visit. Shared
                      DatePicker (typeable + calendar), same dd-MM-yyyy convention as Date of
                      Birth on Patient Entry - not the native browser date input. */}
                  <DatePicker
                    value={dateFilter}
                    onChange={(v) => { setDateFilter(v); setMonitoringPage(0); }}
                    dateFormat="dd-MM-yyyy"
                    placeholder="DD-MM-YYYY"
                    className="flex h-10 w-36 items-center justify-between gap-2 rounded-lg border border-border bg-(--color-highlight) px-3 text-left text-sm text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  {dateFilter && (
                    <button
                      type="button"
                      onClick={() => setDateFilter("")}
                      title="Clear date filter"
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  )}
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
                    {isLoadingPatientsByDate ? (
                      [...Array(4)].map((_, i) => (
                        <tr key={i}>
                          {[...Array(5)].map((_, j) => (
                            <td key={j}><div className="h-4 animate-pulse rounded bg-muted/50" /></td>
                          ))}
                        </tr>
                      ))
                    ) : filteredPatients.length > 0 ? (
                      filteredPatients.slice(monitoringPage * PAGE_SIZE, (monitoringPage + 1) * PAGE_SIZE).map((p) => (
                        <tr key={p.opId}>
                          <td className="font-mono text-xs">{p.opNumber || p.opId}</td>
                          <td className="font-semibold">{p.name}</td>
                          <td>{p.assignedDoctorName || "—"}</td>
                          <td
                            className={p.lastAppointmentDate ? "cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-4" : undefined}
                            title={
                              p.lastAppointmentDate
                                ? [
                                    `Doctor: ${p.assignedDoctorName || "—"}`,
                                    `Specialty: ${p.assignedSpecialtyName || "—"}`,
                                    `Chief complaint: ${p.chiefComplaint || "—"}`,
                                  ].join("\n")
                                : undefined
                            }
                          >
                            {formatVisitDate(p.lastAppointmentDate)}
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openPatient(p.opId)}
                                className="text-sm font-semibold text-primary hover:underline"
                              >
                                Open Chart
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5}>
                          <EmptyState size="compact" illustration="patients" title="No patients found" />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {filteredPatients.length > PAGE_SIZE && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    {monitoringPage * PAGE_SIZE + 1}–{Math.min((monitoringPage + 1) * PAGE_SIZE, filteredPatients.length)} of {filteredPatients.length}
                  </span>
                  <div className="flex gap-2">
                    <button disabled={monitoringPage === 0} onClick={() => setMonitoringPage(p => p - 1)} className="px-3 py-1 rounded-lg border border-border text-xs font-medium disabled:opacity-40 hover:bg-muted">Previous</button>
                    <button disabled={(monitoringPage + 1) * PAGE_SIZE >= filteredPatients.length} onClick={() => setMonitoringPage(p => p + 1)} className="px-3 py-1 rounded-lg border border-border text-xs font-medium disabled:opacity-40 hover:bg-muted">Next</button>
                  </div>
                </div>
              )}
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
              <div className="flex flex-col gap-3">
                {workQueue.length > 0 ? (
                  workQueue.slice(workQueuePage * PAGE_SIZE, (workQueuePage + 1) * PAGE_SIZE).map((item) => (
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
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <span className="rounded-full bg-amber-100 text-amber-700 text-xs px-2 py-0.5 font-semibold">
                            {item.priority && item.priority !== "Normal" && item.priority !== "Routine" ? item.priority : item.itemType}
                          </span>
                        </div>
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
                  <EmptyState size="compact" illustration="done" title="No pending work. Great job!" />
                )}
              </div>
              {workQueue.length > PAGE_SIZE && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    {workQueuePage * PAGE_SIZE + 1}–{Math.min((workQueuePage + 1) * PAGE_SIZE, workQueue.length)} of {workQueue.length}
                  </span>
                  <div className="flex gap-2">
                    <button disabled={workQueuePage === 0} onClick={() => setWorkQueuePage(p => p - 1)} className="px-3 py-1 rounded-lg border border-border text-xs font-medium disabled:opacity-40 hover:bg-muted">Previous</button>
                    <button disabled={(workQueuePage + 1) * PAGE_SIZE >= workQueue.length} onClick={() => setWorkQueuePage(p => p + 1)} className="px-3 py-1 rounded-lg border border-border text-xs font-medium disabled:opacity-40 hover:bg-muted">Next</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Read-only configuration views - Lab/Radiology/Treatment fields as the doctor set
          them, opened from the gear icon on each item above. Nursing's own actions
          (Start/Revert/Mark Done, Collect Sample on the Lab workbench) stay fully
          functional regardless; only these config fields are view-only here. */}
      {viewingTreatment && (
        <TreatmentConfigModal
          itemName={viewingTreatment.description}
          values={{
            quantity: String(viewingTreatment.quantity),
            instructions: viewingTreatment.instructions || "",
            isPackage: viewingTreatment.isPackage,
            isBillingPending: viewingTreatment.isBillingPending,
          }}
          readOnly
          submitLabel="Save changes"
          onSave={() => {}}
          onClose={() => setViewingTreatment(null)}
        />
      )}
      {viewingLabRequest && (
        <LabRadiologyConfigModal
          category="Lab"
          itemName={viewingLabRequest.testType || "Lab test"}
          values={{
            quantity: String(viewingLabRequest.quantity),
            priority: viewingLabRequest.priority,
            source: viewingLabRequest.source,
            remarks: viewingLabRequest.remarks || "",
            bodyParts: "",
            price: viewingLabRequest.price != null ? String(viewingLabRequest.price) : "",
            uccCode: viewingLabRequest.uccCode || "",
            covered: viewingLabRequest.covered === true ? "Yes" : viewingLabRequest.covered === false ? "No" : "",
            preAuthStatus: viewingLabRequest.preAuthStatus || "Not Required",
            patientShareAmount: viewingLabRequest.patientShareAmount != null ? String(viewingLabRequest.patientShareAmount) : "",
            coInsurancePercent: viewingLabRequest.coInsurancePercent != null ? String(viewingLabRequest.coInsurancePercent) : "",
          }}
          readOnly
          submitLabel="Save changes"
          onSave={() => {}}
          onClose={() => setViewingLabRequest(null)}
        />
      )}
      {viewingRadiologyRequest && (
        <LabRadiologyConfigModal
          category="Radiology"
          itemName={viewingRadiologyRequest.scanType || "Scan"}
          values={{
            quantity: String(viewingRadiologyRequest.quantity),
            priority: viewingRadiologyRequest.priority,
            source: viewingRadiologyRequest.source,
            remarks: viewingRadiologyRequest.notes || "",
            bodyParts: viewingRadiologyRequest.bodyParts || "",
            price: viewingRadiologyRequest.price != null ? String(viewingRadiologyRequest.price) : "",
            uccCode: viewingRadiologyRequest.uccCode || "",
            covered: viewingRadiologyRequest.covered === true ? "Yes" : viewingRadiologyRequest.covered === false ? "No" : "",
            preAuthStatus: viewingRadiologyRequest.preAuthStatus || "Not Required",
            patientShareAmount: viewingRadiologyRequest.patientShareAmount != null ? String(viewingRadiologyRequest.patientShareAmount) : "",
            coInsurancePercent: viewingRadiologyRequest.coInsurancePercent != null ? String(viewingRadiologyRequest.coInsurancePercent) : "",
          }}
          readOnly
          submitLabel="Save changes"
          onSave={() => {}}
          onClose={() => setViewingRadiologyRequest(null)}
        />
      )}

      </div>
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
