"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import EmptyState from "@/components/EmptyState";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  Bell,
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  FlaskConical,
  HeartPulse,
  History,
  Lock,
  NotebookPen,
  Pencil,
  Pill,
  Plus,
  Save,
  Search,
  Share2,
  Stethoscope,
  Stamp,
  StickyNote,
  Trash2,
  Unlock as UnlockIcon,
  Upload,
  Users,
  X,
} from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { notifySaveStatus } from "@/lib/saveStatus";
import DatePicker from "@/components/DatePicker";
import SearchableSelect, { standaloneSelectClass } from "@/components/SearchableSelect";
import CatalogSearchInput from "@/components/doctor/CatalogSearchInput";
import MedicationOrderPanel from "@/components/doctor/MedicationOrderPanel";
import OrderedItemsList from "@/components/orders/OrderedItemsList";
import LabRadiologyConfigModal, {
  DEFAULT_LAB_RADIOLOGY_VALUES,
  LabRadiologyConfigValues,
} from "@/components/orders/LabRadiologyConfigModal";
import TreatmentConfigModal, {
  DEFAULT_TREATMENT_VALUES,
  TreatmentConfigValues,
} from "@/components/orders/TreatmentConfigModal";
import PatientMedicalFormsSection from "@/components/medicalForms/PatientMedicalFormsSection";
import ReviewOfSystemsPanel, { ReviewOfSystemsValue } from "@/components/doctor/ReviewOfSystemsPanel";
import PrescriptionPrintout from "@/components/prescription/PrescriptionPrintout";
import FloatingSaveRevertBar from "@/components/FloatingSaveRevertBar";
import ToggleButton from "@/components/ToggleButton";
import VitalsHistoryModal from "@/components/VitalsHistoryModal";
import CorrectedFromNote from "@/components/CorrectedFromNote";
import FamilyHistorySection from "@/components/FamilyHistorySection";
import DentalChartSection from "@/components/dental/DentalChartSection";
import { getUserDetail } from "@/lib/userDetail";
import HintTooltip from "@/components/HintTooltip";
import { useCurrentEncounter } from "@/lib/currentEncounterContext";
import { backendAssetUrl } from "@/lib/backendAsset";
import { confirmDeleteToast } from "@/lib/confirmDeleteToast";
import PatientEmrModal from "@/components/PatientEmrModal";
import AdminPasswordConfirm from "@/components/AdminPasswordConfirm";
import HistoryDrawer from "@/components/HistoryDrawer";
import { EmrService } from "@/services/emr.service";
import { UserService } from "@/services/user.service";
import { SpecializationService } from "@/services/specialization.service";
import { LabService } from "@/services/lab.service";
import { RadiologyService } from "@/services/radiology.service";
import { TreatmentService } from "@/services/treatment.service";
import { ConfigListService } from "@/services/configList.service";
import { NursingService } from "@/services/nursing.service";
import {
  ActiveCaseItemType,
  AllergyPayload,
  AllergyType,
  ChronicConditionType,
  DoctorConfidentialNoteType,
  DoctorDashboardSummaryType,
  EmrPatientListItem,
  EncounterCorrectionType,
  EncounterListItemType,
  EncounterUnlockRequestType,
  FollowUpType,
  MedicationPayload,
  MedicationType,
  PatientInsuranceCoverageType,
  PatientSummaryType,
  QuickNoteType,
  ReferralType,
  SpecialRemarkType,
  TodayScheduleItemType,
} from "@/types/emr.type";
import { VitalsHistoryEntryType, NurseNoteType, ExaminationNoteType } from "@/types/nursing.type";
import { AssignedDoctorsInfo } from "@/types/assignedDoctors.type";
import { SpecializationTypes } from "@/types/specialization.type";
import { UserType } from "@/types/user.type";
import { LabRequestType } from "@/types/lab.type";
import { RadiologyRequestType } from "@/types/radiology.type";
import { TreatmentType } from "@/types/treatment.type";
import { ListItemType } from "@/types/configList.type";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";

const errorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.message || fallback : fallback;

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString() : "—";

const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : "—";

function DoctorWorkbenchInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const visitIdParam = searchParams.get("visitId") || undefined;
  const initialPatientIdParam = searchParams.get("patientId") || undefined;
  const { setCurrentEncounter, setReopenState } = useCurrentEncounter();

  const [activeVisitId, setActiveVisitId] = useState<string | undefined>(visitIdParam);
  const [role, setRole] = useState<string | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);

  const [assignedDoctors, setAssignedDoctors] = useState<AssignedDoctorsInfo[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");

  const [showPrescriptionPrint, setShowPrescriptionPrint] = useState(false);

  const [dashboard, setDashboard] = useState<DoctorDashboardSummaryType | null>(null);
  const [schedule, setSchedule] = useState<TodayScheduleItemType[]>([]);
  const [scheduleDate, setScheduleDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [scheduleSearch, setScheduleSearch] = useState("");
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [scheduleNow, setScheduleNow] = useState(() => Date.now());
  const [activeCases, setActiveCases] = useState<ActiveCaseItemType[]>([]);
  const [patients, setPatients] = useState<EmrPatientListItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [patientsPage, setPatientsPage] = useState(1);
  const [isLoadingWorkbench, setIsLoadingWorkbench] = useState(true);

  const [emrModal, setEmrModal] = useState<{ patientId: string; patientName: string } | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [summary, setSummary] = useState<PatientSummaryType | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [rosExpanded, setRosExpanded] = useState(false);
  const [patientAlertText, setPatientAlertText] = useState("");
  const [isSavingAlert, setIsSavingAlert] = useState(false);
  const [patientWarningModal, setPatientWarningModal] = useState<{ allergies: AllergyType[]; alertText: string } | null>(null);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pastMedicalHistory, setPastMedicalHistory] = useState("");
  const [pastSurgicalHistory, setPastSurgicalHistory] = useState("");
  const [pastTreatmentHistory, setPastTreatmentHistory] = useState("");
  const [socialHistory, setSocialHistory] = useState("");
  const [isSavingHistory, setIsSavingHistory] = useState(false);
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Date.now() can't be called during render (React treats it as impure) - computed instead
  // in the "Print Prescription" click handler below, where reading the clock is allowed.
  const [patientAgeForPrint, setPatientAgeForPrint] = useState<number | null>(null);

  const [specializations, setSpecializations] = useState<SpecializationTypes[]>([]);
  const [quickNotes, setQuickNotes] = useState<QuickNoteType[]>([]);
  const [confidentialNotes, setConfidentialNotes] = useState<DoctorConfidentialNoteType[]>([]);
  // Merged Triage + VitalsRecord timeline (see NursingController.GetVitalsHistory's own
  // comment on why the two needed combining) - newest first, so [0] is "latest vitals".
  const [vitalsHistory, setVitalsHistory] = useState<VitalsHistoryEntryType[]>([]);
  const [showVitalsHistory, setShowVitalsHistory] = useState(false);
  const latestVitals = vitalsHistory[0] ?? null;
  // Nurse-entered data for the open patient - surfaced here instead of doctor needing a
  // separate "Nurse Workbench" module (removed from their sidebar; see helpers/sidebaritems.ts).
  const [nurseSpecialRemarks, setNurseSpecialRemarks] = useState<SpecialRemarkType[]>([]);
  const [nurseNotes, setNurseNotes] = useState<NurseNoteType[]>([]);
  const [nurseExaminationNotes, setNurseExaminationNotes] = useState<ExaminationNoteType[]>([]);

  const isAdmin = role === "admin";
  const doctorIdParam = isAdmin ? selectedDoctorId || undefined : undefined;

  // Admin can browse "All doctors" read-only, but every write endpoint requires a real
  // doctorId server-side (EmrController.ResolveDoctorScopeAsync with requireForAdmin:true) —
  // without this guard, writing while "All doctors" is selected fails with a raw
  // "doctorId is required" 400 that looks like a broken app rather than a missing selection.
  const requireDoctorSelected = () => {
    if (isAdmin && !selectedDoctorId) {
      toast.error("Select a doctor first — you're viewing across all doctors.");
      return false;
    }
    return true;
  };

  // ---------------- ROLE GUARD ----------------
  useEffect(() => {
    const detail = JSON.parse(localStorage.getItem("yoton_user_detail") || "{}");
    const currentRole = (detail.role || "").toLowerCase();
    const allowedModules: string[] = detail.allowedModules || [];
    if (currentRole !== "admin" && !allowedModules.includes("/doctor")) {
      router.replace("/");
      return;
    }
    setRole(currentRole);
    setCheckedAuth(true);
  }, [router]);

  // ---------------- ADMIN DOCTOR PICKER ----------------
  useEffect(() => {
    if (!checkedAuth || !isAdmin) return;
    UserService.get_assigned_doctors()
      .then((res) => setAssignedDoctors(res.data || []))
      .catch(() => toast.error("Failed to load doctor list"));
  }, [checkedAuth, isAdmin]);

  // ---------------- WORKBENCH DATA ----------------
  const loadSchedule = async (date: string) => {
    try {
      setIsLoadingSchedule(true);
      const res = await EmrService.getTodaySchedule(doctorIdParam, date);
      setSchedule(res.data || []);
    } catch {
      toast.error("Failed to load schedule");
    } finally {
      setIsLoadingSchedule(false);
    }
  };

  const fetchWorkbench = async () => {
    try {
      setIsLoadingWorkbench(true);
      const [dashboardRes, scheduleRes, activeCasesRes, patientsRes] = await Promise.all([
        EmrService.getDashboardSummary(doctorIdParam),
        EmrService.getTodaySchedule(doctorIdParam, scheduleDate),
        EmrService.getActiveCases(doctorIdParam),
        EmrService.getPatients(doctorIdParam),
      ]);
      setDashboard(dashboardRes.data || null);
      setSchedule(scheduleRes.data || []);
      setActiveCases(activeCasesRes.data || []);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedAuth, selectedDoctorId]);

  useEffect(() => {
    if (!checkedAuth || isLoadingWorkbench) return;
    loadSchedule(scheduleDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleDate]);

  useEffect(() => {
    const id = setInterval(() => setScheduleNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  function formatWait(checkedInAt: string | null): string {
    if (!checkedInAt) return "—";
    const mins = Math.floor((scheduleNow - new Date(checkedInAt).getTime()) / 60_000);
    if (mins < 1) return "< 1 min";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  }

  useSignalRRefetch(
    [
      "appointmentCreated",
      "appointmentCancelled",
      "appointmentStatusUpdated",
      "visitCheckedIn",
      "visitStatusUpdated",
      "encounterSaved",
      "encounterFinished",
      "labStatusUpdated",
      "radiologyStatusUpdated",
    ],
    fetchWorkbench
  );

  useEffect(() => {
    if (!checkedAuth) return;
    SpecializationService.getAll()
      .then((data) => setSpecializations(Array.isArray(data) ? data.filter((s: SpecializationTypes) => s.isActive) : []))
      .catch(() => toast.error("Failed to load specialties"));
  }, [checkedAuth]);

  // ---------------- EXTERNAL DOCUMENTS ----------------
  type DocumentItem = { patientDocumentId: string; documentType: string; filePath: string | null; viewedByDoctor: boolean; createdAt: string };
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [unviewedDocumentCount, setUnviewedDocumentCount] = useState(0);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [uploadDocFile, setUploadDocFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState("Report");
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);

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

  // ---------------- PATIENT SUMMARY (EMR PANEL) ----------------
  const openPatient = async (patientId: string, visitId?: string | null) => {
    // Push to browser history so the back button returns to the workbench list.
    // Skip if the URL already reflects this patient (opened via URL param).
    if (patientId !== initialPatientIdParam) {
      const params = new URLSearchParams();
      params.set("patientId", patientId);
      if (visitId) params.set("visitId", visitId);
      router.push(`${pathname}?${params.toString()}`);
    }
    setActiveVisitId(visitId != null ? visitId : undefined);
    setSelectedPatientId(patientId);
    const [loadedSummary] = await Promise.all([
      fetchSummary(patientId, visitId ?? undefined),
      fetchQuickNotes(patientId),
      fetchDocuments(patientId),
      fetchConfidentialNotes(patientId),
      fetchLatestVitals(patientId),
    ]);
    setCurrentEncounter(patientId, loadedSummary?.latestEncounter?.encounterId ?? null, visitId ?? null);
    const hasAlert = loadedSummary?.patientAlert?.trim();
    const hasAllergies = (loadedSummary?.allergies?.length ?? 0) > 0;
    if (hasAlert || hasAllergies) {
      setPatientWarningModal({
        allergies: loadedSummary?.allergies ?? [],
        alertText: loadedSummary?.patientAlert ?? "",
      });
    }
  };

  const fetchSummary = async (patientId: string, overrideVisitId?: string): Promise<PatientSummaryType | null> => {
    try {
      setIsLoadingSummary(true);
      const res = await EmrService.getPatientSummary(patientId, doctorIdParam, overrideVisitId ?? activeVisitId);
      setSummary(res.data);
      setPatientAlertText(res.data?.patientAlert ?? "");
      setPastMedicalHistory(res.data?.pastMedicalHistory ?? "");
      setPastSurgicalHistory(res.data?.pastSurgicalHistory ?? "");
      setPastTreatmentHistory(res.data?.pastTreatmentHistory ?? "");
      setSocialHistory(res.data?.socialHistory ?? "");
      return res.data ?? null;
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load patient summary"));
      setSummary(null);
      setPatientAlertText("");
      setPastMedicalHistory("");
      setPastSurgicalHistory("");
      setPastTreatmentHistory("");
      setSocialHistory("");
      return null;
    } finally {
      setIsLoadingSummary(false);
    }
  };

  // Nursing already records this and doctors are read-authorized on the same chart
  // endpoint (NursingController class-level [Authorize]) — reused here rather than
  // duplicating capture on the doctor side. Pulls the full nursing chart, not just vitals,
  // so nurse notes/special remarks/examination notes for this patient are visible inline
  // in the doctor's own patient panel instead of requiring a separate module. Vitals
  // themselves come from the separate merged history endpoint instead of this chart's own
  // (VitalsRecord-only) list, so a nurse's Triage-recorded intake vitals count as "latest"
  // too when they're more recent than any VitalsRecord entry.
  const fetchLatestVitals = async (patientId: string) => {
    try {
      const [chartRes, vitalsHistoryRes] = await Promise.all([
        NursingService.getPatientChart(patientId),
        NursingService.getVitalsHistory(patientId),
      ]);
      setVitalsHistory(vitalsHistoryRes.data || []);
      setNurseSpecialRemarks(chartRes.data?.specialRemarks || []);
      setNurseNotes(chartRes.data?.nurseNotes || []);
      setNurseExaminationNotes(chartRes.data?.examinationNotes || []);
    } catch {
      setVitalsHistory([]);
      setNurseSpecialRemarks([]);
      setNurseNotes([]);
      setNurseExaminationNotes([]);
    }
  };

  const fetchQuickNotes = async (patientId: string) => {
    try {
      const res = await EmrService.getQuickNotes(doctorIdParam, patientId);
      setQuickNotes(res.data || []);
    } catch {
      setQuickNotes([]);
    }
  };

  const fetchConfidentialNotes = async (patientId: string) => {
    try {
      const res = await EmrService.getConfidentialNotes(patientId);
      setConfidentialNotes(res.data || []);
    } catch {
      setConfidentialNotes([]);
    }
  };

  const backToWorkbench = async () => {
    // Flush any pending auto-save before clearing state — the effect cleanup would
    // clearTimeout on the timer, silently dropping edits made in the last 3 seconds.
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    if (selectedPatientId && !isCompletedEncounter && summary?.latestEncounter &&
        JSON.stringify(encounterForm) !== lastSavedFormRef.current) {
      notifySaveStatus("saving");
      try {
        await EmrService.upsertEncounter(
          selectedPatientId,
          { ...encounterForm, visitId: activeVisitId },
          doctorIdParam
        );
        notifySaveStatus("saved");
      } catch {
        notifySaveStatus("error");
      }
    }
    setActiveVisitId(undefined);
    setSelectedPatientId(null);
    setCurrentEncounter(null, null, null);
    setSummary(null);
    setPatientAlertText("");
    setPastMedicalHistory("");
    setPastSurgicalHistory("");
    setPastTreatmentHistory("");
    setSocialHistory("");
    setPatientWarningModal(null);
    setShowDocumentsModal(false);
    setQuickNotes([]);
    setConfidentialNotes([]);
    setVitalsHistory([]);
    setNurseSpecialRemarks([]);
    setNurseNotes([]);
    setNurseExaminationNotes([]);
    fetchWorkbench();
    // Clear URL params so browser back/forward history stays consistent.
    if (initialPatientIdParam) router.push(pathname);
  };

  // Arriving from the reception visit queue (?patientId=&visitId=) opens that patient's
  // EMR panel directly instead of landing on the workbench list.
  useEffect(() => {
    if (!checkedAuth) return;
    if (initialPatientIdParam) {
      openPatient(initialPatientIdParam, visitIdParam);
    } else if (selectedPatientId) {
      // URL params were cleared by the browser back button — return to workbench.
      setActiveVisitId(undefined);
      setSelectedPatientId(null);
      setCurrentEncounter(null, null, null);
      setSummary(null);
      setPatientAlertText("");
      setPastMedicalHistory("");
      setPastSurgicalHistory("");
      setPastTreatmentHistory("");
      setSocialHistory("");
      setPatientWarningModal(null);
      setShowDocumentsModal(false);
      setQuickNotes([]);
      setConfidentialNotes([]);
      setVitalsHistory([]);
      setNurseSpecialRemarks([]);
      setNurseNotes([]);
      setNurseExaminationNotes([]);
      fetchWorkbench();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedAuth, initialPatientIdParam]);

  // ---------------- ENCOUNTER FORM ----------------
  const emptyRos: ReviewOfSystemsValue = {
    rosConstitutional: "",
    rosEyeEarNoseMouthThroat: "",
    rosCardiovascular: "",
    rosRespiratory: "",
    rosGastroenterology: "",
    rosGenitourinary: "",
    rosMusculoskeletal: "",
    rosNeurological: "",
    rosPsychiatric: "",
    rosEndocrine: "",
    rosHematologic: "",
    rosAllergicImmunologic: "",
    rosIntegumentary: "",
  };

  const [encounterForm, setEncounterForm] = useState({
    chiefComplaint: "",
    diagnosisDescription: "",
    plannedProcedures: "",
    examinationNotes: "",
    clinicalExamination: "",
    ...emptyRos,
    currentManagementPlan: "",
    futureManagementPlan: "",
  });
  // Baseline the form is compared against to detect unsaved edits — only meaningful for
  // admin viewing a Completed (locked) encounter, where the floating Save/Revert bar and
  // the "propose correction" flow kick in instead of the normal direct save.
  const [encounterFormSnapshot, setEncounterFormSnapshot] = useState(encounterForm);
  const [isSavingEncounter, setIsSavingEncounter] = useState(false);
  const [isReleasingPatient, setIsReleasingPatient] = useState(false);
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedFormRef = useRef<string>("");

  const isCompletedEncounter = summary?.latestEncounter?.status === "Completed";
  const isEncounterDirty =
    isAdmin && isCompletedEncounter && JSON.stringify(encounterForm) !== JSON.stringify(encounterFormSnapshot);

  useEffect(() => {
    const e = summary?.latestEncounter;
    const loaded = {
      chiefComplaint: e?.chiefComplaint || "",
      diagnosisDescription: e?.diagnosisDescription || "",
      plannedProcedures: e?.plannedProcedures || "",
      examinationNotes: e?.examinationNotes || "",
      clinicalExamination: e?.clinicalExamination || "",
      rosConstitutional: e?.rosConstitutional || "",
      rosEyeEarNoseMouthThroat: e?.rosEyeEarNoseMouthThroat || "",
      rosCardiovascular: e?.rosCardiovascular || "",
      rosRespiratory: e?.rosRespiratory || "",
      rosGastroenterology: e?.rosGastroenterology || "",
      rosGenitourinary: e?.rosGenitourinary || "",
      rosMusculoskeletal: e?.rosMusculoskeletal || "",
      rosNeurological: e?.rosNeurological || "",
      rosPsychiatric: e?.rosPsychiatric || "",
      rosEndocrine: e?.rosEndocrine || "",
      rosHematologic: e?.rosHematologic || "",
      rosAllergicImmunologic: e?.rosAllergicImmunologic || "",
      rosIntegumentary: e?.rosIntegumentary || "",
      currentManagementPlan: e?.currentManagementPlan || "",
      futureManagementPlan: e?.futureManagementPlan || "",
    };
    setEncounterForm(loaded);
    setEncounterFormSnapshot(loaded);
    // Seed the last-saved baseline so the auto-save debounce doesn't fire immediately
    // after the encounter loads (nothing has actually changed yet).
    lastSavedFormRef.current = JSON.stringify(loaded);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    // Intentionally re-run only when the encounter identity changes, not on every field edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary?.latestEncounter?.encounterId]);

  // Auto-save: 3 s after the doctor stops editing, silently persist the encounter.
  // Only runs for active (non-completed) encounters with a patient selected.
  useEffect(() => {
    if (isCompletedEncounter || !selectedPatientId || !summary?.latestEncounter) return;
    const serialized = JSON.stringify(encounterForm);
    if (serialized === lastSavedFormRef.current) return; // nothing changed
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      if (JSON.stringify(encounterForm) === lastSavedFormRef.current) return;
      notifySaveStatus("saving");
      try {
        await EmrService.upsertEncounter(
          selectedPatientId,
          { ...encounterForm, visitId: activeVisitId },
          doctorIdParam
        );
        lastSavedFormRef.current = JSON.stringify(encounterForm);
        notifySaveStatus("saved");
      } catch {
        notifySaveStatus("error");
      }
    }, 3000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterForm]);

  // Warn the doctor before a browser refresh or tab close if they have unsaved encounter edits.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!selectedPatientId || isCompletedEncounter) return;
      if (JSON.stringify(encounterForm) !== lastSavedFormRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [selectedPatientId, isCompletedEncounter, encounterForm]);

  const saveEncounter = async () => {
    if (!selectedPatientId || !requireDoctorSelected()) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    notifySaveStatus("saving");
    try {
      setIsSavingEncounter(true);
      await EmrService.upsertEncounter(
        selectedPatientId,
        { ...encounterForm, visitId: activeVisitId },
        doctorIdParam
      );
      lastSavedFormRef.current = JSON.stringify(encounterForm);
      toast.success("Encounter saved");
      notifySaveStatus("saved");
      await fetchSummary(selectedPatientId);
    } catch (error) {
      notifySaveStatus("error");
      toast.error(errorMessage(error, "Failed to save encounter"));
    } finally {
      setIsSavingEncounter(false);
    }
  };

  const revertEncounterForm = () => setEncounterForm(encounterFormSnapshot);

  const releasePatient = async (password: string) => {
    if (!activeVisitId) return;
    setIsReleasingPatient(true);
    try {
      await EmrService.releaseVisit(activeVisitId, doctorIdParam, password);
      toast.success("Patient released and returned to appointment queue.");
      setShowReleaseConfirm(false);
      await backToWorkbench();
    } finally {
      setIsReleasingPatient(false);
    }
  };

  const [showDentalChartModal, setShowDentalChartModal] = useState(false);

  // ---------------- ENCOUNTER CORRECTIONS (admin proposing, doctor acknowledging) ----------------
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionDoctors, setCorrectionDoctors] = useState<UserType[]>([]);
  const [selectedCorrectionDoctorId, setSelectedCorrectionDoctorId] = useState("");
  const [isProposingCorrection, setIsProposingCorrection] = useState(false);
  const [encounterCorrections, setEncounterCorrections] = useState<EncounterCorrectionType[]>([]);

  const fetchEncounterCorrections = async () => {
    if (!selectedPatientId || !summary?.latestEncounter) return;
    try {
      const res = await EmrService.getEncounterCorrections(selectedPatientId, summary.latestEncounter.encounterId);
      setEncounterCorrections(res.data || []);
    } catch {
      setEncounterCorrections([]);
    }
  };

  useEffect(() => {
    if (isCompletedEncounter) fetchEncounterCorrections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary?.latestEncounter?.encounterId, isCompletedEncounter]);

  const openCorrectionModal = () => {
    if (correctionDoctors.length === 0) {
      UserService.getAllByRole("doctor")
        .then((res) => setCorrectionDoctors(res.data || []))
        .catch(() => toast.error("Failed to load doctor list"));
    }
    setSelectedCorrectionDoctorId("");
    setShowCorrectionModal(true);
  };

  const submitCorrection = async () => {
    if (!selectedPatientId || !summary?.latestEncounter || !selectedCorrectionDoctorId) {
      toast.error("Select the doctor this correction should go to");
      return;
    }
    notifySaveStatus("saving");
    try {
      setIsProposingCorrection(true);
      await EmrService.proposeEncounterCorrection(selectedPatientId, summary.latestEncounter.encounterId, {
        ...encounterForm,
        targetUserId: selectedCorrectionDoctorId,
      });
      toast.success("Correction sent — it applies once the doctor acknowledges it");
      notifySaveStatus("saved");
      setEncounterFormSnapshot(encounterForm);
      setShowCorrectionModal(false);
      await fetchEncounterCorrections();
    } catch (error) {
      notifySaveStatus("error");
      toast.error(errorMessage(error, "Failed to send correction"));
    } finally {
      setIsProposingCorrection(false);
    }
  };

  // ---------------- ENCOUNTER UNLOCK REQUESTS (doctor requests admin to reopen) ----------------
  const [unlockReason, setUnlockReason] = useState("");
  const [isRequestingUnlock, setIsRequestingUnlock] = useState(false);
  const [showUnlockRequestModal, setShowUnlockRequestModal] = useState(false);
  const [pendingUnlockForEncounter, setPendingUnlockForEncounter] = useState(false);
  const [unlockRequests, setUnlockRequests] = useState<EncounterUnlockRequestType[]>([]);
  const [resolvingUnlockId, setResolvingUnlockId] = useState<string | null>(null);

  const fetchUnlockRequests = async () => {
    if (!isAdmin) return;
    try {
      const res = await EmrService.getEncounterUnlockRequests();
      setUnlockRequests(res.data || []);
    } catch {
      setUnlockRequests([]);
    }
  };

  const fetchUnlockStatusForEncounter = async () => {
    if (isAdmin || !selectedPatientId || !summary?.latestEncounter || !isCompletedEncounter) return;
    try {
      const res = await EmrService.getMyUnlockRequestStatus(selectedPatientId, summary.latestEncounter.encounterId);
      setPendingUnlockForEncounter(res.pending ?? false);
    } catch {
      setPendingUnlockForEncounter(false);
    }
  };

  useEffect(() => {
    if (checkedAuth && isAdmin) fetchUnlockRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedAuth, isAdmin]);

  useEffect(() => {
    fetchUnlockStatusForEncounter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary?.latestEncounter?.encounterId, isCompletedEncounter]);

  // Signal the header "Reopen" button visibility through context
  useEffect(() => {
    if (!selectedPatientId || !isCompletedEncounter || isAdmin) {
      setReopenState(false, null);
      return;
    }
    setReopenState(true, () => setShowUnlockRequestModal(true));
    return () => setReopenState(false, null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompletedEncounter, selectedPatientId, isAdmin, setReopenState]);

  // Fetch the full past-encounters list for this patient so the Past Visits drawer and
  // history drawers can show previous visit dates and chief complaints.
  useEffect(() => {
    if (!selectedPatientId) { setPastEncounters([]); return; }
    EmrService.getPatientEncounters(selectedPatientId, doctorIdParam)
      .then((res) => setPastEncounters(res.data ?? []))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatientId, doctorIdParam]);

  useSignalRRefetch(["encounterUnlockRequested", "encounterUnlockResolved"], () => {
    fetchUnlockRequests();
    fetchUnlockStatusForEncounter();
  });

  const submitUnlockRequest = async () => {
    if (!selectedPatientId || !summary?.latestEncounter) return;
    try {
      setIsRequestingUnlock(true);
      await EmrService.requestEncounterUnlock(selectedPatientId, summary.latestEncounter.encounterId, unlockReason);
      toast.success("Unlock request sent — an admin will review it");
      setPendingUnlockForEncounter(true);
      setShowUnlockRequestModal(false);
      setUnlockReason("");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to send unlock request"));
    } finally {
      setIsRequestingUnlock(false);
    }
  };

  const resolveUnlockRequest = async (requestId: string, action: "approve" | "deny") => {
    try {
      setResolvingUnlockId(requestId);
      if (action === "approve") {
        await EmrService.approveEncounterUnlock(requestId);
        toast.success("Encounter unlocked — the doctor can now edit it");
      } else {
        await EmrService.denyEncounterUnlock(requestId);
        toast.success("Unlock request denied");
      }
      await fetchUnlockRequests();
      if (selectedPatientId) await fetchSummary(selectedPatientId);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to resolve unlock request"));
    } finally {
      setResolvingUnlockId(null);
    }
  };

  // ---------------- MY PENDING CORRECTIONS (doctor acknowledging admin's edits) ----------------
  const [myPendingCorrections, setMyPendingCorrections] = useState<EncounterCorrectionType[]>([]);
  const [resolvingCorrectionId, setResolvingCorrectionId] = useState<string | null>(null);

  const fetchMyPendingCorrections = async () => {
    if (isAdmin) return;
    try {
      const res = await EmrService.getMyPendingCorrections();
      setMyPendingCorrections(res.data || []);
    } catch {
      setMyPendingCorrections([]);
    }
  };

  useEffect(() => {
    if (checkedAuth) fetchMyPendingCorrections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedAuth]);

  useSignalRRefetch(["encounterCorrectionProposed", "encounterCorrectionResolved"], fetchMyPendingCorrections);

  const resolveCorrection = async (correctionId: string, action: "acknowledge" | "reject") => {
    try {
      setResolvingCorrectionId(correctionId);
      if (action === "acknowledge") {
        await EmrService.acknowledgeCorrection(correctionId);
        toast.success("Correction applied to the encounter");
      } else {
        await EmrService.rejectCorrection(correctionId);
        toast.success("Correction rejected");
      }
      await fetchMyPendingCorrections();
      if (selectedPatientId) await fetchSummary(selectedPatientId);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to resolve correction"));
    } finally {
      setResolvingCorrectionId(null);
    }
  };

  const finishEncounter = async () => {
    if (!summary?.latestEncounter) return;
    try {
      setIsSavingEncounter(true);
      await EmrService.finishEncounter(summary.latestEncounter.encounterId, doctorIdParam);
      toast.success("Encounter marked as completed");
      if (selectedPatientId) await fetchSummary(selectedPatientId);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to finish encounter"));
    } finally {
      setIsSavingEncounter(false);
    }
  };

  // ---------------- CHRONIC CONDITIONS ----------------
  const [conditionForm, setConditionForm] = useState({
    name: "",
    diagnosedYear: "",
    status: "Managed",
    diabetesType: "",
    diagnosisDate: "",
    hasPcos: false,
    hasEsrd: false,
  });
  const isDiabetesCondition = conditionForm.name.toLowerCase().includes("diabet");
  const isHypertensionCondition = conditionForm.name.toLowerCase().includes("hypertension");
  const [editingConditionId, setEditingConditionId] = useState<string | null>(null);

  const addCondition = async () => {
    if (!selectedPatientId || !conditionForm.name.trim()) {
      toast.error("Condition name is required");
      return;
    }
    if (!requireDoctorSelected()) return;
    try {
      const payload = {
        name: conditionForm.name.trim(),
        diagnosedYear: conditionForm.diagnosedYear ? Number(conditionForm.diagnosedYear) : undefined,
        status: conditionForm.status,
        diabetesType: isDiabetesCondition && conditionForm.diabetesType ? conditionForm.diabetesType : undefined,
        diagnosisDate: conditionForm.diagnosisDate || undefined,
        hasPcos: isDiabetesCondition ? conditionForm.hasPcos : undefined,
        hasEsrd: isHypertensionCondition ? conditionForm.hasEsrd : undefined,
      };
      if (editingConditionId) {
        await EmrService.updateChronicCondition(editingConditionId, payload, doctorIdParam);
        toast.success("Chronic condition corrected");
      } else {
        await EmrService.addChronicCondition(selectedPatientId, payload, doctorIdParam);
        toast.success("Chronic condition added");
      }
      setConditionForm({
        name: "",
        diagnosedYear: "",
        status: "Managed",
        diabetesType: "",
        diagnosisDate: "",
        hasPcos: false,
        hasEsrd: false,
      });
      setEditingConditionId(null);
      await fetchSummary(selectedPatientId);
    } catch (error) {
      toast.error(errorMessage(error, editingConditionId ? "Failed to correct condition" : "Failed to add condition"));
    }
  };

  const startEditCondition = (c: ChronicConditionType) => {
    setEditingConditionId(c.chronicConditionId);
    setConditionForm({
      name: c.name,
      diagnosedYear: c.diagnosedYear ? String(c.diagnosedYear) : "",
      status: c.status || "Managed",
      diabetesType: c.diabetesType || "",
      diagnosisDate: c.diagnosisDate || "",
      hasPcos: c.hasPcos,
      hasEsrd: c.hasEsrd,
    });
  };

  const cancelEditCondition = () => {
    setEditingConditionId(null);
    setConditionForm({ name: "", diagnosedYear: "", status: "Managed", diabetesType: "", diagnosisDate: "", hasPcos: false, hasEsrd: false });
  };

  const removeCondition = (c: ChronicConditionType) => {
    if (!selectedPatientId) return;
    confirmDeleteToast(
      <span>Delete condition <b className="text-red-500 ml-1">{c.name}</b>?</span>,
      async () => {
        try {
          await EmrService.removeChronicCondition(c.chronicConditionId, doctorIdParam);
          toast.success("Chronic condition removed");
          await fetchSummary(selectedPatientId);
        } catch (error) {
          toast.error(errorMessage(error, "Failed to remove condition"));
        }
      }
    );
  };

  // ---------------- PATIENT ALERT ----------------

  const savePatientAlert = async (text: string) => {
    if (!selectedPatientId) return;
    if (alertTimerRef.current) { clearTimeout(alertTimerRef.current); alertTimerRef.current = null; }
    setIsSavingAlert(true);
    try {
      await EmrService.updatePatientAlert(selectedPatientId, text.trim() || null, doctorIdParam);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save patient alert"));
    } finally {
      setIsSavingAlert(false);
    }
  };

  // ---------------- MEDICAL HISTORY ----------------

  const saveMedicalHistory = async (medical: string, surgical: string, treatment: string, social: string) => {
    if (!selectedPatientId) return;
    if (historyTimerRef.current) { clearTimeout(historyTimerRef.current); historyTimerRef.current = null; }
    setIsSavingHistory(true);
    try {
      await EmrService.updateMedicalHistory(
        selectedPatientId,
        {
          pastMedicalHistory: medical.trim() || null,
          pastSurgicalHistory: surgical.trim() || null,
          pastTreatmentHistory: treatment.trim() || null,
          socialHistory: social.trim() || null,
        },
        doctorIdParam
      );
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save medical history"));
    } finally {
      setIsSavingHistory(false);
    }
  };

  // ---------------- ALLERGIES ----------------
  const emptyAllergyForm = { substance: "", reaction: "", allergyCategory: "", severity: "", identifiedDate: "", status: "Active", remarks: "" };
  const [allergyForm, setAllergyForm] = useState(emptyAllergyForm);
  const [editingAllergyId, setEditingAllergyId] = useState<string | null>(null);

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

  const addAllergy = async () => {
    if (!selectedPatientId || !allergyForm.substance.trim()) {
      toast.error("Allergen is required");
      return;
    }
    if (!allergyForm.allergyCategory) {
      toast.error("Allergy category is required");
      return;
    }
    if (!requireDoctorSelected()) return;
    try {
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
        await EmrService.updateAllergy(editingAllergyId, payload, doctorIdParam);
        toast.success("Allergy corrected");
      } else {
        await EmrService.addAllergy(selectedPatientId, payload, doctorIdParam);
        toast.success("Allergy added");
      }
      setAllergyForm(emptyAllergyForm);
      setEditingAllergyId(null);
      await fetchSummary(selectedPatientId);
    } catch (error) {
      toast.error(errorMessage(error, editingAllergyId ? "Failed to correct allergy" : "Failed to add allergy"));
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
  };

  const cancelEditAllergy = () => {
    setEditingAllergyId(null);
    setAllergyForm(emptyAllergyForm);
  };

  const removeAllergy = (a: AllergyType) => {
    if (!selectedPatientId) return;
    confirmDeleteToast(
      <span>Delete allergy <b className="text-red-500 ml-1">{a.substance}</b>?</span>,
      async () => {
        try {
          await EmrService.removeAllergy(a.patientAllergyId, doctorIdParam);
          toast.success("Allergy removed");
          await fetchSummary(selectedPatientId);
        } catch (error) {
          toast.error(errorMessage(error, "Failed to remove allergy"));
        }
      }
    );
  };

  // ---------------- MEDICATIONS ----------------
  const [editingMedication, setEditingMedication] = useState<MedicationType | null>(null);
  const [medTab, setMedTab] = useState<"current" | "history">("current");

  const addMedication = async (payload: MedicationPayload): Promise<boolean> => {
    if (!selectedPatientId) return false;
    if (!requireDoctorSelected()) return false;
    try {
      if (editingMedication) {
        await EmrService.updateMedication(editingMedication.medicationId, payload, doctorIdParam);
        toast.success("Medication corrected");
        setEditingMedication(null);
      } else {
        await EmrService.addMedication(
          selectedPatientId,
          { ...payload, encounterId: summary?.latestEncounter?.encounterId },
          doctorIdParam
        );
        toast.success("Medication order added");
      }
      await fetchSummary(selectedPatientId);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, editingMedication ? "Failed to correct medication" : "Failed to add medication"));
      return false;
    }
  };

  const discontinueMedication = async (medicationId: string) => {
    if (!selectedPatientId) return;
    try {
      await EmrService.discontinueMedication(medicationId, doctorIdParam);
      toast.success("Medication discontinued");
      await fetchSummary(selectedPatientId);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to discontinue medication"));
    }
  };

  const removeMedication = (m: MedicationType) => {
    if (!selectedPatientId) return;
    confirmDeleteToast(
      <span>Delete medication order <b className="text-red-500 ml-1">{m.drugName}</b>?</span>,
      async () => {
        try {
          await EmrService.removeMedication(m.medicationId, doctorIdParam);
          toast.success("Medication order removed");
          await fetchSummary(selectedPatientId);
        } catch (error) {
          toast.error(errorMessage(error, "Failed to remove medication order"));
        }
      }
    );
  };

  // ---------------- UNIFIED ORDERING (Lab / Radiology / Treatment via one CPT/procedure
  // search - see components/orders/. Replaces the old separate "Order Investigation" and
  // "Treatments" cards: one search against the ListType=Procedure catalog, its
  // OrderCategory decides which config popup opens and which backend entity gets created.
  // The same popup, pre-filled, reopens from the gear icon on an already-ordered item to
  // edit it - subject to OrderLockHelper's lock rules enforced server-side.) ----------------
  const [insuranceCoverage, setInsuranceCoverage] = useState<PatientInsuranceCoverageType | null>(null);
  useEffect(() => {
    if (!selectedPatientId) { setInsuranceCoverage(null); return; }
    EmrService.getInsuranceCoverage(selectedPatientId, doctorIdParam)
      .then((res) => setInsuranceCoverage(res.data))
      .catch(() => setInsuranceCoverage(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatientId]);

  // Reference info only — matched from the patient's insurance coverage (set during
  // registration) by service category. Covered/Patient Share/Co-Insurance stay
  // doctor-editable rather than being silently auto-filled.
  const coverageHintText = (category: "Lab" | "Radiology") => {
    if (!insuranceCoverage || insuranceCoverage.paymentType === "Cash") return null;
    const match = insuranceCoverage.coverages.find((c) => c.serviceCategory === category);
    return match
      ? `${insuranceCoverage.paymentType} on file for ${category}: Co-Insurance ${match.coPayPercent ?? "—"}%, Deductible ${match.deductible ?? "—"} AED (${match.deductibleAppliesTo || "—"})`
      : `${insuranceCoverage.paymentType} patient — no ${category} coverage on file`;
  };

  type OrderingModalState =
    | { mode: "create"; item: ListItemType }
    | { mode: "edit-lab"; item: LabRequestType }
    | { mode: "edit-radiology"; item: RadiologyRequestType }
    | { mode: "edit-treatment"; item: TreatmentType }
    | null;
  const [orderingModal, setOrderingModal] = useState<OrderingModalState>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  // CatalogSearchInput's onSelect only hands back {id, name, code, meta} - keyed lookup of
  // every ListItemType a search has returned so far, so the full row (particularly
  // orderCategory/cashPrice) can be recovered by id once one's picked. A ref, not state:
  // CatalogSearchInput clears its own query box and closes its dropdown unconditionally the
  // instant a result is clicked, regardless of what onSelect below does - so this lookup
  // must be synchronously current the moment that click happens, not merely "current as of
  // the last completed render". State updated via setState only becomes visible on the next
  // render, and a fast click right after typing could land inside that gap, silently
  // clearing the search box with nothing added and no error (the very bug this replaces).
  const procedureResultsRef = useRef<Map<string, ListItemType>>(new Map());

  const submitLabRadiology = async (values: LabRadiologyConfigValues) => {
    if (!selectedPatientId || !orderingModal) return;
    if (!requireDoctorSelected()) return;
    notifySaveStatus("saving");
    setIsSavingOrder(true);
    try {
      const shared = {
        patientId: selectedPatientId,
        doctorId: doctorIdParam,
        visitId: visitIdParam,
        quantity: values.quantity ? Number(values.quantity) : 1,
        remarks: values.remarks.trim() || undefined,
        priority: values.priority,
        source: values.source,
        price: values.price ? Number(values.price) : undefined,
        uccCode: values.uccCode.trim() || undefined,
        covered: values.covered ? values.covered === "Yes" : undefined,
        patientShareAmount: values.patientShareAmount ? Number(values.patientShareAmount) : undefined,
        coInsurancePercent: values.coInsurancePercent ? Number(values.coInsurancePercent) : undefined,
        preAuthStatus: values.preAuthStatus || undefined,
      };

      if (orderingModal.mode === "create" && orderingModal.item.orderCategory === "Lab") {
        await LabService.create({ ...shared, testType: orderingModal.item.name, listItemId: orderingModal.item.listItemId });
        toast.success("Lab order placed");
      } else if (orderingModal.mode === "create" && orderingModal.item.orderCategory === "Radiology") {
        await RadiologyService.create({
          ...shared,
          scanType: orderingModal.item.name,
          listItemId: orderingModal.item.listItemId,
          bodyParts: values.bodyParts.trim() || undefined,
        });
        toast.success("Radiology order placed");
      } else if (orderingModal.mode === "edit-lab") {
        await LabService.update(orderingModal.item.labRequestId, {
          ...shared,
          testType: orderingModal.item.testType || "",
          listItemId: orderingModal.item.listItemId || undefined,
        });
        toast.success("Lab order updated");
      } else if (orderingModal.mode === "edit-radiology") {
        await RadiologyService.update(orderingModal.item.radiologyRequestId, {
          ...shared,
          scanType: orderingModal.item.scanType || "",
          listItemId: orderingModal.item.listItemId || undefined,
          bodyParts: values.bodyParts.trim() || undefined,
        });
        toast.success("Radiology order updated");
      }
      notifySaveStatus("saved");
      setOrderingModal(null);
      await fetchSummary(selectedPatientId);
    } catch (error) {
      notifySaveStatus("error");
      toast.error(errorMessage(error, "Failed to save order"));
    } finally {
      setIsSavingOrder(false);
    }
  };

  const submitTreatment = async (values: TreatmentConfigValues) => {
    if (!selectedPatientId || !orderingModal) return;
    if (!requireDoctorSelected()) return;
    notifySaveStatus("saving");
    setIsSavingOrder(true);
    try {
      const shared = {
        patientId: selectedPatientId,
        encounterId: summary?.latestEncounter?.encounterId,
        quantity: values.quantity ? Number(values.quantity) : 1,
        instructions: values.instructions.trim() || undefined,
        isPackage: values.isPackage,
        isBillingPending: values.isBillingPending,
      };

      if (orderingModal.mode === "create") {
        await TreatmentService.create(
          { ...shared, description: orderingModal.item.name, listItemId: orderingModal.item.listItemId },
          doctorIdParam
        );
        toast.success("Treatment ordered");
      } else if (orderingModal.mode === "edit-treatment") {
        await TreatmentService.update(orderingModal.item.treatmentId, {
          ...shared,
          description: orderingModal.item.description,
          listItemId: orderingModal.item.listItemId || undefined,
        });
        toast.success("Treatment updated");
      }
      notifySaveStatus("saved");
      setOrderingModal(null);
      await fetchSummary(selectedPatientId);
    } catch (error) {
      notifySaveStatus("error");
      toast.error(errorMessage(error, "Failed to save treatment"));
    } finally {
      setIsSavingOrder(false);
    }
  };

  // ---------------- CONFIDENTIAL STATEMENT (visible only to this doctor) ----------------
  const [confidentialText, setConfidentialText] = useState("");
  const [isSavingConfidential, setIsSavingConfidential] = useState(false);
  const [editingConfidentialNoteId, setEditingConfidentialNoteId] = useState<string | null>(null);

  const addConfidentialNote = async () => {
    if (!selectedPatientId || !confidentialText.trim()) return;
    notifySaveStatus("saving");
    try {
      setIsSavingConfidential(true);
      if (editingConfidentialNoteId) {
        await EmrService.updateConfidentialNote(editingConfidentialNoteId, { contentHtml: confidentialText.trim() });
        toast.success("Confidential statement updated");
      } else {
        await EmrService.addConfidentialNote(selectedPatientId, { contentHtml: confidentialText.trim() });
        toast.success("Confidential statement saved");
      }
      notifySaveStatus("saved");
      setConfidentialText("");
      setEditingConfidentialNoteId(null);
      await fetchConfidentialNotes(selectedPatientId);
    } catch (error) {
      notifySaveStatus("error");
      toast.error(errorMessage(error, "Failed to save confidential statement"));
    } finally {
      setIsSavingConfidential(false);
    }
  };

  const startEditConfidentialNote = (n: DoctorConfidentialNoteType) => {
    setEditingConfidentialNoteId(n.doctorConfidentialNoteId);
    setConfidentialText(n.contentHtml);
  };

  const cancelEditConfidentialNote = () => {
    setEditingConfidentialNoteId(null);
    setConfidentialText("");
  };

  const removeConfidentialNote = (n: DoctorConfidentialNoteType) => {
    if (!selectedPatientId) return;
    confirmDeleteToast(
      <span>Delete this confidential statement?</span>,
      async () => {
        try {
          await EmrService.removeConfidentialNote(n.doctorConfidentialNoteId);
          toast.success("Confidential statement removed");
          await fetchConfidentialNotes(selectedPatientId);
        } catch (error) {
          toast.error(errorMessage(error, "Failed to remove confidential statement"));
        }
      }
    );
  };

  // ---------------- HISTORY DRAWERS ----------------
  const [showDiagnosisHistory, setShowDiagnosisHistory] = useState(false);
  const [showMedHistory, setShowMedHistory] = useState(false);
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [showPastVisitsDrawer, setShowPastVisitsDrawer] = useState(false);
  const [showEncounterNotesHistory, setShowEncounterNotesHistory] = useState(false);
  const [pastEncounters, setPastEncounters] = useState<EncounterListItemType[]>([]);
  const [diagnosisHistory, setDiagnosisHistory] = useState<{ encounterDiagnosisId: string; listItemId: string | null; diagnosisCode: string | null; diagnosisName: string; encounterDate: string | null }[]>([]);
  const [isDiagnosisHistoryLoading, setIsDiagnosisHistoryLoading] = useState(false);
  const [prefillMedication, setPrefillMedication] = useState<MedicationType | null>(null);

  const openDiagnosisHistory = async () => {
    if (!selectedPatientId) return;
    setShowDiagnosisHistory(true);
    setIsDiagnosisHistoryLoading(true);
    try {
      const res = await EmrService.getDiagnosisHistory(
        selectedPatientId,
        summary?.latestEncounter?.encounterId,
        doctorIdParam
      );
      setDiagnosisHistory(res.data || []);
    } catch {
      toast.error("Failed to load diagnosis history");
    } finally {
      setIsDiagnosisHistoryLoading(false);
    }
  };

  // ---------------- DIAGNOSIS ----------------
  const addDiagnosis = async (listItemId: string) => {
    if (!selectedPatientId) return;
    if (!summary?.latestEncounter?.encounterId) {
      toast.error("Save the encounter before adding a diagnosis");
      return;
    }
    if (!requireDoctorSelected()) return;
    try {
      await EmrService.addDiagnosis(
        selectedPatientId,
        { encounterId: summary.latestEncounter.encounterId, listItemId },
        doctorIdParam
      );
      toast.success("Diagnosis added");
      await fetchSummary(selectedPatientId);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to add diagnosis"));
    }
  };

  const setPrimaryDiagnosis = async (encounterDiagnosisId: string) => {
    if (!selectedPatientId) return;
    try {
      await EmrService.setPrimaryDiagnosis(encounterDiagnosisId, doctorIdParam);
      toast.success("Primary diagnosis updated");
      await fetchSummary(selectedPatientId);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update primary diagnosis"));
    }
  };

  const removeDiagnosis = async (encounterDiagnosisId: string) => {
    if (!selectedPatientId) return;
    try {
      await EmrService.removeDiagnosis(encounterDiagnosisId, doctorIdParam);
      toast.success("Diagnosis removed");
      await fetchSummary(selectedPatientId);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to remove diagnosis"));
    }
  };

  // ---------------- FOLLOW-UP ----------------
  const [followUpForm, setFollowUpForm] = useState({ followUpDate: "", instructions: "" });
  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null);

  const addFollowUp = async () => {
    if (!selectedPatientId || !followUpForm.followUpDate) {
      toast.error("Follow-up date is required");
      return;
    }
    if (!requireDoctorSelected()) return;
    try {
      const payload = {
        encounterId: summary?.latestEncounter?.encounterId,
        followUpDate: followUpForm.followUpDate,
        instructions: followUpForm.instructions.trim() || undefined,
      };
      if (editingFollowUpId) {
        await EmrService.updateFollowUp(editingFollowUpId, payload, doctorIdParam);
        toast.success("Follow-up updated");
      } else {
        await EmrService.addFollowUp(selectedPatientId, payload, doctorIdParam);
        toast.success("Follow-up added");
      }
      setFollowUpForm({ followUpDate: "", instructions: "" });
      setEditingFollowUpId(null);
      await fetchSummary(selectedPatientId);
    } catch (error) {
      toast.error(errorMessage(error, editingFollowUpId ? "Failed to update follow-up" : "Failed to add follow-up"));
    }
  };

  const startEditFollowUp = (f: FollowUpType) => {
    setEditingFollowUpId(f.followUpId);
    setFollowUpForm({ followUpDate: f.followUpDate, instructions: f.instructions || "" });
  };

  const cancelEditFollowUp = () => {
    setEditingFollowUpId(null);
    setFollowUpForm({ followUpDate: "", instructions: "" });
  };

  const removeFollowUp = (f: FollowUpType) => {
    if (!selectedPatientId) return;
    confirmDeleteToast(
      <span>Delete this follow-up?</span>,
      async () => {
        try {
          await EmrService.removeFollowUp(f.followUpId, doctorIdParam);
          toast.success("Follow-up removed");
          await fetchSummary(selectedPatientId);
        } catch (error) {
          toast.error(errorMessage(error, "Failed to remove follow-up"));
        }
      }
    );
  };

  const markDocumentViewed = async (id: string) => {
    if (!selectedPatientId) return;
    try {
      await EmrService.markDocumentViewed(selectedPatientId, id);
      await fetchDocuments(selectedPatientId);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to mark document as viewed"));
    }
  };

  const handleUploadDocument = async () => {
    if (!selectedPatientId || !uploadDocFile) return;
    setIsUploadingDoc(true);
    try {
      await EmrService.uploadDocument(selectedPatientId, {
        documentType: uploadDocType,
        file: uploadDocFile,
        visitId: summary?.latestEncounter?.visitId ?? undefined,
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

  // ---------------- REFERRAL ----------------
  const [referralForm, setReferralForm] = useState({
    targetSpecializationId: "",
    priority: "Routine",
    notes: "",
    cancerSiteListItemId: "",
    cancerSiteName: "",
    externalFacility: "",
  });
  const [editingReferralId, setEditingReferralId] = useState<string | null>(null);

  const addReferral = async () => {
    if (!selectedPatientId || !referralForm.targetSpecializationId) {
      toast.error("Select a target specialty");
      return;
    }
    if (!requireDoctorSelected()) return;
    try {
      const payload = {
        encounterId: summary?.latestEncounter?.encounterId,
        targetSpecializationId: referralForm.targetSpecializationId,
        priority: referralForm.priority,
        notes: referralForm.notes.trim() || undefined,
        cancerSiteListItemId: referralForm.cancerSiteListItemId || undefined,
        externalFacility: referralForm.externalFacility.trim() || undefined,
      };
      if (editingReferralId) {
        await EmrService.updateReferral(editingReferralId, payload, doctorIdParam);
        toast.success("Referral corrected");
      } else {
        await EmrService.addReferral(selectedPatientId, payload, doctorIdParam);
        toast.success("Referral created");
      }
      setReferralForm({
        targetSpecializationId: "",
        priority: "Routine",
        notes: "",
        cancerSiteListItemId: "",
        cancerSiteName: "",
        externalFacility: "",
      });
      setEditingReferralId(null);
      await fetchSummary(selectedPatientId);
    } catch (error) {
      toast.error(errorMessage(error, editingReferralId ? "Failed to correct referral" : "Failed to create referral"));
    }
  };

  const startEditReferral = (r: ReferralType) => {
    setEditingReferralId(r.referralId);
    setReferralForm({
      targetSpecializationId: r.targetSpecializationId || "",
      priority: r.priority || "Routine",
      notes: r.notes || "",
      cancerSiteListItemId: r.cancerSiteListItemId || "",
      cancerSiteName: r.cancerSiteName || "",
      externalFacility: r.externalFacility || "",
    });
  };

  const cancelEditReferral = () => {
    setEditingReferralId(null);
    setReferralForm({ targetSpecializationId: "", priority: "Routine", notes: "", cancerSiteListItemId: "", cancerSiteName: "", externalFacility: "" });
  };

  const removeReferral = (r: ReferralType) => {
    if (!selectedPatientId) return;
    confirmDeleteToast(
      <span>Delete this referral to <b className="text-red-500 ml-1">{r.targetSpecializationName}</b>?</span>,
      async () => {
        try {
          await EmrService.removeReferral(r.referralId, doctorIdParam);
          toast.success("Referral removed");
          await fetchSummary(selectedPatientId);
        } catch (error) {
          toast.error(errorMessage(error, "Failed to remove referral"));
        }
      }
    );
  };

  // ---------------- DENTAL VISIT EXTRAS ----------------
  const [dentalForm, setDentalForm] = useState({
    fissureSealantApplied: false,
    fluorideApplied: false,
    sdfApplied: false,
    oralHygieneEducationGiven: false,
    lifestyleEducationGiven: false,
    smokingCessationEducationGiven: false,
    comprehensiveDentalPlanProvided: false,
  });
  const [isSavingDentalExtras, setIsSavingDentalExtras] = useState(false);

  useEffect(() => {
    const latest = summary?.dentalVisitExtras?.[0];
    setDentalForm({
      fissureSealantApplied: latest?.fissureSealantApplied ?? false,
      fluorideApplied: latest?.fluorideApplied ?? false,
      sdfApplied: latest?.sdfApplied ?? false,
      oralHygieneEducationGiven: latest?.oralHygieneEducationGiven ?? false,
      lifestyleEducationGiven: latest?.lifestyleEducationGiven ?? false,
      smokingCessationEducationGiven: latest?.smokingCessationEducationGiven ?? false,
      comprehensiveDentalPlanProvided: latest?.comprehensiveDentalPlanProvided ?? false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary?.dentalVisitExtras]);

  const saveDentalExtras = async () => {
    if (!selectedPatientId) return;
    if (!requireDoctorSelected()) return;
    notifySaveStatus("saving");
    try {
      setIsSavingDentalExtras(true);
      await EmrService.saveDentalExtras(
        selectedPatientId,
        { encounterId: summary?.latestEncounter?.encounterId, ...dentalForm },
        doctorIdParam
      );
      toast.success("Dental checklist saved");
      notifySaveStatus("saved");
      await fetchSummary(selectedPatientId);
    } catch (error) {
      notifySaveStatus("error");
      toast.error(errorMessage(error, "Failed to save dental checklist"));
    } finally {
      setIsSavingDentalExtras(false);
    }
  };

  // ---------------- QUICK NOTE ----------------
  const [noteText, setNoteText] = useState("");
  const [editingQuickNoteId, setEditingQuickNoteId] = useState<string | null>(null);
  const [editingQuickNoteText, setEditingQuickNoteText] = useState("");

  const addQuickNote = async () => {
    if (!selectedPatientId || !noteText.trim() || !requireDoctorSelected()) return;
    notifySaveStatus("saving");
    try {
      await EmrService.addQuickNote(selectedPatientId, noteText.trim(), doctorIdParam);
      toast.success("Note added");
      notifySaveStatus("saved");
      setNoteText("");
      await fetchQuickNotes(selectedPatientId);
    } catch (error) {
      notifySaveStatus("error");
      toast.error(errorMessage(error, "Failed to add note"));
    }
  };

  const startEditQuickNote = (note: QuickNoteType) => {
    setEditingQuickNoteId(note.consultationNoteId);
    setEditingQuickNoteText(note.notes ?? "");
  };

  const cancelEditQuickNote = () => {
    setEditingQuickNoteId(null);
    setEditingQuickNoteText("");
  };

  const saveEditQuickNote = async () => {
    if (!selectedPatientId || !editingQuickNoteId || !editingQuickNoteText.trim()) return;
    notifySaveStatus("saving");
    try {
      await EmrService.updateQuickNote(editingQuickNoteId, editingQuickNoteText.trim(), doctorIdParam);
      toast.success("Note updated");
      notifySaveStatus("saved");
      cancelEditQuickNote();
      await fetchQuickNotes(selectedPatientId);
    } catch (error) {
      notifySaveStatus("error");
      toast.error(errorMessage(error, "Failed to update note"));
    }
  };

  const removeQuickNote = (note: QuickNoteType) => {
    if (!selectedPatientId) return;
    confirmDeleteToast(
      <span>Delete this note?</span>,
      async () => {
        try {
          await EmrService.removeQuickNote(note.consultationNoteId, doctorIdParam);
          toast.success("Note removed");
          await fetchQuickNotes(selectedPatientId);
        } catch (error) {
          toast.error(errorMessage(error, "Failed to remove note"));
        }
      }
    );
  };

  const PAGE_SIZE = 10;
  const filteredPatients = (() => {
    const term = searchTerm.trim().toLowerCase();
    return term
      ? patients.filter(
          (p) =>
            p.name?.toLowerCase().includes(term) ||
            p.opNumber?.toLowerCase().includes(term) ||
            p.opId?.toLowerCase().includes(term)
        )
      : patients;
  })();
  const totalPatientPages = Math.ceil(filteredPatients.length / PAGE_SIZE);
  const pagedPatients = searchTerm.trim()
    ? filteredPatients
    : filteredPatients.slice((patientsPage - 1) * PAGE_SIZE, patientsPage * PAGE_SIZE);

  if (!checkedAuth) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // ==================== EMR PANEL ====================
  if (selectedPatientId) {
    return (
      <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
        <div className="mb-5 flex items-center justify-between gap-4">
          <button
            onClick={backToWorkbench}
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft size={16} /> Back to patients
          </button>
          {pastEncounters.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPastVisitsDrawer(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/60 hover:text-primary transition-colors"
            >
              <History size={14} />
              Past Visits ({pastEncounters.length})
            </button>
          )}
        </div>
        {!summary ? (
          <LoadingSpinner />
        ) : (
          <div className="flex flex-col gap-6">
            <div className="card p-6 flex flex-col gap-1 border-l-4 border-l-primary">
              <div className="flex flex-wrap items-start justify-between gap-4">
                {/* Patient identity */}
                <div>
                  <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                    <Stethoscope className="text-primary" /> {summary.name}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    MRN {summary.opNumber || summary.opId} · {summary.sex || "—"} · DOB {formatDate(summary.dateOfBirth)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {summary.phone ? `${summary.phoneCode ? `${summary.phoneCode} ` : ""}${summary.phone}` : "No phone"} · {summary.email || "No email"}
                  </p>
                </div>

                {/* Confidential Statement + Quick Notes — two panels in the header card */}
                <div className="flex-1 min-w-[320px] grid grid-cols-2 gap-4 border-l border-border/50 pl-4">

                  {/* Confidential Statement */}
                  <div className="flex flex-col gap-2 border-r border-amber-400/30 pr-4">
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <Lock size={12} /> Confidential <span className="font-normal text-muted-foreground">(only you)</span>
                    </p>
                    <textarea
                      placeholder="Private notes only you can see..."
                      value={confidentialText}
                      onChange={(e) => setConfidentialText(e.target.value)}
                      className="w-full text-sm resize-none"
                      rows={3}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={addConfidentialNote}
                        disabled={isSavingConfidential || !confidentialText.trim()}
                        className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        <Lock size={11} /> {editingConfidentialNoteId ? "Update" : "Save Privately"}
                      </button>
                      {editingConfidentialNoteId && (
                        <button onClick={cancelEditConfidentialNote} className="text-xs font-semibold text-muted-foreground hover:underline">Cancel</button>
                      )}
                    </div>
                    {confidentialNotes.length > 0 && (
                      <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                        {confidentialNotes.map((n) => (
                          <div key={n.doctorConfidentialNoteId} className="group rounded-lg bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1.5 text-xs">
                            <p className="text-foreground">{n.contentHtml}</p>
                            <div className="flex items-center justify-between mt-0.5">
                              <p className="text-muted-foreground">{formatDateTime(n.createdAt)}</p>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => startEditConfidentialNote(n)} title="Edit" className="p-0.5 hover:bg-black/10 rounded-full text-amber-700"><Pencil size={11} /></button>
                                <button onClick={() => removeConfidentialNote(n)} title="Delete" className="p-0.5 hover:bg-black/10 rounded-full text-destructive"><Trash2 size={11} /></button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick Notes */}
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                      <FileText size={12} /> Quick Notes
                    </p>
                    <textarea
                      placeholder="Add a quick note..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      className="w-full text-sm resize-none"
                      rows={3}
                    />
                    <button
                      onClick={addQuickNote}
                      disabled={!noteText.trim()}
                      className="flex items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50 self-start"
                    >
                      <Plus size={12} /> Add Note
                    </button>
                    {quickNotes.length > 0 && (
                      <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                        {quickNotes.map((n) =>
                          editingQuickNoteId === n.consultationNoteId ? (
                            <div key={n.consultationNoteId} className="rounded-lg border border-primary/40 bg-muted/30 px-2.5 py-1.5 text-xs flex flex-col gap-1.5">
                              <textarea value={editingQuickNoteText} onChange={(e) => setEditingQuickNoteText(e.target.value)} className="w-full text-xs min-h-10" autoFocus />
                              <div className="flex items-center gap-2 justify-end">
                                <button onClick={cancelEditQuickNote} className="text-xs text-muted-foreground hover:underline">Cancel</button>
                                <button onClick={saveEditQuickNote} className="text-xs font-semibold text-primary hover:underline">Save</button>
                              </div>
                            </div>
                          ) : (
                            <div key={n.consultationNoteId} className="group rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-xs">
                              <p className="text-foreground">{n.notes}</p>
                              <div className="flex items-center justify-between mt-0.5">
                                <p className="text-muted-foreground">{formatDateTime(n.createdAt)}</p>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => startEditQuickNote(n)} title="Edit" className="p-0.5 hover:bg-primary/10 rounded-full text-primary"><Pencil size={11} /></button>
                                  <button onClick={() => removeQuickNote(n)} title="Delete" className="p-0.5 hover:bg-destructive/10 rounded-full text-destructive"><Trash2 size={11} /></button>
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>

                </div>

                {/* Badges */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {/* Allergy indicator — click to re-open the allergy/alert modal */}
                  {summary.allergies.length > 0 && (
                    <button
                      onClick={() => setPatientWarningModal({ allergies: summary.allergies, alertText: summary.patientAlert ?? "" })}
                      className="flex items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                    >
                      <AlertTriangle size={13} />
                      Known Allergies
                      <span className="rounded-full bg-red-600 text-white px-1.5 py-0.5 text-[10px] font-bold">
                        {summary.allergies.length}
                      </span>
                    </button>
                  )}
                  {/* Documents button — always visible so doctors can access attachments at any time */}
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
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
                      </span>
                    )}
                  </button>
                  {summary.latestEncounter && (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        summary.latestEncounter.status === "Completed"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      Encounter: {summary.latestEncounter.status}
                    </span>
                  )}
                </div>
              </div>

              {/* Latest Vitals — compact strip inside the header card */}
              {latestVitals && (
                <div className="border-t border-border/50 pt-3 mt-1 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
                  <span className="flex items-center gap-1.5 font-semibold text-foreground/90 shrink-0">
                    <HeartPulse size={15} className="text-primary" /> Latest Vitals
                    <span className="font-normal text-xs text-muted-foreground">
                      ({latestVitals.source === "Triage" ? "Triage" : "Nursing"} · {formatDateTime(latestVitals.recordedAt)})
                    </span>
                  </span>
                  {[
                    ["Height", latestVitals.heightCm ? `${latestVitals.heightCm} cm` : null],
                    ["Weight", latestVitals.weightKg ? `${latestVitals.weightKg} kg` : null],
                    ["BMI", latestVitals.bmi ? latestVitals.bmi.toFixed(1) : null],
                    ["Temp", latestVitals.temperature ? `${latestVitals.temperature}°C` : null],
                    ["HR", latestVitals.heartRate ? `${latestVitals.heartRate} BPM` : null],
                    ["B.P", latestVitals.systolic && latestVitals.diastolic ? `${latestVitals.systolic}/${latestVitals.diastolic} mmHg` : null],
                    ["B.P (M)", latestVitals.systolic && latestVitals.diastolic ? `${Math.round(latestVitals.diastolic + (latestVitals.systolic - latestVitals.diastolic) / 3)} mmHg` : null],
                    ["Resp", latestVitals.respiratory ? `${latestVitals.respiratory} bpm` : null],
                    ["O2 Sat", latestVitals.oxygenSaturation ? `${latestVitals.oxygenSaturation}%` : null],
                    ["Blood sugar", latestVitals.bloodSugar ? `${latestVitals.bloodSugar} mmol/L` : null],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <span key={label} className="text-muted-foreground">
                      {label}: <span className="font-semibold text-foreground">{value}</span>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowVitalsHistory(true)}
                    title="View vitals history"
                    className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline cursor-pointer shrink-0"
                  >
                    <History size={14} /> History
                  </button>
                </div>
              )}
            </div>

            <div className="card px-5 py-4 border-l-4 border-l-red-500 flex flex-col gap-3">
              <div>
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                  <AlertTriangle size={13} /> Patient Alerts
                </p>
                <textarea
                  value={patientAlertText}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPatientAlertText(v);
                    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
                    alertTimerRef.current = setTimeout(() => void savePatientAlert(v), 1200);
                  }}
                  onBlur={(e) => void savePatientAlert(e.target.value)}
                  placeholder="Enter any clinical alerts visible to all staff — e.g. 'Patient is claustrophobic', 'Known drug seeker'..."
                  rows={3}
                  className="w-full text-sm resize-y"
                />
                {isSavingAlert && (
                  <p className="text-xs text-muted-foreground mt-1">Saving…</p>
                )}
              </div>

              {nurseSpecialRemarks.length > 0 && (
                <div className="border-t border-border pt-3 flex flex-col gap-1.5">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                    <AlertTriangle size={13} /> Special Remarks
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {nurseSpecialRemarks.map((r) => (
                      <div key={r.specialRemarkId} className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 px-3 py-1.5 text-sm">
                        <span className="font-semibold text-amber-800 dark:text-amber-300">{r.remarkType}:</span>{" "}
                        <span className="text-foreground">{r.description}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Medical History — three persistent free-text fields auto-saved 1.2 s after
                  the last keystroke, same pattern as Patient Alerts. All three are sent
                  together in one PATCH so a single blur on any field saves them all. */}
              <div className="card px-5 py-4">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5 mb-3">
                  <ClipboardList size={13} className="text-primary" /> Medical History
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold text-muted-foreground">Past Medical History</p>
                    <textarea
                      value={pastMedicalHistory}
                      rows={3}
                      className="w-full text-sm resize-y"
                      onChange={(e) => {
                        const v = e.target.value;
                        setPastMedicalHistory(v);
                        if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
                        historyTimerRef.current = setTimeout(() => void saveMedicalHistory(v, pastSurgicalHistory, pastTreatmentHistory, socialHistory), 1200);
                      }}
                      onBlur={() => void saveMedicalHistory(pastMedicalHistory, pastSurgicalHistory, pastTreatmentHistory, socialHistory)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold text-muted-foreground">Past Surgical History</p>
                    <textarea
                      value={pastSurgicalHistory}
                      rows={3}
                      className="w-full text-sm resize-y"
                      onChange={(e) => {
                        const v = e.target.value;
                        setPastSurgicalHistory(v);
                        if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
                        historyTimerRef.current = setTimeout(() => void saveMedicalHistory(pastMedicalHistory, v, pastTreatmentHistory, socialHistory), 1200);
                      }}
                      onBlur={() => void saveMedicalHistory(pastMedicalHistory, pastSurgicalHistory, pastTreatmentHistory, socialHistory)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold text-muted-foreground">Past Treatment History</p>
                    <textarea
                      value={pastTreatmentHistory}
                      rows={3}
                      className="w-full text-sm resize-y"
                      onChange={(e) => {
                        const v = e.target.value;
                        setPastTreatmentHistory(v);
                        if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
                        historyTimerRef.current = setTimeout(() => void saveMedicalHistory(pastMedicalHistory, pastSurgicalHistory, v, socialHistory), 1200);
                      }}
                      onBlur={() => void saveMedicalHistory(pastMedicalHistory, pastSurgicalHistory, pastTreatmentHistory, socialHistory)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold text-muted-foreground">Social History</p>
                    <textarea
                      value={socialHistory}
                      rows={3}
                      className="w-full text-sm resize-y"
                      placeholder="Smoking, alcohol, occupation, exercise…"
                      onChange={(e) => {
                        const v = e.target.value;
                        setSocialHistory(v);
                        if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
                        historyTimerRef.current = setTimeout(() => void saveMedicalHistory(pastMedicalHistory, pastSurgicalHistory, pastTreatmentHistory, v), 1200);
                      }}
                      onBlur={() => void saveMedicalHistory(pastMedicalHistory, pastSurgicalHistory, pastTreatmentHistory, socialHistory)}
                    />
                  </div>
                </div>
                {isSavingHistory && (
                  <p className="text-xs text-muted-foreground mt-2">Saving…</p>
                )}
              </div>

              <FamilyHistorySection
                patientId={selectedPatientId}
                familyHistory={summary.familyHistory}
                doctorId={doctorIdParam}
                requireAttribution={requireDoctorSelected}
                onSaved={async () => { await fetchSummary(selectedPatientId); }}
              />
            </div>

<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 flex flex-col gap-6">
                {/* Chief complaint / examination notes / review of systems / clinical exam */}
                <div className="card p-6 flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <FileText size={18} className="text-primary" /> Encounter Notes
                    </h2>
                    {pastEncounters.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setShowEncounterNotesHistory(true)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        <History size={14} /> History
                      </button>
                    )}
                  </div>

                  {isCompletedEncounter && (
                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      {isAdmin ? (
                        "This encounter is finalized — edits here are proposed as a correction, not saved directly."
                      ) : pendingUnlockForEncounter ? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          Unlock request pending — an admin will review it shortly.
                        </span>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <span>This encounter is finalized and locked.</span>
                          <button
                            onClick={() => setShowUnlockRequestModal(true)}
                            className="shrink-0 rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90"
                          >
                            Request Edit Access
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {encounterCorrections.some((c) => c.status === "Pending") && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                      A correction is pending the doctor&apos;s acknowledgment.
                    </div>
                  )}

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {/* Left column */}
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-muted-foreground">Chief complaint</label>
                        <textarea
                          rows={1}
                          placeholder="Patient's primary reason for the visit..."
                          value={encounterForm.chiefComplaint}
                          onChange={(e) => setEncounterForm((p) => ({ ...p, chiefComplaint: e.target.value }))}
                          onInput={(e) => {
                            const el = e.currentTarget;
                            el.style.height = "auto";
                            el.style.height = `${el.scrollHeight}px`;
                          }}
                          disabled={isCompletedEncounter && !isAdmin}
                          className="text-sm disabled:opacity-60 resize-none overflow-hidden"
                          style={{ minHeight: "2.5rem" }}
                        />
                      </div>
                      <div className="flex flex-col gap-1 flex-1">
                        <label className="text-xs font-semibold text-muted-foreground">Examination notes</label>
                        <textarea
                          placeholder="Doctor's examination notes..."
                          value={encounterForm.examinationNotes}
                          onChange={(e) => setEncounterForm((p) => ({ ...p, examinationNotes: e.target.value }))}
                          disabled={isCompletedEncounter && !isAdmin}
                          className="w-full min-h-16 text-sm disabled:opacity-60"
                        />
                      </div>
                    </div>

                    {/* Right column */}
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-muted-foreground">Clinical examination</label>
                        <textarea
                          placeholder="Clinical examination findings..."
                          value={encounterForm.clinicalExamination}
                          onChange={(e) => setEncounterForm((p) => ({ ...p, clinicalExamination: e.target.value }))}
                          disabled={isCompletedEncounter && !isAdmin}
                          className="w-full min-h-16 text-sm disabled:opacity-60"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-muted-foreground">Planned procedures</label>
                        <textarea
                          placeholder="Planned procedures..."
                          value={encounterForm.plannedProcedures}
                          onChange={(e) => setEncounterForm((p) => ({ ...p, plannedProcedures: e.target.value }))}
                          disabled={isCompletedEncounter && !isAdmin}
                          className="w-full min-h-16 text-sm disabled:opacity-60"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => setRosExpanded((v) => !v)}
                      aria-expanded={rosExpanded}
                      className="flex items-center gap-3 mb-3 px-4 py-2 rounded-lg border border-border bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer text-left"
                    >
                      {rosExpanded
                        ? <ChevronDown size={15} className="text-muted-foreground shrink-0" />
                        : <ChevronRight size={15} className="text-muted-foreground shrink-0" />}
                      <ClipboardList size={15} className="text-primary shrink-0" />
                      <span className="text-sm font-semibold text-foreground/90">Review of Systems</span>
                      {(() => {
                        const rosFilled = [
                          encounterForm.rosConstitutional, encounterForm.rosEyeEarNoseMouthThroat,
                          encounterForm.rosCardiovascular, encounterForm.rosRespiratory,
                          encounterForm.rosGastroenterology, encounterForm.rosGenitourinary,
                          encounterForm.rosMusculoskeletal, encounterForm.rosNeurological,
                          encounterForm.rosPsychiatric, encounterForm.rosEndocrine,
                          encounterForm.rosHematologic, encounterForm.rosAllergicImmunologic,
                          encounterForm.rosIntegumentary,
                        ].filter(Boolean).length;
                        return rosFilled > 0 ? (
                          <span className="text-xs text-muted-foreground">{rosFilled} / 13 systems noted</span>
                        ) : !rosExpanded ? (
                          <span className="text-xs text-muted-foreground italic">Click to expand</span>
                        ) : null;
                      })()}
                    </button>
                    {rosExpanded && (
                      <ReviewOfSystemsPanel
                        value={encounterForm}
                        onChange={(key, value) => setEncounterForm((p) => ({ ...p, [key]: value }))}
                        disabled={isCompletedEncounter && !isAdmin}
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Current Management Plan</label>
                      {!encounterForm.currentManagementPlan && (isCompletedEncounter && !isAdmin) ? (
                        <p className="text-sm text-muted-foreground italic">No records found.</p>
                      ) : (
                        <textarea
                          placeholder="Current (immediate) management plan..."
                          value={encounterForm.currentManagementPlan}
                          onChange={(e) => setEncounterForm((p) => ({ ...p, currentManagementPlan: e.target.value }))}
                          disabled={isCompletedEncounter && !isAdmin}
                          className="w-full min-h-24 text-sm disabled:opacity-60"
                        />
                      )}
                      {summary.latestEncounter?.updatedAt && encounterForm.currentManagementPlan && (
                        <p className="text-xs text-muted-foreground">Last updated: {formatDateTime(summary.latestEncounter.updatedAt)}</p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Future Management Plan</label>
                      {!encounterForm.futureManagementPlan && (isCompletedEncounter && !isAdmin) ? (
                        <p className="text-sm text-muted-foreground italic">No records found.</p>
                      ) : (
                        <textarea
                          placeholder="Future management plan / follow-up plan..."
                          value={encounterForm.futureManagementPlan}
                          onChange={(e) => setEncounterForm((p) => ({ ...p, futureManagementPlan: e.target.value }))}
                          disabled={isCompletedEncounter && !isAdmin}
                          className="w-full min-h-24 text-sm disabled:opacity-60"
                        />
                      )}
                      {summary.latestEncounter?.updatedAt && encounterForm.futureManagementPlan && (
                        <p className="text-xs text-muted-foreground">Last updated: {formatDateTime(summary.latestEncounter.updatedAt)}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 flex-wrap">
                    {!isCompletedEncounter && (
                      <button
                        onClick={saveEncounter}
                        disabled={isSavingEncounter}
                        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                      >
                        <Save size={15} /> Save Encounter
                      </button>
                    )}
                    {summary.latestEncounter && summary.latestEncounter.status !== "Completed" && (
                      <button
                        onClick={finishEncounter}
                        disabled={isSavingEncounter}
                        className="flex items-center gap-2 rounded-lg border border-primary/30 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
                      >
                        Finish Encounter
                      </button>
                    )}
                    {activeVisitId && !isCompletedEncounter && (
                      <button
                        onClick={() => setShowReleaseConfirm(true)}
                        disabled={isSavingEncounter || isReleasingPatient}
                        className="flex items-center gap-2 rounded-lg border border-destructive/40 px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      >
                        Release Patient
                      </button>
                    )}
                    {dashboard?.isDentalSpecialty && selectedPatientId && (
                      <button
                        onClick={() => setShowDentalChartModal(true)}
                        className="flex items-center gap-2 rounded-lg border border-primary/30 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
                      >
                        <Stethoscope size={15} /> Open Dental Chart
                      </button>
                    )}
                  </div>
                </div>

                {isEncounterDirty && (
                  <FloatingSaveRevertBar
                    message="Unsaved correction"
                    saveLabel="Send correction"
                    onRevert={revertEncounterForm}
                    onSave={openCorrectionModal}
                    isSaving={isProposingCorrection}
                  />
                )}

                {showCorrectionModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
                    <div className="bg-card w-full max-w-md rounded-xl border border-border p-6 shadow-2xl mx-4">
                      <h2 className="text-xl font-semibold mb-1 text-foreground">Send correction to doctor</h2>
                      <p className="text-sm text-muted-foreground mb-4">
                        This encounter is finalized — the doctor you pick must acknowledge your changes before they apply.
                      </p>
                      <div className="flex flex-col gap-1 mb-6">
                        <label className="text-sm font-bold text-foreground/90 required">Doctor</label>
                        <div className="mt-1">
                          <SearchableSelect
                            value={selectedCorrectionDoctorId}
                            onChange={setSelectedCorrectionDoctorId}
                            options={[
                              { value: "", label: "Select doctor…" },
                              ...correctionDoctors.map((d) => ({ value: d.id, label: d.name })),
                            ]}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setShowCorrectionModal(false)}
                          className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={submitCorrection}
                          disabled={isProposingCorrection || !selectedCorrectionDoctorId}
                          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                        >
                          <Save size={15} /> Send correction
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Doctor's unlock request modal */}
                {showUnlockRequestModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
                    <div className="bg-card w-full max-w-md rounded-xl border border-border p-6 shadow-2xl mx-4">
                      <h2 className="text-xl font-semibold mb-1 text-foreground">Request Edit Access</h2>
                      <p className="text-sm text-muted-foreground mb-4">
                        This encounter is finalized. An admin will review your request and unlock it if approved.
                      </p>
                      <div className="flex flex-col gap-1 mb-6">
                        <label className="text-sm font-semibold text-foreground/90">Reason (optional)</label>
                        <textarea
                          value={unlockReason}
                          onChange={(e) => setUnlockReason(e.target.value)}
                          placeholder="Briefly explain why you need to edit this encounter..."
                          className="w-full min-h-[80px] text-sm"
                        />
                      </div>
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => { setShowUnlockRequestModal(false); setUnlockReason(""); }}
                          className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={submitUnlockRequest}
                          disabled={isRequestingUnlock}
                          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                        >
                          Send Request
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dental Checklist — only shown for dental specialty; follows Encounter Notes */}
                {dashboard?.isDentalSpecialty && (
                  <div className="card p-6 flex flex-col gap-3">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <Stethoscope size={18} className="text-primary" /> Dental Checklist
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {([
                        ["fissureSealantApplied", "Fissure sealant applied"],
                        ["fluorideApplied", "Fluoride varnish applied"],
                        ["sdfApplied", "Silver diamine fluoride applied"],
                        ["oralHygieneEducationGiven", "Oral hygiene education given"],
                        ["lifestyleEducationGiven", "Lifestyle factors education given"],
                        ["smokingCessationEducationGiven", "Smoking cessation education given"],
                        ["comprehensiveDentalPlanProvided", "Comprehensive dental plan provided"],
                      ] as const).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 text-sm">
                          <ToggleButton
                            checked={dentalForm[key]}
                            onChange={(checked) => setDentalForm((p) => ({ ...p, [key]: checked }))}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <button
                      onClick={saveDentalExtras}
                      disabled={isSavingDentalExtras}
                      className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      Save Dental Checklist
                    </button>
                  </div>
                )}


                {/* Diagnosis — search from the admin-managed diagnosis catalog; first one
                    added becomes primary, others secondary, primary can be reassigned. */}
                <div className="card p-6 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <ClipboardList size={18} className="text-primary" /> Diagnosis
                    </h2>
                    <button onClick={openDiagnosisHistory} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                      <History size={13} /> History
                    </button>
                  </div>
                  {summary.diagnoses.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {summary.diagnoses.map((d) => (
                        <div
                          key={d.encounterDiagnosisId}
                          className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm italic"
                        >
                          <div className="flex items-center gap-2">
                            {d.isPrimary && (
                              <span className="rounded-full bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5">
                                Primary
                              </span>
                            )}
                            <span className="font-medium">{d.diagnosisName}</span>
                            {d.diagnosisCode && <span className="text-xs text-muted-foreground">{d.diagnosisCode}</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            {!d.isPrimary && (
                              <button
                                onClick={() => setPrimaryDiagnosis(d.encounterDiagnosisId)}
                                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                              >
                                <Stamp size={12} /> Make primary
                              </button>
                            )}
                            <button
                              onClick={() => removeDiagnosis(d.encounterDiagnosisId)}
                              className="text-xs font-semibold text-red-600 hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No diagnoses added yet.</p>
                  )}
                  <CatalogSearchInput
                    placeholder="Search diagnosis..."
                    fetchOptions={async (search) => {
                      const res = await ConfigListService.get("Diagnosis", search);
                      return (res.data || []).map((i: { listItemId: string; name: string; code: string | null }) => ({
                        id: i.listItemId,
                        name: i.name,
                        code: i.code,
                      }));
                    }}
                    onSelect={(opt) => addDiagnosis(opt.id)}
                  />

                  {/* Narrative Diagnosis */}
                  <div className="flex flex-col gap-1.5 pt-1">
                    <span className="self-start rounded bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
                      Narrative Diagnosis
                    </span>
                    <div className="relative">
                      <textarea
                        rows={3}
                        placeholder="Enter a narrative or free-text description of the diagnosis…"
                        value={encounterForm.diagnosisDescription}
                        onChange={(e) => setEncounterForm((p) => ({ ...p, diagnosisDescription: e.target.value }))}
                        disabled={isCompletedEncounter}
                        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                      {encounterForm.diagnosisDescription && (
                        <button
                          type="button"
                          title="Copy to clipboard"
                          onClick={() => { navigator.clipboard.writeText(encounterForm.diagnosisDescription); toast.success("Copied"); }}
                          className="absolute bottom-2 right-2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Allergies & Sensitivities */}
                <div className="card p-6 flex flex-col gap-4">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <HeartPulse size={18} className="text-primary" /> Allergies &amp; Sensitivities
                  </h2>
                    <div className="flex flex-col gap-2">
                      {summary.allergies.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          <div className="overflow-x-auto rounded-xl border border-red-200 dark:border-red-900/60">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400">
                                  <th className="text-left px-4 py-3 font-semibold tracking-wide">Category</th>
                                  <th className="text-left px-4 py-3 font-semibold tracking-wide">Allergen</th>
                                  <th className="text-left px-4 py-3 font-semibold tracking-wide">Severity</th>
                                  <th className="text-left px-4 py-3 font-semibold tracking-wide">Reaction</th>
                                  <th className="text-left px-4 py-3 font-semibold tracking-wide">Identified</th>
                                  <th className="text-left px-4 py-3 font-semibold tracking-wide">Status</th>
                                  <th className="w-14 px-4 py-3"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-red-100 dark:divide-red-900/40">
                                {summary.allergies.map((a) => (
                                  <tr key={a.patientAllergyId} className="group bg-card hover:bg-red-50/60 dark:hover:bg-red-950/20 transition-colors">
                                    <td className="px-4 py-3 text-foreground/70">{a.allergyCategory || "—"}</td>
                                    <td className="px-4 py-3">
                                      <span className="font-semibold text-red-700 dark:text-red-400">{a.substance}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                      {a.severity ? (
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                          a.severity === "Life-threatening" ? "bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200" :
                                          a.severity === "Severe"           ? "bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300" :
                                          a.severity === "Moderate"         ? "bg-yellow-100 dark:bg-yellow-950/60 text-yellow-700 dark:text-yellow-300" :
                                                                              "bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300"
                                        }`}>{a.severity}</span>
                                      ) : <span className="text-muted-foreground">—</span>}
                                    </td>
                                    <td className="px-4 py-3 text-foreground/70">{a.reaction || "—"}</td>
                                    <td className="px-4 py-3 text-foreground/70">{a.identifiedDate || "—"}</td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                        a.status === "Resolved" ? "bg-muted text-muted-foreground" :
                                        a.status === "Inactive" ? "bg-muted text-muted-foreground" :
                                        "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300"
                                      }`}>{a.status || "Active"}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => startEditAllergy(a)} title="Correct" className="rounded-full p-1 hover:bg-red-100 dark:hover:bg-red-900/40 text-muted-foreground hover:text-foreground">
                                          <Pencil size={12} />
                                        </button>
                                        <button onClick={() => removeAllergy(a)} title="Delete" className="rounded-full p-1 hover:bg-red-100 dark:hover:bg-red-900/40 text-muted-foreground hover:text-red-600">
                                          <Trash2 size={12} />
                                        </button>
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {summary.allergies.some((a) => a.correctedFrom) && (
                            <div className="flex flex-col gap-0.5">
                              {summary.allergies.filter((a) => a.correctedFrom).map((a) => (
                                <CorrectedFromNote key={a.patientAllergyId}>
                                  <p>Previous ({a.substance}): {a.correctedFrom!.substance}{a.correctedFrom!.reaction ? ` · reaction: ${a.correctedFrom!.reaction}` : ""}</p>
                                </CorrectedFromNote>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No known allergies.</p>
                      )}
                    </div>

                    {/* Allergy entry form */}
                    <div className="rounded-lg border border-border bg-muted/30 p-3 flex flex-col gap-3">
                      <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
                        {editingAllergyId ? "Correct Allergy Entry" : "Add Allergy / Sensitivity"}
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted-foreground">Allergy Category <span className="text-destructive">*</span></label>
                          <SearchableSelect
                            value={allergyForm.allergyCategory}
                            onChange={(v) => setAllergyForm((p) => ({ ...p, allergyCategory: v, substance: "" }))}
                            options={[
                              { value: "", label: "Select category" },
                              ...ALLERGY_CATEGORIES.map((c) => ({ value: c, label: c })),
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
                              ...(ALLERGENS_BY_CATEGORY[allergyForm.allergyCategory] ?? []).map((a) => ({ value: a, label: a })),
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
                              ...SEVERITIES.map((s) => ({ value: s, label: s })),
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
                              ...REACTIONS.map((r) => ({ value: r, label: r })),
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
                            options={ALLERGY_STATUSES.map((s) => ({ value: s, label: s }))}
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
                          className="text-sm rounded-lg border border-border bg-background px-2 py-1.5 resize-none"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={addAllergy}
                          className="flex items-center gap-1 rounded-lg border border-primary/30 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
                        >
                          <Plus size={14} /> {editingAllergyId ? "Save Correction" : "Add Allergy"}
                        </button>
                        {editingAllergyId && (
                          <button onClick={cancelEditAllergy} className="text-sm font-semibold text-muted-foreground hover:underline">
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                </div>

                {/* Medications */}
                <div className="card p-6 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <Pill size={18} className="text-primary" /> Medication Tracking
                    </h2>
                    <button onClick={() => setShowMedHistory(true)} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                      <History size={13} /> History
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:divide-x md:divide-border">
                    {/* Current Medications */}
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground/90 flex items-center gap-1.5">
                          Current Medications
                          {summary.currentMedications.length > 0 && (
                            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                              {summary.currentMedications.length}
                            </span>
                          )}
                        </p>
                        {summary.currentMedications.length > 0 && (
                          <button
                            onClick={() => {
                              setPatientAgeForPrint(
                                summary.dateOfBirth
                                  ? Math.floor(
                                      (Date.now() - new Date(summary.dateOfBirth).getTime()) /
                                        (365.25 * 24 * 60 * 60 * 1000)
                                    )
                                  : null
                              );
                              setShowPrescriptionPrint(true);
                            }}
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            Print Prescription
                          </button>
                        )}
                      </div>
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
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {summary.currentMedications.map((m) => (
                                <tr key={m.medicationId} className="italic">
                                  <td className="font-semibold">
                                    {m.drugName}
                                    {m.isDiscontinued && (
                                      <span
                                        className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 align-middle"
                                        title={m.discontinuedDate ? `Discontinued by health authority on ${new Date(m.discontinuedDate).toLocaleDateString()}` : "Discontinued by health authority"}
                                      >
                                        Discontinued
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
                                  <td>
                                    <div className="flex flex-col items-start gap-1">
                                      <div className="flex items-center gap-3">
                                        <button
                                          onClick={() => discontinueMedication(m.medicationId)}
                                          className="text-sm font-semibold text-red-600 hover:underline"
                                        >
                                          Discontinue
                                        </button>
                                        <button onClick={() => setEditingMedication(m)} title="Correct" className="p-1 hover:bg-primary/10 rounded-full text-primary">
                                          <Pencil size={13} />
                                        </button>
                                        <button onClick={() => removeMedication(m)} title="Delete" className="p-1 hover:bg-destructive/10 rounded-full text-destructive">
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                      {m.correctedFrom && (
                                        <CorrectedFromNote>
                                          <p>
                                            Previous: {m.correctedFrom.drugName} ·{" "}
                                            {m.correctedFrom.dosage
                                              ? `${m.correctedFrom.dosage}${m.correctedFrom.dosageUnit ? ` ${m.correctedFrom.dosageUnit}` : ""}`
                                              : "—"}{" "}
                                            · {m.correctedFrom.frequency || "—"}
                                            {m.correctedFrom.durationDays ? ` · ${m.correctedFrom.durationDays} days` : ""}
                                            {m.correctedFrom.route ? ` · ${m.correctedFrom.route}` : ""}
                                          </p>
                                        </CorrectedFromNote>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <EmptyState size="compact" illustration="pharmacy" title="No active medications" />
                      )}
                    </div>

                    {/* Medication History */}
                    <div className="flex flex-col gap-3 md:pl-6">
                      <p className="text-sm font-semibold text-foreground/90 flex items-center gap-1.5">
                        Medication History
                        {summary.medicationHistory.length > 0 && (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                            {summary.medicationHistory.length}
                          </span>
                        )}
                      </p>
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
                  </div>
                </div>

                <PatientMedicalFormsSection
                  patientId={selectedPatientId}
                  visitId={summary?.latestEncounter?.visitId ?? visitIdParam ?? null}
                  patientName={summary?.name}
                  patientNumber={summary?.opNumber || summary?.opId}
                />

              </div>

              <div className="flex flex-col gap-6">
                <MedicationOrderPanel
                  onSubmit={addMedication}
                  editingMedication={editingMedication}
                  onCancelEdit={() => setEditingMedication(null)}
                  prefillFromHistory={prefillMedication}
                  onClearPrefill={() => setPrefillMedication(null)}
                />

                {/* Unified ordering - Lab, Radiology and Treatment all placed from one CPT-
                    code/procedure-name search, shown together in one grouped list below it.
                    Each item's gear icon reopens the same per-type config popup used to
                    create it (see components/orders/) - locked once the owning team has
                    started processing it, or the visit's finalized. */}
                <div className="card p-6 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <FlaskConical size={18} className="text-primary" /> Investigations &amp; Treatments
                    </h2>
                    <button onClick={() => setShowOrderHistory(true)} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                      <History size={13} /> History
                    </button>
                  </div>
                  <CatalogSearchInput
                    placeholder="Search by CPT code or procedure name..."
                    fetchOptions={async (search) => {
                      const res = await ConfigListService.get("Procedure", search);
                      const items: ListItemType[] = res.data || [];
                      items.forEach((i) => procedureResultsRef.current.set(i.listItemId, i));
                      return items.map((i) => ({
                        id: i.listItemId,
                        name: i.name,
                        code: i.code,
                        meta: [i.department, i.orderCategory].filter(Boolean).join(" · ") || undefined,
                      }));
                    }}
                    onSelect={(opt) => {
                      const item = procedureResultsRef.current.get(opt.id);
                      if (item) {
                        setOrderingModal({ mode: "create", item });
                      } else {
                        toast.error("Couldn't load that item — please search again");
                      }
                    }}
                  />
                  <OrderedItemsList
                    labRequests={summary.labRequests}
                    radiologyRequests={summary.radiologyRequests}
                    treatments={summary.treatments}
                    onOpenLab={(item) => setOrderingModal({ mode: "edit-lab", item })}
                    onOpenRadiology={(item) => setOrderingModal({ mode: "edit-radiology", item })}
                    onOpenTreatment={(item) => setOrderingModal({ mode: "edit-treatment", item })}
                    itemClassName="italic"
                  />
                </div>

                {/* Referral */}
                <div className="card p-6 flex flex-col gap-3">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Share2 size={18} className="text-primary" /> Referral Module
                  </h2>
                  <SearchableSelect
                    value={referralForm.targetSpecializationId}
                    onChange={(v) => setReferralForm((p) => ({ ...p, targetSpecializationId: v }))}
                    options={[
                      { value: "", label: "Select target specialty" },
                      ...specializations.map((s) => ({ value: String(s.specializationId), label: s.name })),
                    ]}
                  />
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        checked={referralForm.priority === "Routine"}
                        onChange={() => setReferralForm((p) => ({ ...p, priority: "Routine" }))}
                      />
                      Routine
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        checked={referralForm.priority === "Urgent"}
                        onChange={() => setReferralForm((p) => ({ ...p, priority: "Urgent" }))}
                      />
                      Urgent
                    </label>
                  </div>
                  {referralForm.priority === "Urgent" && (
                    <div className="flex flex-col gap-2 rounded-lg bg-muted/30 p-3">
                      <p className="text-xs font-semibold text-foreground/80">
                        Urgent suspected cancer referral details
                      </p>
                      {referralForm.cancerSiteName ? (
                        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-1.5 text-sm">
                          <span>{referralForm.cancerSiteName}</span>
                          <button
                            onClick={() => setReferralForm((p) => ({ ...p, cancerSiteListItemId: "", cancerSiteName: "" }))}
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            Clear
                          </button>
                        </div>
                      ) : (
                        <CatalogSearchInput
                          placeholder="Search suspected cancer site..."
                          fetchOptions={async (search) => {
                            const res = await ConfigListService.get("CancerSite", search);
                            return (res.data || []).map((i: { listItemId: string; name: string; code: string | null }) => ({
                              id: i.listItemId,
                              name: i.name,
                              code: i.code,
                            }));
                          }}
                          onSelect={(opt) =>
                            setReferralForm((p) => ({ ...p, cancerSiteListItemId: opt.id, cancerSiteName: opt.name }))
                          }
                        />
                      )}
                      <input
                        type="text"
                        placeholder="External facility referred to, if any (e.g. HMC, SIDRA)"
                        value={referralForm.externalFacility}
                        onChange={(e) => setReferralForm((p) => ({ ...p, externalFacility: e.target.value }))}
                        className="h-9 text-sm"
                      />
                    </div>
                  )}
                  <textarea
                    placeholder="Notes for the specialist..."
                    value={referralForm.notes}
                    onChange={(e) => setReferralForm((p) => ({ ...p, notes: e.target.value }))}
                    className="w-full min-h-16 text-sm"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      onClick={addReferral}
                      className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                    >
                      <Share2 size={15} /> {editingReferralId ? "Save Correction" : "Send Referral"}
                    </button>
                    {editingReferralId && (
                      <button onClick={cancelEditReferral} className="text-sm font-semibold text-muted-foreground hover:underline">
                        Cancel
                      </button>
                    )}
                  </div>
                  {summary.referrals.length > 0 && (
                    <div className="flex flex-col gap-1.5 border-t border-border pt-3">
                      {summary.referrals.map((r) => (
                        <div
                          key={r.referralId}
                          className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              {r.targetSpecializationName}
                              {r.cancerSiteName && (
                                <span className="ml-2 text-xs text-muted-foreground">({r.cancerSiteName})</span>
                              )}
                            </span>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-semibold ${
                                  r.priority === "Urgent" ? "text-red-600" : "text-muted-foreground"
                                }`}
                              >
                                {r.priority}
                              </span>
                              {!r.dateSeenBySpecialist && (
                                <>
                                  <button onClick={() => startEditReferral(r)} title="Correct" className="p-1 hover:bg-primary/10 rounded-full text-primary">
                                    <Pencil size={12} />
                                  </button>
                                  <button onClick={() => removeReferral(r)} title="Delete" className="p-1 hover:bg-destructive/10 rounded-full text-destructive">
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          {r.dateSeenBySpecialist ? (
                            <span className="text-xs text-emerald-600">
                              Seen by specialist on {new Date(r.dateSeenBySpecialist).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Awaiting consultation</span>
                          )}
                          {r.correctedFrom && (
                            <CorrectedFromNote>
                              <p>
                                Previous: {r.correctedFrom.targetSpecializationName ?? r.correctedFrom.externalFacility ?? "—"}
                                {` · ${r.correctedFrom.priority}`}
                                {r.correctedFrom.notes ? ` · ${r.correctedFrom.notes}` : ""}
                              </p>
                            </CorrectedFromNote>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Follow-up — an optional booking, not a confirmed appointment; front
                    office calls the patient to arrange the actual visit. */}
                <div className="card p-6 flex flex-col gap-3">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <CalendarPlus size={18} className="text-primary" /> Follow-Up
                  </h2>
                  <DatePicker
                    value={followUpForm.followUpDate}
                    onChange={(v) => setFollowUpForm((p) => ({ ...p, followUpDate: v }))}
                    dateFormat="dd-MM-yyyy"
                    placeholder="DD-MM-YYYY"
                  />
                  <textarea
                    placeholder="Follow-up instructions (optional)"
                    value={followUpForm.instructions}
                    onChange={(e) => setFollowUpForm((p) => ({ ...p, instructions: e.target.value }))}
                    className="w-full min-h-14 text-sm"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      onClick={addFollowUp}
                      className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                    >
                      <CalendarPlus size={15} /> {editingFollowUpId ? "Save Changes" : "Add Follow-Up"}
                    </button>
                    {editingFollowUpId && (
                      <button onClick={cancelEditFollowUp} className="text-sm font-semibold text-muted-foreground hover:underline">
                        Cancel
                      </button>
                    )}
                  </div>
                  {summary.followUps.length > 0 && (
                    <div className="flex flex-col gap-1.5 border-t border-border pt-3">
                      {summary.followUps.map((f) => (
                        <div
                          key={f.followUpId}
                          className="group flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium shrink-0">{formatDate(f.followUpDate)}</span>
                            {f.instructions && <span className="text-xs text-muted-foreground truncate">{f.instructions}</span>}
                          </div>
                          {f.status === "Pending" && (
                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                              <button onClick={() => startEditFollowUp(f)} title="Edit" className="p-1 hover:bg-primary/10 rounded-full text-primary">
                                <Pencil size={12} />
                              </button>
                              <button onClick={() => removeFollowUp(f)} title="Delete" className="p-1 hover:bg-destructive/10 rounded-full text-destructive">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}

        {showDentalChartModal && selectedPatientId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-card w-full max-w-[98vw] max-h-[96vh] rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Stethoscope size={18} className="text-primary" /> Dental Chart
                </h2>
                <button
                  onClick={() => setShowDentalChartModal(false)}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-4">
                {summary?.latestEncounter?.encounterId ? (
                  <DentalChartSection
                    encounterId={summary.latestEncounter.encounterId}
                    patientId={selectedPatientId}
                  />
                ) : (
                  <EmptyState
                    illustration="visits"
                    title="No active encounter"
                    description="Start a visit to access the dental chart."
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {showPrescriptionPrint && summary && (
          <PrescriptionPrintout
            patientName={summary.name}
            patientNumber={summary.opNumber || summary.opId}
            patientAge={patientAgeForPrint}
            patientSex={summary.sex}
            doctorName={getUserDetail()?.name || "Attending Physician"}
            visitDate={new Date().toLocaleDateString()}
            medicines={summary.currentMedications.map((m) => ({
              drugName: m.drugName,
              drugType: m.drugType,
              dosage: m.dosage,
              dosageUnit: m.dosageUnit,
              frequency: m.frequency,
              route: m.route,
              orderType: m.orderType,
              durationDays: m.durationDays,
              instructions: m.instructions,
              totalQuantity: m.totalQuantity,
            }))}
            showPricing={false}
            onClose={() => setShowPrescriptionPrint(false)}
          />
        )}

        {showVitalsHistory && (
          <VitalsHistoryModal entries={vitalsHistory} onClose={() => setShowVitalsHistory(false)} />
        )}

        {/* Diagnosis History Drawer */}
        <HistoryDrawer
          open={showDiagnosisHistory}
          onClose={() => setShowDiagnosisHistory(false)}
          title="Diagnosis History"
          subtitle="Past diagnoses from previous visits — click Re-add to add to the current encounter."
        >
          {isDiagnosisHistoryLoading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : diagnosisHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No past diagnoses found.</p>
          ) : (
            diagnosisHistory.map((d) => (
              <div key={d.encounterDiagnosisId} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-medium text-foreground truncate">{d.diagnosisName}</span>
                  {d.diagnosisCode && <span className="text-xs text-muted-foreground">{d.diagnosisCode}</span>}
                  {d.encounterDate && <span className="text-xs text-muted-foreground">{new Date(d.encounterDate).toLocaleDateString()}</span>}
                </div>
                {d.listItemId && (
                  <button
                    onClick={async () => { await addDiagnosis(d.listItemId!); setShowDiagnosisHistory(false); }}
                    className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                  >
                    Re-add
                  </button>
                )}
              </div>
            ))
          )}
        </HistoryDrawer>

        {/* Medication History Drawer */}
        <HistoryDrawer
          open={showMedHistory}
          onClose={() => setShowMedHistory(false)}
          title="Medication History"
          subtitle="Past prescriptions — click Re-prescribe to pre-fill the prescription form."
        >
          {summary && summary.medicationHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No medication history found.</p>
          ) : (
            (summary?.medicationHistory ?? []).map((m) => (
              <div key={m.medicationId} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-medium text-foreground">{m.drugName}</span>
                  <span className="text-xs text-muted-foreground">
                    {[m.dosage && `${m.dosage}${m.dosageUnit ? ` ${m.dosageUnit}` : ""}`, m.frequency, m.route].filter(Boolean).join(" · ")}
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(m.startedAt).toLocaleDateString()} · {m.status}</span>
                </div>
                <button
                  onClick={() => { setPrefillMedication(m); setShowMedHistory(false); }}
                  className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                >
                  Re-prescribe
                </button>
              </div>
            ))
          )}
        </HistoryDrawer>

        {/* Orders History Drawer */}
        <HistoryDrawer
          open={showOrderHistory}
          onClose={() => setShowOrderHistory(false)}
          title="Investigation & Treatment History"
          subtitle="Past lab, radiology, and treatment orders from all visits."
        >
          {summary && (summary.labRequests.length + summary.radiologyRequests.length + summary.treatments.length) === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No past orders found.</p>
          ) : (
            <>
              {(summary?.labRequests ?? []).map((l) => (
                <div key={l.labRequestId} className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm flex items-center justify-between gap-2">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-1.5"><span className="rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5">LAB</span><span className="font-medium truncate">{l.testType}</span></div>
                    <span className="text-xs text-muted-foreground">{new Date(l.requestedDate).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
              {(summary?.radiologyRequests ?? []).map((r) => (
                <div key={r.radiologyRequestId} className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm flex items-center justify-between gap-2">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-1.5"><span className="rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.5">XRAY</span><span className="font-medium truncate">{r.scanType}</span></div>
                    <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
              {(summary?.treatments ?? []).map((t) => (
                <div key={t.treatmentId} className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm flex items-center justify-between gap-2">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-1.5"><span className="rounded-full bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5">TRT</span><span className="font-medium truncate">{t.description}</span></div>
                    <span className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </HistoryDrawer>

        {/* Past Visits Drawer — lists all recorded encounters for this patient */}
        <HistoryDrawer
          open={showPastVisitsDrawer}
          onClose={() => setShowPastVisitsDrawer(false)}
          title="Past Visits"
          subtitle="Select a visit to open it in read-only view. Completed visits can be reopened via an admin request."
        >
          {pastEncounters.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No past visits found.</p>
          ) : (
            pastEncounters.map((enc) => (
              <div
                key={enc.encounterId}
                className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{formatDate(enc.createdAt)}</span>
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${enc.status === "Completed" ? "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400" : "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"}`}>
                      {enc.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate max-w-xs">{enc.chiefComplaint || "No chief complaint recorded"}</p>
                  {enc.doctorName && <p className="text-xs text-muted-foreground">Dr. {enc.doctorName}</p>}
                </div>
                <button
                  onClick={() => {
                    if (selectedPatientId) openPatient(selectedPatientId, enc.visitId ?? undefined);
                    setShowPastVisitsDrawer(false);
                  }}
                  className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                >
                  Open
                </button>
              </div>
            ))
          )}
        </HistoryDrawer>

        {/* Encounter Notes History Drawer — shows previous encounter notes for reference during a new visit */}
        <HistoryDrawer
          open={showEncounterNotesHistory}
          onClose={() => setShowEncounterNotesHistory(false)}
          title="Encounter Notes History"
          subtitle="Previous visits' chief complaints and dates — click Open to view the full encounter."
        >
          {pastEncounters.filter(e => e.encounterId !== summary?.latestEncounter?.encounterId).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No previous encounter notes found.</p>
          ) : (
            pastEncounters
              .filter(e => e.encounterId !== summary?.latestEncounter?.encounterId)
              .map((enc) => (
                <div
                  key={enc.encounterId}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{formatDate(enc.createdAt)}</span>
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${enc.status === "Completed" ? "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400" : "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"}`}>
                        {enc.status}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/80 mt-0.5">{enc.chiefComplaint || "No chief complaint recorded"}</p>
                    {enc.doctorName && <p className="text-xs text-muted-foreground">Dr. {enc.doctorName}</p>}
                  </div>
                  <button
                    onClick={() => {
                      if (selectedPatientId) openPatient(selectedPatientId, enc.visitId ?? undefined);
                      setShowEncounterNotesHistory(false);
                    }}
                    className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                  >
                    Open
                  </button>
                </div>
              ))
          )}
        </HistoryDrawer>

        {/* Unified ordering config popups - one open at a time, driven by orderingModal's
            mode. "create" branches on the picked catalog item's own OrderCategory; "edit-*"
            reopens the same popup pre-filled from the already-placed order, locked per
            OrderLockHelper. Previously rendered from the WRONG return branch (the workbench
            patient-list view, which a selected patient never reaches - selectedPatientId
            takes the early return above) - that's why clicking a search result appeared to
            do nothing: the state was being set correctly, just nothing was ever mounted to
            read it. */}
        {orderingModal?.mode === "create" && orderingModal.item.orderCategory === "Treatment" && (
          <TreatmentConfigModal
            itemName={orderingModal.item.name}
            values={DEFAULT_TREATMENT_VALUES}
            saving={isSavingOrder}
            submitLabel="Order Treatment"
            onSave={submitTreatment}
            onClose={() => setOrderingModal(null)}
          />
        )}
        {orderingModal?.mode === "create" && orderingModal.item.orderCategory !== "Treatment" && (
          <LabRadiologyConfigModal
            category={orderingModal.item.orderCategory === "Radiology" ? "Radiology" : "Lab"}
            itemName={orderingModal.item.name}
            values={{
              ...DEFAULT_LAB_RADIOLOGY_VALUES,
              price: orderingModal.item.cashPrice != null ? String(orderingModal.item.cashPrice) : "",
            }}
            coverageHint={coverageHintText(orderingModal.item.orderCategory === "Radiology" ? "Radiology" : "Lab")}
            saving={isSavingOrder}
            submitLabel="Place Order"
            onSave={submitLabRadiology}
            onClose={() => setOrderingModal(null)}
          />
        )}
        {orderingModal?.mode === "edit-lab" && (
          <LabRadiologyConfigModal
            category="Lab"
            itemName={orderingModal.item.testType || "Lab test"}
            values={{
              quantity: String(orderingModal.item.quantity),
              priority: orderingModal.item.priority,
              source: orderingModal.item.source,
              remarks: orderingModal.item.remarks || "",
              bodyParts: "",
              price: orderingModal.item.price != null ? String(orderingModal.item.price) : "",
              uccCode: orderingModal.item.uccCode || "",
              covered: orderingModal.item.covered === true ? "Yes" : orderingModal.item.covered === false ? "No" : "",
              preAuthStatus: orderingModal.item.preAuthStatus || "Not Required",
              patientShareAmount: orderingModal.item.patientShareAmount != null ? String(orderingModal.item.patientShareAmount) : "",
              coInsurancePercent: orderingModal.item.coInsurancePercent != null ? String(orderingModal.item.coInsurancePercent) : "",
            }}
            coverageHint={coverageHintText("Lab")}
            locked={orderingModal.item.locked}
            lockedBy={orderingModal.item.lockedBy}
            saving={isSavingOrder}
            submitLabel="Save changes"
            onSave={submitLabRadiology}
            onClose={() => setOrderingModal(null)}
          />
        )}
        {orderingModal?.mode === "edit-radiology" && (
          <LabRadiologyConfigModal
            category="Radiology"
            itemName={orderingModal.item.scanType || "Scan"}
            values={{
              quantity: String(orderingModal.item.quantity),
              priority: orderingModal.item.priority,
              source: orderingModal.item.source,
              remarks: orderingModal.item.notes || "",
              bodyParts: orderingModal.item.bodyParts || "",
              price: orderingModal.item.price != null ? String(orderingModal.item.price) : "",
              uccCode: orderingModal.item.uccCode || "",
              covered: orderingModal.item.covered === true ? "Yes" : orderingModal.item.covered === false ? "No" : "",
              preAuthStatus: orderingModal.item.preAuthStatus || "Not Required",
              patientShareAmount: orderingModal.item.patientShareAmount != null ? String(orderingModal.item.patientShareAmount) : "",
              coInsurancePercent: orderingModal.item.coInsurancePercent != null ? String(orderingModal.item.coInsurancePercent) : "",
            }}
            coverageHint={coverageHintText("Radiology")}
            locked={orderingModal.item.locked}
            lockedBy={orderingModal.item.lockedBy}
            saving={isSavingOrder}
            submitLabel="Save changes"
            onSave={submitLabRadiology}
            onClose={() => setOrderingModal(null)}
          />
        )}
        {orderingModal?.mode === "edit-treatment" && (
          <TreatmentConfigModal
            itemName={orderingModal.item.description}
            values={{
              quantity: String(orderingModal.item.quantity),
              instructions: orderingModal.item.instructions || "",
              isPackage: orderingModal.item.isPackage,
              isBillingPending: orderingModal.item.isBillingPending,
            }}
            locked={orderingModal.item.locked}
            lockedBy={orderingModal.item.lockedBy}
            saving={isSavingOrder}
            submitLabel="Save changes"
            onSave={submitTreatment}
            onClose={() => setOrderingModal(null)}
          />
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
                <button onClick={() => setShowDocumentsModal(false)} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="overflow-y-auto flex-1 p-5">
                {documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                    <FileText size={32} className="opacity-30" />
                    <p className="text-sm">No documents attached to this patient yet.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {documents.map((d) => {
                      const fileUrl = backendAssetUrl(d.filePath);
                      const ext = d.filePath?.split(".").pop()?.toLowerCase() ?? "";
                      const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
                      const isPdf = ext === "pdf";
                      return (
                        <div key={d.patientDocumentId} className="flex flex-col gap-2">
                          <div
                            className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-3 transition-colors ${
                              !d.viewedByDoctor
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
                              {!d.viewedByDoctor && (
                                <span className="shrink-0 rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white">NEW</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {fileUrl ? (
                                <>
                                  {isImage && (
                                    <button
                                      onClick={() => {
                                        setPreviewDocUrl(previewDocUrl === fileUrl ? null : fileUrl);
                                        if (!d.viewedByDoctor) markDocumentViewed(d.patientDocumentId);
                                      }}
                                      className="flex items-center gap-1 rounded-lg bg-primary/10 hover:bg-primary/20 px-3 py-1.5 text-xs font-semibold text-primary transition-colors"
                                    >
                                      {previewDocUrl === fileUrl ? "Hide" : "Preview"}
                                    </button>
                                  )}
                                  <a
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={async () => { if (!d.viewedByDoctor) await markDocumentViewed(d.patientDocumentId); }}
                                    className="flex items-center gap-1 rounded-lg bg-primary/10 hover:bg-primary/20 px-3 py-1.5 text-xs font-semibold text-primary transition-colors"
                                  >
                                    View
                                  </a>
                                  <a
                                    href={fileUrl}
                                    download
                                    onClick={async () => { if (!d.viewedByDoctor) await markDocumentViewed(d.patientDocumentId); }}
                                    className="flex items-center gap-1 rounded-lg border border-border hover:bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition-colors"
                                  >
                                    Download
                                  </a>
                                </>
                              ) : (
                                !d.viewedByDoctor && (
                                  <button onClick={() => markDocumentViewed(d.patientDocumentId)} className="text-xs font-semibold text-primary hover:underline">
                                    Mark reviewed
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                          {isImage && fileUrl && previewDocUrl === fileUrl && (
                            <div className="rounded-lg overflow-hidden border border-border bg-muted/30 flex items-center justify-center">
                              <img src={fileUrl} alt={d.documentType} className="max-h-96 w-full object-contain" />
                            </div>
                          )}
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
                  <div>
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
                    <input type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => setUploadDocFile(e.target.files?.[0] ?? null)} />
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

        {/* Release Patient confirmation modal */}
        {showReleaseConfirm && (
          <AdminPasswordConfirm
            title="Release Patient?"
            description="This will void any unsaved encounter data and return the patient to the appointment queue. Enter your password to confirm."
            confirmLabel="Yes, Release"
            confirmingLabel="Releasing..."
            passwordPlaceholder="Your password"
            onCancel={() => setShowReleaseConfirm(false)}
            onConfirm={releasePatient}
          />
        )}

        {/* Patient warning modal — shown once on file open when allergies or alert exist */}
        {patientWarningModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
              {/* Header */}
              <div className="bg-red-600 dark:bg-red-700 px-6 py-4 flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <AlertTriangle size={22} className="text-white" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-white">Patient Safety Alert</h2>
                  <p className="text-sm text-red-100">Review before proceeding with this patient</p>
                </div>
                <button
                  onClick={() => setPatientWarningModal(null)}
                  className="ml-auto p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="overflow-y-auto flex flex-col gap-4 p-5">
                {/* Patient alert text */}
                {patientWarningModal.alertText.trim() && (
                  <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1.5 flex items-center gap-1.5">
                      <AlertTriangle size={13} /> Clinical Alert
                    </p>
                    <p className="text-sm text-amber-900 dark:text-amber-200 whitespace-pre-wrap">{patientWarningModal.alertText}</p>
                  </div>
                )}

                {/* Allergies */}
                {patientWarningModal.allergies.length > 0 && (
                  <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 flex flex-col gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-400 mb-0.5">
                      Known Allergies / Sensitivities ({patientWarningModal.allergies.length})
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {patientWarningModal.allergies.map((a) => (
                        <div key={a.patientAllergyId} className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-semibold text-red-700 dark:text-red-300">{a.substance}</span>
                          {a.allergyCategory && (
                            <span className="rounded px-1.5 py-0.5 text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300">{a.allergyCategory}</span>
                          )}
                          {a.severity && (
                            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                              a.severity === "Life-threatening" ? "bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-200" :
                              a.severity === "Severe" ? "bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300" :
                              a.severity === "Moderate" ? "bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300" :
                              "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300"
                            }`}>{a.severity}</span>
                          )}
                          {a.reaction && <span className="text-xs text-muted-foreground">→ {a.reaction}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-border flex justify-end">
                <button
                  onClick={() => setPatientWarningModal(null)}
                  className="rounded-lg bg-red-600 hover:bg-red-700 px-6 py-2.5 text-sm font-semibold text-white transition-colors"
                >
                  I Acknowledge — Continue
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
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
      <div className="mb-6 flex flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
            <Stethoscope className="text-primary" /> Doctor Workbench
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Viewing patients across all doctors." : "Your patients, schedule, and clinical cases."}
          </p>
        </div>
        {isAdmin && (
          <div className="w-48 sm:w-72 shrink-0">
            <label htmlFor="workbench-doctor" className="mb-1 block text-xs font-semibold text-muted-foreground">
              Doctor
            </label>
            <SearchableSelect
              id="workbench-doctor"
              value={selectedDoctorId}
              onChange={setSelectedDoctorId}
              className={standaloneSelectClass}
              options={[
                { value: "", label: "All doctors (system-wide)" },
                ...assignedDoctors.map((d) => ({ value: String(d.doctorId), label: `${d.userName} — ${d.specializationName}` })),
              ]}
            />
          </div>
        )}
      </div>

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
          <div className="card p-6">
            <div className="h-5 w-36 mb-4 animate-pulse rounded bg-muted/60" />
            <div className="flex flex-col gap-2">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/50" />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Corrections an admin proposed for one of this doctor's finalized encounters —
              inert until acknowledged, see EncounterCorrection.cs. */}
          {!isAdmin && myPendingCorrections.length > 0 && (
            <div className="card p-6 flex flex-col gap-3 border-l-4 border-l-amber-500">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Bell size={18} className="text-amber-500" /> Pending Corrections
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  ({myPendingCorrections.length} awaiting your review)
                </span>
              </h2>
              <div className="flex flex-col gap-2">
                {myPendingCorrections.map((c) => (
                  <div key={c.encounterCorrectionId} className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div>
                        <span className="font-semibold text-foreground">{c.patientName || "Patient"}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          proposed by {c.proposedByName || "an admin"} · {formatDateTime(c.createdAt)}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => resolveCorrection(c.encounterCorrectionId, "acknowledge")}
                          disabled={resolvingCorrectionId === c.encounterCorrectionId}
                          className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                        >
                          <Check size={13} /> Accept
                        </button>
                        <button
                          onClick={() => resolveCorrection(c.encounterCorrectionId, "reject")}
                          disabled={resolvingCorrectionId === c.encounterCorrectionId}
                          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
                        >
                          <X size={13} /> Reject
                        </button>
                      </div>
                    </div>
                    {c.chiefComplaint && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold">Chief complaint:</span> {c.chiefComplaint}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin: pending encounter unlock requests */}
          {isAdmin && unlockRequests.filter((r) => r.status === "Pending").length > 0 && (
            <div className="card p-6 flex flex-col gap-3 border-l-4 border-l-amber-500">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <UnlockIcon size={18} className="text-amber-500" /> Encounter Unlock Requests
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  ({unlockRequests.filter((r) => r.status === "Pending").length} pending)
                </span>
              </h2>
              <div className="flex flex-col gap-2">
                {unlockRequests.filter((r) => r.status === "Pending").map((r) => (
                  <div key={r.encounterUnlockRequestId} className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold text-foreground">{r.requestedByName ?? "Doctor"}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          requests unlock for {r.patientName ?? "a patient"} · {formatDateTime(r.createdAt)}
                        </span>
                        {r.reason && (
                          <p className="text-xs text-muted-foreground mt-0.5">Reason: {r.reason}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => resolveUnlockRequest(r.encounterUnlockRequestId, "approve")}
                          disabled={resolvingUnlockId === r.encounterUnlockRequestId}
                          className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                        >
                          <Check size={13} /> Approve
                        </button>
                        <button
                          onClick={() => resolveUnlockRequest(r.encounterUnlockRequestId, "deny")}
                          disabled={resolvingUnlockId === r.encounterUnlockRequestId}
                          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
                        >
                          <X size={13} /> Deny
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard icon={<Users size={18} />} label="Patients Under Care" value={dashboard?.patientsUnderCare ?? 0} hint="Total patients currently assigned to you with an open encounter." />
            <StatCard icon={<Activity size={18} />} label="Active Cases" value={dashboard?.activeCases ?? 0} hint="Patients with an ongoing case that has not yet been closed or discharged." />
            <StatCard icon={<CalendarClock size={18} />} label="Today's Appointments" value={dashboard?.todaysAppointments ?? 0} hint="Number of appointments scheduled for today across all your patients." />
            <StatCard icon={<FileText size={18} />} label="Pending Reports" value={dashboard?.pendingReports ?? 0} hint="Lab and radiology results that have been completed but not yet reviewed by you." />
            <StatCard icon={<AlertTriangle size={18} />} label="Urgent Items" value={dashboard?.urgentItems ?? 0} accent hint="High-priority tasks or alerts flagged for your immediate attention." />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card p-6">
              <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <CalendarClock size={18} className="text-primary" /> My Schedules
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative w-48">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search by name..."
                      value={scheduleSearch}
                      onChange={(e) => setScheduleSearch(e.target.value)}
                      className="w-full h-9 pl-8 text-sm rounded-lg border border-border bg-muted px-3 text-foreground"
                    />
                  </div>
                  <div className="w-44">
                    <DatePicker
                      value={scheduleDate}
                      onChange={(val) => setScheduleDate(val)}
                      dateFormat="dd/MM/yyyy"
                      placeholder="Pick a date"
                      className="flex h-9 w-full items-center gap-2 overflow-hidden rounded-lg border border-border bg-muted px-3 text-sm text-foreground transition-all focus-within:border-primary focus-within:outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                {isLoadingSchedule ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Time</th>
                        <th>Type</th>
                        <th>Appt. Status</th>
                        <th>Visit Status</th>
                        <th>Waiting</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const filtered = scheduleSearch.trim()
                          ? schedule.filter((s) => s.patientName?.toLowerCase().includes(scheduleSearch.toLowerCase()))
                          : schedule;
                        return filtered.length > 0 ? (
                        filtered.map((item) => (
                          <tr key={item.appointmentId}>
                            <td className="font-semibold">{item.patientName}</td>
                            <td className="whitespace-nowrap">{new Date(item.appointmentDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                            <td>
                              {item.isWalkIn ? (
                                <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold px-2 py-0.5">
                                  Walk-in
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5">
                                  Scheduled
                                </span>
                              )}
                            </td>
                            <td className="text-sm">{item.status}</td>
                            <td className="text-sm">
                              {item.visitStatus ? (
                                <span className="text-green-600 dark:text-green-400 font-medium">{item.visitStatus.replace(/([A-Z])/g, " $1").trim()}</span>
                              ) : (
                                <span className="text-muted-foreground">Not arrived</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap font-mono text-sm">
                              {item.checkedInAt ? (
                                <span className={`${formatWait(item.checkedInAt) !== "—" && parseInt(formatWait(item.checkedInAt)) >= 30 ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}`}>
                                  {formatWait(item.checkedInAt)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td>
                              <button
                                onClick={() => openPatient(item.patientId, item.visitId)}
                                className="text-sm font-semibold text-primary hover:underline"
                              >
                                See Patient
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7}>
                            {scheduleSearch.trim() ? (
                              <EmptyState size="compact" illustration="search" title="No patients match your search" />
                            ) : (
                              <EmptyState size="compact" illustration="visits" title="No appointments on this date" />
                            )}
                          </td>
                        </tr>
                      );
                      })()}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Activity size={18} className="text-primary" /> Active Cases
              </h2>
              <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
                {activeCases.length > 0 ? (
                  activeCases.map((c) => (
                    <button
                      key={c.encounterId}
                      onClick={() => openPatient(c.patientId)}
                      className="text-left rounded-lg border border-border bg-muted/30 px-3 py-2 hover:border-primary/40 transition-colors"
                    >
                      <p className="font-semibold text-sm text-foreground">{c.patientName}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.chiefComplaint || "No chief complaint recorded"}</p>
                    </button>
                  ))
                ) : (
                  <EmptyState size="compact" illustration="clipboard" title="No open cases" />
                )}
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Users size={18} className="text-primary" /> Patients
                </h2>
                {!searchTerm.trim() && patients.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {patients.length <= PAGE_SIZE ? `${patients.length} patients` : `Page ${patientsPage} of ${totalPatientPages}`}
                  </span>
                )}
              </div>
              <div className="relative w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name or MRN…"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPatientsPage(1); }}
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
                    <th>Age</th>
                    <th>Sex</th>
                    <th>Last Visit</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedPatients.length > 0 ? (
                    pagedPatients.map((p) => (
                      <tr key={p.opId}>
                        <td className="font-mono text-xs">{p.opNumber || p.opId}</td>
                        <td className="font-semibold">{p.name}</td>
                        <td>{p.age ?? "—"}</td>
                        <td>{p.sex || "—"}</td>
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
                      <td colSpan={6}>
                        <EmptyState size="compact" illustration="patients" title="No patients found" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {!searchTerm.trim() && totalPatientPages > 1 && (
              <div className="flex items-center justify-between px-2 pt-3 pb-1 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  Page {patientsPage} of {totalPatientPages} &mdash; {filteredPatients.length} patients
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPatientsPage((p) => Math.max(1, p - 1))}
                    disabled={patientsPage === 1}
                    className="px-3 py-1 text-xs rounded-md border border-border disabled:opacity-40 hover:bg-muted transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPatientsPage((p) => Math.min(totalPatientPages, p + 1))}
                    disabled={patientsPage === totalPatientPages}
                    className="px-3 py-1 text-xs rounded-md border border-border disabled:opacity-40 hover:bg-muted transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {emrModal && (
        <PatientEmrModal
          patientId={emrModal.patientId}
          patientName={emrModal.patientName}
          isOpen={!!emrModal}
          onClose={() => setEmrModal(null)}
        />
      )}
    </div>
  );
}

export default function DoctorWorkbenchPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    }>
      <DoctorWorkbenchInner />
    </Suspense>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: boolean;
  hint?: string;
}) {
  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
        <div className="flex items-center gap-1.5">
          {hint && <HintTooltip text={hint} />}
          <span className={accent && value > 0 ? "text-red-600" : "text-primary"}>{icon}</span>
        </div>
      </div>
      <p className={`text-2xl font-semibold ${accent && value > 0 ? "text-red-600" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
