"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Users,
  X,
} from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import DatePicker from "@/components/DatePicker";
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
import DentalChartSection from "@/components/dental/DentalChartSection";
import { getUserDetail } from "@/lib/userDetail";
import { confirmDeleteToast } from "@/lib/confirmDeleteToast";
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
  AllergyType,
  ChronicConditionType,
  DoctorConfidentialNoteType,
  DoctorDashboardSummaryType,
  EmrPatientListItem,
  EncounterCorrectionType,
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
  const searchParams = useSearchParams();
  const visitIdParam = searchParams.get("visitId") || undefined;
  const initialPatientIdParam = searchParams.get("patientId") || undefined;

  const [role, setRole] = useState<string | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);

  const [assignedDoctors, setAssignedDoctors] = useState<AssignedDoctorsInfo[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");

  const [showPrescriptionPrint, setShowPrescriptionPrint] = useState(false);

  const [dashboard, setDashboard] = useState<DoctorDashboardSummaryType | null>(null);
  const [schedule, setSchedule] = useState<TodayScheduleItemType[]>([]);
  const [activeCases, setActiveCases] = useState<ActiveCaseItemType[]>([]);
  const [patients, setPatients] = useState<EmrPatientListItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingWorkbench, setIsLoadingWorkbench] = useState(true);

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [summary, setSummary] = useState<PatientSummaryType | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
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
  const fetchWorkbench = async () => {
    try {
      setIsLoadingWorkbench(true);
      const [dashboardRes, scheduleRes, activeCasesRes, patientsRes] = await Promise.all([
        EmrService.getDashboardSummary(doctorIdParam),
        EmrService.getTodaySchedule(doctorIdParam),
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

  useSignalRRefetch(
    [
      "appointmentCreated",
      "appointmentCancelled",
      "appointmentStatusUpdated",
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
  const [documents, setDocuments] = useState<{ patientDocumentId: string; documentType: string; createdAt: string }[]>([]);
  const [unviewedDocumentCount, setUnviewedDocumentCount] = useState(0);
  const [showDocuments, setShowDocuments] = useState(false);

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
  const openPatient = async (patientId: string) => {
    setSelectedPatientId(patientId);
    await Promise.all([
      fetchSummary(patientId),
      fetchQuickNotes(patientId),
      fetchDocuments(patientId),
      fetchConfidentialNotes(patientId),
      fetchLatestVitals(patientId),
    ]);
  };

  const fetchSummary = async (patientId: string) => {
    try {
      setIsLoadingSummary(true);
      const res = await EmrService.getPatientSummary(patientId, doctorIdParam);
      setSummary(res.data);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load patient summary"));
      setSummary(null);
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

  const backToWorkbench = () => {
    setSelectedPatientId(null);
    setSummary(null);
    setQuickNotes([]);
    setConfidentialNotes([]);
    setVitalsHistory([]);
    setNurseSpecialRemarks([]);
    setNurseNotes([]);
    setNurseExaminationNotes([]);
    fetchWorkbench();
  };

  // Arriving from the reception visit queue (?patientId=&visitId=) opens that patient's
  // EMR panel directly instead of landing on the workbench list.
  useEffect(() => {
    if (checkedAuth && initialPatientIdParam) {
      openPatient(initialPatientIdParam);
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
    plannedProcedures: "",
    examinationNotes: "",
    clinicalExamination: "",
    ...emptyRos,
  });
  // Baseline the form is compared against to detect unsaved edits — only meaningful for
  // admin viewing a Completed (locked) encounter, where the floating Save/Revert bar and
  // the "propose correction" flow kick in instead of the normal direct save.
  const [encounterFormSnapshot, setEncounterFormSnapshot] = useState(encounterForm);
  const [isSavingEncounter, setIsSavingEncounter] = useState(false);

  const isCompletedEncounter = summary?.latestEncounter?.status === "Completed";
  const isEncounterDirty =
    isAdmin && isCompletedEncounter && JSON.stringify(encounterForm) !== JSON.stringify(encounterFormSnapshot);

  useEffect(() => {
    const e = summary?.latestEncounter;
    const loaded = {
      chiefComplaint: e?.chiefComplaint || "",
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
    };
    setEncounterForm(loaded);
    setEncounterFormSnapshot(loaded);
    // Intentionally re-run only when the encounter identity changes, not on every field edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary?.latestEncounter?.encounterId]);

  const saveEncounter = async () => {
    if (!selectedPatientId || !requireDoctorSelected()) return;
    try {
      setIsSavingEncounter(true);
      await EmrService.upsertEncounter(
        selectedPatientId,
        { ...encounterForm, visitId: visitIdParam },
        doctorIdParam
      );
      toast.success("Encounter saved");
      await fetchSummary(selectedPatientId);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save encounter"));
    } finally {
      setIsSavingEncounter(false);
    }
  };

  const revertEncounterForm = () => setEncounterForm(encounterFormSnapshot);

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
    try {
      setIsProposingCorrection(true);
      await EmrService.proposeEncounterCorrection(selectedPatientId, summary.latestEncounter.encounterId, {
        ...encounterForm,
        targetUserId: selectedCorrectionDoctorId,
      });
      toast.success("Correction sent — it applies once the doctor acknowledges it");
      setEncounterFormSnapshot(encounterForm);
      setShowCorrectionModal(false);
      await fetchEncounterCorrections();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to send correction"));
    } finally {
      setIsProposingCorrection(false);
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

  // ---------------- ALLERGIES ----------------
  const [allergyForm, setAllergyForm] = useState({ substance: "", reaction: "" });
  const [editingAllergyId, setEditingAllergyId] = useState<string | null>(null);

  const addAllergy = async () => {
    if (!selectedPatientId || !allergyForm.substance.trim()) {
      toast.error("Substance is required");
      return;
    }
    if (!requireDoctorSelected()) return;
    try {
      const payload = { substance: allergyForm.substance.trim(), reaction: allergyForm.reaction.trim() || undefined };
      if (editingAllergyId) {
        await EmrService.updateAllergy(editingAllergyId, payload, doctorIdParam);
        toast.success("Allergy corrected");
      } else {
        await EmrService.addAllergy(selectedPatientId, payload, doctorIdParam);
        toast.success("Allergy added");
      }
      setAllergyForm({ substance: "", reaction: "" });
      setEditingAllergyId(null);
      await fetchSummary(selectedPatientId);
    } catch (error) {
      toast.error(errorMessage(error, editingAllergyId ? "Failed to correct allergy" : "Failed to add allergy"));
    }
  };

  const startEditAllergy = (a: AllergyType) => {
    setEditingAllergyId(a.patientAllergyId);
    setAllergyForm({ substance: a.substance, reaction: a.reaction || "" });
  };

  const cancelEditAllergy = () => {
    setEditingAllergyId(null);
    setAllergyForm({ substance: "", reaction: "" });
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
      setOrderingModal(null);
      await fetchSummary(selectedPatientId);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save order"));
    } finally {
      setIsSavingOrder(false);
    }
  };

  const submitTreatment = async (values: TreatmentConfigValues) => {
    if (!selectedPatientId || !orderingModal) return;
    if (!requireDoctorSelected()) return;
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
      setOrderingModal(null);
      await fetchSummary(selectedPatientId);
    } catch (error) {
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
    try {
      setIsSavingConfidential(true);
      if (editingConfidentialNoteId) {
        await EmrService.updateConfidentialNote(editingConfidentialNoteId, { contentHtml: confidentialText.trim() });
        toast.success("Confidential statement updated");
      } else {
        await EmrService.addConfidentialNote(selectedPatientId, { contentHtml: confidentialText.trim() });
        toast.success("Confidential statement saved");
      }
      setConfidentialText("");
      setEditingConfidentialNoteId(null);
      await fetchConfidentialNotes(selectedPatientId);
    } catch (error) {
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

  // ---------------- REFERRAL ----------------
  const [referralForm, setReferralForm] = useState({
    targetSpecializationId: "",
    priority: "Routine",
    notes: "",
    cancerSiteListItemId: "",
    cancerSiteName: "",
    externalFacility: "",
  });
  const [referralOutcomeDates, setReferralOutcomeDates] = useState<Record<string, string>>({});
  const [savingOutcomeId, setSavingOutcomeId] = useState<string | null>(null);
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

  const saveReferralOutcome = async (referralId: string) => {
    const dateSeenBySpecialist = referralOutcomeDates[referralId];
    if (!dateSeenBySpecialist) {
      toast.error("Pick the date the patient was seen");
      return;
    }
    if (!requireDoctorSelected()) return;
    try {
      setSavingOutcomeId(referralId);
      await EmrService.setReferralOutcome(referralId, { dateSeenBySpecialist }, doctorIdParam);
      toast.success("Referral outcome recorded");
      if (selectedPatientId) await fetchSummary(selectedPatientId);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to record referral outcome"));
    } finally {
      setSavingOutcomeId(null);
    }
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
    if (latest) {
      setDentalForm({
        fissureSealantApplied: latest.fissureSealantApplied,
        fluorideApplied: latest.fluorideApplied,
        sdfApplied: latest.sdfApplied,
        oralHygieneEducationGiven: latest.oralHygieneEducationGiven,
        lifestyleEducationGiven: latest.lifestyleEducationGiven,
        smokingCessationEducationGiven: latest.smokingCessationEducationGiven,
        comprehensiveDentalPlanProvided: latest.comprehensiveDentalPlanProvided,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatientId]);

  const saveDentalExtras = async () => {
    if (!selectedPatientId) return;
    if (!requireDoctorSelected()) return;
    try {
      setIsSavingDentalExtras(true);
      await EmrService.saveDentalExtras(
        selectedPatientId,
        { encounterId: summary?.latestEncounter?.encounterId, ...dentalForm },
        doctorIdParam
      );
      toast.success("Dental checklist saved");
      await fetchSummary(selectedPatientId);
    } catch (error) {
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
    try {
      await EmrService.addQuickNote(selectedPatientId, noteText.trim(), doctorIdParam);
      toast.success("Note added");
      setNoteText("");
      await fetchQuickNotes(selectedPatientId);
    } catch (error) {
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
    try {
      await EmrService.updateQuickNote(editingQuickNoteId, editingQuickNoteText.trim(), doctorIdParam);
      toast.success("Note updated");
      cancelEditQuickNote();
      await fetchQuickNotes(selectedPatientId);
    } catch (error) {
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

  const filteredPatients = patients.filter(
    (p) =>
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.opNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.opId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <button
          onClick={backToWorkbench}
          className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary mb-6"
        >
          <ArrowLeft size={16} /> Back to workbench
        </button>

        {isLoadingSummary || !summary ? (
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
                    {summary.phone || "No phone"} · {summary.email || "No email"}
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
                  {unviewedDocumentCount > 0 && (
                    <button
                      onClick={() => setShowDocuments((v) => !v)}
                      className="flex items-center gap-1.5 rounded-full bg-blue-100 dark:bg-blue-950/40 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-400 cursor-pointer"
                    >
                      <Bell size={13} /> {unviewedDocumentCount} new document{unviewedDocumentCount === 1 ? "" : "s"}
                    </button>
                  )}
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

              {showDocuments && documents.length > 0 && (
                <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-border">
                  {documents.map((d) => (
                    <div
                      key={d.patientDocumentId}
                      className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm"
                    >
                      <span className="font-medium">{d.documentType}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{formatDateTime(d.createdAt)}</span>
                        <button
                          onClick={() => markDocumentViewed(d.patientDocumentId)}
                          className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                        >
                          Mark reviewed
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Latest Vitals — merged from Triage (nurse's intake reading) and VitalsRecord
                (nurse's ongoing readings), read-only here so the doctor has it in view while
                prescribing/ordering without leaving the workbench. History icon opens the
                full timeline + trend graph (see the modal below). */}
            {latestVitals && (
              <div className="card px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span className="flex items-center gap-1.5 font-semibold text-foreground/90">
                  <HeartPulse size={16} className="text-primary" /> Latest Vitals
                  <span className="font-normal text-xs text-muted-foreground">
                    ({latestVitals.source === "Triage" ? "Triage" : "Nursing"} · {formatDateTime(latestVitals.recordedAt)})
                  </span>
                </span>
                {[
                  ["Height", latestVitals.heightCm ? `${latestVitals.heightCm} cm` : null],
                  ["Weight", latestVitals.weightKg ? `${latestVitals.weightKg} kg` : null],
                  ["BMI", latestVitals.bmi ? latestVitals.bmi.toFixed(1) : null],
                  ["Temp", latestVitals.temperature ? `${latestVitals.temperature}°C` : null],
                  ["Heart rate", latestVitals.heartRate ? `${latestVitals.heartRate} BPM` : null],
                  [
                    "B.P",
                    latestVitals.systolic && latestVitals.diastolic
                      ? `${latestVitals.systolic}/${latestVitals.diastolic} mmHg`
                      : null,
                  ],
                  [
                    "B.P (M)",
                    latestVitals.systolic && latestVitals.diastolic
                      ? `${Math.round(latestVitals.diastolic + (latestVitals.systolic - latestVitals.diastolic) / 3)} mmHg`
                      : null,
                  ],
                  ["Respiratory", latestVitals.respiratory ? `${latestVitals.respiratory} bpm` : null],
                  ["O2 Sat", latestVitals.oxygenSaturation ? `${latestVitals.oxygenSaturation}%` : null],
                  ["Blood sugar", latestVitals.bloodSugar ? `${latestVitals.bloodSugar} mmol/L` : null],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <span key={label} className="text-muted-foreground">
                      {label}: <span className="font-semibold text-foreground">{value}</span>
                    </span>
                  ))}
                <button
                  type="button"
                  onClick={() => setShowVitalsHistory(true)}
                  title="View vitals history"
                  className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  <History size={14} /> History
                </button>
              </div>
            )}

            {/* Nurse Entries — this patient's nurse-recorded remarks/notes/examination,
                surfaced here instead of a separate Nurse Workbench module (removed from the
                doctor's sidebar - see helpers/sidebaritems.ts). Read-only, same data the
                nurse enters via NursingController.GetPatientChart. */}
            {(nurseSpecialRemarks.length > 0 || nurseNotes.length > 0 || nurseExaminationNotes.length > 0) && (
              <div className="card p-5 flex flex-col gap-4">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <StickyNote size={16} className="text-primary" /> Nurse Entries
                </h2>

                {nurseSpecialRemarks.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <AlertTriangle size={13} /> Special Remarks
                    </p>
                    {nurseSpecialRemarks.map((r) => (
                      <div key={r.specialRemarkId} className="rounded-lg bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-sm">
                        <p className="text-foreground">
                          <span className="font-semibold">{r.remarkType}:</span> {r.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{formatDateTime(r.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {nurseNotes.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <StickyNote size={13} /> Nurse Notes
                    </p>
                    {nurseNotes.map((n) => (
                      <div key={n.nurseNoteId} className="rounded-lg bg-muted/30 px-3 py-2 text-sm">
                        <p className="text-foreground">{n.contentHtml}</p>
                        <p className="text-xs text-muted-foreground mt-1">{n.nurseName ?? "Nurse"} · {formatDateTime(n.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {nurseExaminationNotes.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <NotebookPen size={13} /> Examination Notes
                    </p>
                    {nurseExaminationNotes.map((e) => (
                      <div key={e.examinationNoteId} className="rounded-lg bg-muted/30 px-3 py-2 text-sm flex flex-col gap-1">
                        {e.generalAppearance && (
                          <p><span className="font-semibold">General appearance:</span> {e.generalAppearance}</p>
                        )}
                        <p><span className="font-semibold">Pain level:</span> {e.painLevel}/10</p>
                        {e.mobility && <p><span className="font-semibold">Mobility:</span> {e.mobility}</p>}
                        {e.clinicalChecks && <p><span className="font-semibold">Clinical checks:</span> {e.clinicalChecks}</p>}
                        <p className="text-xs text-muted-foreground mt-1">{e.nurseName ?? "Nurse"} · {formatDateTime(e.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Drug allergy banner — summarizes what's already on file; the Allergies
                section further down is where new ones get added. */}
            {summary.allergies.length > 0 && (
              <div className="rounded-lg border border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 px-4 py-2.5 flex flex-wrap items-center gap-2 text-sm">
                <AlertTriangle size={16} className="text-red-600 dark:text-red-400 shrink-0" />
                <span className="font-bold text-red-700 dark:text-red-400">Drug Allergy:</span>
                {summary.allergies.map((a) => (
                  <span
                    key={a.patientAllergyId}
                    className="rounded-full bg-red-100 dark:bg-red-900/40 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400"
                  >
                    {a.substance}
                    {a.reaction ? ` — ${a.reaction}` : ""}
                  </span>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 flex flex-col gap-6">
                {/* Chief complaint / examination notes / review of systems / clinical exam */}
                <div className="card p-6 flex flex-col gap-4">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <FileText size={18} className="text-primary" /> Encounter Notes
                  </h2>

                  {isCompletedEncounter && (
                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      {isAdmin
                        ? "This encounter is finalized — edits here are proposed as a correction, not saved directly."
                        : "This encounter is finalized and locked. Ask an admin to request a correction if it needs to change."}
                    </div>
                  )}

                  {encounterCorrections.some((c) => c.status === "Pending") && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                      A correction is pending the doctor&apos;s acknowledgment.
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted-foreground">Chief complaint</label>
                    <input
                      type="text"
                      placeholder="Patient's primary reason for the visit..."
                      value={encounterForm.chiefComplaint}
                      onChange={(e) => setEncounterForm((p) => ({ ...p, chiefComplaint: e.target.value }))}
                      disabled={isCompletedEncounter && !isAdmin}
                      className="h-10 text-sm disabled:opacity-60"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted-foreground">Examination notes</label>
                    <textarea
                      placeholder="Doctor's examination notes..."
                      value={encounterForm.examinationNotes}
                      onChange={(e) => setEncounterForm((p) => ({ ...p, examinationNotes: e.target.value }))}
                      disabled={isCompletedEncounter && !isAdmin}
                      className="w-full min-h-16 text-sm disabled:opacity-60"
                    />
                  </div>

                  <details className="group">
                    <summary className="cursor-pointer text-sm font-semibold text-foreground/90 flex items-center gap-2 list-none">
                      <ClipboardList size={16} className="text-primary" /> Review of Systems
                      <span className="text-xs font-normal text-muted-foreground">(click to expand)</span>
                    </summary>
                    <div className="mt-3">
                      <ReviewOfSystemsPanel
                        value={encounterForm}
                        onChange={(key, value) => setEncounterForm((p) => ({ ...p, [key]: value }))}
                        disabled={isCompletedEncounter && !isAdmin}
                      />
                    </div>
                  </details>

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
                        <select
                          value={selectedCorrectionDoctorId}
                          onChange={(e) => setSelectedCorrectionDoctorId(e.target.value)}
                          className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                        >
                          <option value="">Select doctor…</option>
                          {correctionDoctors.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
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
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <ClipboardList size={18} className="text-primary" /> Diagnosis
                  </h2>
                  {summary.diagnoses.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {summary.diagnoses.map((d) => (
                        <div
                          key={d.encounterDiagnosisId}
                          className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm"
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
                </div>

                {/* Medical history */}
                <div className="card p-6 flex flex-col gap-4">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <HeartPulse size={18} className="text-primary" /> Medical History
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {summary.chronicConditions.length > 0 ? (
                      summary.chronicConditions.map((c) => (
                        <div
                          key={c.chronicConditionId}
                          className="group rounded-lg border border-border bg-muted/30 px-3 py-2 min-w-48"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm text-foreground">{c.name}</span>
                            <span className="rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5">
                              {c.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-muted-foreground">
                              Diagnosed {c.diagnosedYear ?? "—"}
                            </p>
                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => startEditCondition(c)} title="Correct" className="p-1 hover:bg-primary/10 rounded-full text-primary">
                                <Pencil size={12} />
                              </button>
                              <button onClick={() => removeCondition(c)} title="Delete" className="p-1 hover:bg-destructive/10 rounded-full text-destructive">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                          {c.correctedFrom && (
                            <CorrectedFromNote>
                              <p>
                                Previous: {c.correctedFrom.name}
                                {c.correctedFrom.diagnosedYear ? ` · diagnosed ${c.correctedFrom.diagnosedYear}` : ""}
                                {` · ${c.correctedFrom.status}`}
                                {c.correctedFrom.diabetesType ? ` · ${c.correctedFrom.diabetesType}` : ""}
                              </p>
                            </CorrectedFromNote>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No chronic conditions recorded.</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 items-end border-t border-border pt-4">
                    <input
                      type="text"
                      placeholder="Condition name"
                      value={conditionForm.name}
                      onChange={(e) => setConditionForm((p) => ({ ...p, name: e.target.value }))}
                      className="h-10 text-sm flex-1 min-w-40"
                    />
                    <input
                      type="number"
                      placeholder="Year"
                      value={conditionForm.diagnosedYear}
                      onChange={(e) => setConditionForm((p) => ({ ...p, diagnosedYear: e.target.value }))}
                      className="h-10 text-sm w-24"
                    />
                    <select
                      value={conditionForm.status}
                      onChange={(e) => setConditionForm((p) => ({ ...p, status: e.target.value }))}
                      className="h-10 text-sm"
                    >
                      <option value="Managed">Managed</option>
                      <option value="Active">Active</option>
                    </select>
                    <button
                      onClick={addCondition}
                      className="flex items-center gap-1 rounded-lg border border-primary/30 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
                    >
                      <Plus size={14} /> {editingConditionId ? "Save Correction" : "Add Condition"}
                    </button>
                    {editingConditionId && (
                      <button onClick={cancelEditCondition} className="text-sm font-semibold text-muted-foreground hover:underline">
                        Cancel
                      </button>
                    )}
                  </div>

                  {(isDiabetesCondition || isHypertensionCondition) && (
                    <div className="flex flex-wrap items-end gap-3 -mt-2 rounded-lg bg-muted/30 p-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">Exact diagnosis date</label>
                        <input
                          type="date"
                          value={conditionForm.diagnosisDate}
                          onChange={(e) => setConditionForm((p) => ({ ...p, diagnosisDate: e.target.value }))}
                          className="h-9 text-sm"
                        />
                      </div>
                      {isDiabetesCondition && (
                        <>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">Diabetes type</label>
                            <select
                              value={conditionForm.diabetesType}
                              onChange={(e) => setConditionForm((p) => ({ ...p, diabetesType: e.target.value }))}
                              className="h-9 text-sm"
                            >
                              <option value="">Unspecified</option>
                              <option value="Type1">Type 1</option>
                              <option value="Type2">Type 2</option>
                              <option value="Gestational">Gestational</option>
                              <option value="SteroidInduced">Steroid-Induced</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <label className="flex items-center gap-2 text-sm">
                            <ToggleButton
                              checked={conditionForm.hasPcos}
                              onChange={(checked) => setConditionForm((p) => ({ ...p, hasPcos: checked }))}
                            />
                            Polycystic ovaries
                          </label>
                        </>
                      )}
                      {isHypertensionCondition && (
                        <label className="flex items-center gap-2 text-sm">
                          <ToggleButton
                            checked={conditionForm.hasEsrd}
                            onChange={(checked) => setConditionForm((p) => ({ ...p, hasEsrd: checked }))}
                          />
                          End-stage renal disease
                        </label>
                      )}
                    </div>
                  )}

                  <div className="border-t border-border pt-4 flex flex-col gap-2">
                    <p className="text-sm font-semibold text-foreground/90">Allergies / Reactions</p>
                    <div className="flex flex-wrap gap-2">
                      {summary.allergies.length > 0 ? (
                        summary.allergies.map((a) => (
                          <span
                            key={a.patientAllergyId}
                            className="group flex flex-col gap-1 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-1.5 text-sm text-red-700 dark:text-red-400"
                          >
                            <span className="flex items-center gap-2">
                              {a.substance} {a.reaction ? `— ${a.reaction}` : ""}
                              <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => startEditAllergy(a)} title="Correct" className="p-0.5 hover:bg-black/10 rounded-full">
                                  <Pencil size={11} />
                                </button>
                                <button onClick={() => removeAllergy(a)} title="Delete" className="p-0.5 hover:bg-black/10 rounded-full">
                                  <Trash2 size={11} />
                                </button>
                              </span>
                            </span>
                            {a.correctedFrom && (
                              <CorrectedFromNote>
                                <p>
                                  Previous: {a.correctedFrom.substance}
                                  {a.correctedFrom.reaction ? ` · reaction: ${a.correctedFrom.reaction}` : ""}
                                </p>
                              </CorrectedFromNote>
                            )}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No known allergies.</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 items-end">
                      <input
                        type="text"
                        placeholder="Substance"
                        value={allergyForm.substance}
                        onChange={(e) => setAllergyForm((p) => ({ ...p, substance: e.target.value }))}
                        className="h-10 text-sm flex-1 min-w-32"
                      />
                      <input
                        type="text"
                        placeholder="Reaction"
                        value={allergyForm.reaction}
                        onChange={(e) => setAllergyForm((p) => ({ ...p, reaction: e.target.value }))}
                        className="h-10 text-sm flex-1 min-w-32"
                      />
                      <button
                        onClick={addAllergy}
                        className="flex items-center gap-1 rounded-lg border border-primary/30 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
                      >
                        <Plus size={14} /> {editingAllergyId ? "Save Correction" : "Add"}
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
                        className="text-sm font-semibold text-primary hover:underline"
                      >
                        Print Prescription
                      </button>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-foreground/90 mb-2">Current Medications</p>
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
                              <tr key={m.medicationId}>
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
                      <p className="text-sm text-muted-foreground">No active medications.</p>
                    )}
                  </div>

                  {summary.medicationHistory.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-foreground/90 mb-2">Medication History</p>
                      <div className="flex flex-col gap-1.5">
                        {summary.medicationHistory.map((m) => (
                          <div
                            key={m.medicationId}
                            className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm"
                          >
                            <span className="font-medium">{m.drugName}</span>
                            <span className="text-muted-foreground text-xs">
                              Ended {formatDate(m.endedAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

              </div>

              <div className="flex flex-col gap-6">
                <MedicationOrderPanel
                  onSubmit={addMedication}
                  editingMedication={editingMedication}
                  onCancelEdit={() => setEditingMedication(null)}
                />

                {/* Unified ordering - Lab, Radiology and Treatment all placed from one CPT-
                    code/procedure-name search, shown together in one grouped list below it.
                    Each item's gear icon reopens the same per-type config popup used to
                    create it (see components/orders/) - locked once the owning team has
                    started processing it, or the visit's finalized. */}
                <div className="card p-6 flex flex-col gap-3">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <FlaskConical size={18} className="text-primary" /> Investigations &amp; Treatments
                  </h2>
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
                  />
                </div>

                {/* Referral */}
                <div className="card p-6 flex flex-col gap-3">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Share2 size={18} className="text-primary" /> Referral Module
                  </h2>
                  <select
                    value={referralForm.targetSpecializationId}
                    onChange={(e) => setReferralForm((p) => ({ ...p, targetSpecializationId: e.target.value }))}
                    className="h-10 text-sm"
                  >
                    <option value="">Select target specialty</option>
                    {specializations.map((s) => (
                      <option key={s.specializationId} value={s.specializationId}>
                        {s.name}
                      </option>
                    ))}
                  </select>
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
                            <div className="flex items-center gap-2">
                              <input
                                type="date"
                                value={referralOutcomeDates[r.referralId] || ""}
                                onChange={(e) =>
                                  setReferralOutcomeDates((p) => ({ ...p, [r.referralId]: e.target.value }))
                                }
                                className="h-8 text-xs flex-1"
                              />
                              <button
                                onClick={() => saveReferralOutcome(r.referralId)}
                                disabled={savingOutcomeId === r.referralId}
                                className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                              >
                                Record seen date
                              </button>
                            </div>
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


                <PatientMedicalFormsSection
                  patientId={selectedPatientId}
                  visitId={summary?.latestEncounter?.visitId ?? visitIdParam ?? null}
                  patientName={summary?.name}
                  patientNumber={summary?.opNumber || summary?.opId}
                />
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
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No active encounter — start a visit to access the dental chart.
                  </p>
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
          <select
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            className="h-10 w-48 shrink-0 text-sm"
          >
            <option value="">All doctors (system-wide)</option>
            {assignedDoctors.map((d) => (
              <option key={String(d.doctorId)} value={String(d.doctorId)}>
                {d.userName} — {d.specializationName}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoadingWorkbench ? (
        <LoadingSpinner />
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

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard icon={<Users size={18} />} label="Patients Under Care" value={dashboard?.patientsUnderCare ?? 0} />
            <StatCard icon={<Activity size={18} />} label="Active Cases" value={dashboard?.activeCases ?? 0} />
            <StatCard icon={<CalendarClock size={18} />} label="Today's Appointments" value={dashboard?.todaysAppointments ?? 0} />
            <StatCard icon={<FileText size={18} />} label="Pending Reports" value={dashboard?.pendingReports ?? 0} />
            <StatCard icon={<AlertTriangle size={18} />} label="Urgent Items" value={dashboard?.urgentItems ?? 0} accent />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <CalendarClock size={18} className="text-primary" /> Today&apos;s Schedule
              </h2>
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Time</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.length > 0 ? (
                      schedule.map((item) => (
                        <tr key={item.appointmentId}>
                          <td className="font-semibold">{item.patientName}</td>
                          <td>{new Date(item.appointmentDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                          <td>{item.status}</td>
                          <td>
                            <button
                              onClick={() => openPatient(item.patientId)}
                              className="text-sm font-semibold text-primary hover:underline"
                            >
                              Open EMR
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="text-center text-muted-foreground py-8">
                          No appointments today.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
                  <p className="text-sm text-muted-foreground">No open cases.</p>
                )}
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-4 gap-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Users size={18} className="text-primary" /> Patients
              </h2>
              <div className="relative w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name or MRN..."
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
                    <th>Age</th>
                    <th>Sex</th>
                    <th>Last Visit</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.length > 0 ? (
                    filteredPatients.map((p) => (
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
                            Open EMR
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center text-muted-foreground py-8">
                        No patients found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
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
