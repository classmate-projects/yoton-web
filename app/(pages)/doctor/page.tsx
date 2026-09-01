"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
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
  ClipboardCheck,
  ClipboardList,
  FileText,
  FlaskConical,
  HeartPulse,
  History,
  Lock,
  NotebookPen,
  Pill,
  Plus,
  Save,
  Search,
  Share2,
  Stethoscope,
  Stamp,
  StickyNote,
  Users,
  X,
} from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import CatalogSearchInput from "@/components/doctor/CatalogSearchInput";
import MedicationOrderPanel from "@/components/doctor/MedicationOrderPanel";
import ReviewOfSystemsPanel, { ReviewOfSystemsValue } from "@/components/doctor/ReviewOfSystemsPanel";
import PrescriptionPrintout from "@/components/prescription/PrescriptionPrintout";
import FloatingSaveRevertBar from "@/components/FloatingSaveRevertBar";
import ToggleButton from "@/components/ToggleButton";
import VitalsHistoryModal from "@/components/VitalsHistoryModal";
import { getUserDetail } from "@/lib/userDetail";
import { EmrService } from "@/services/emr.service";
import { UserService } from "@/services/user.service";
import { SpecializationService } from "@/services/specialization.service";
import { LabService } from "@/services/lab.service";
import { RadiologyService } from "@/services/radiology.service";
import { ConfigListService } from "@/services/configList.service";
import { NursingService } from "@/services/nursing.service";
import {
  ActiveCaseItemType,
  DoctorConfidentialNoteType,
  DoctorDashboardSummaryType,
  EmrPatientListItem,
  EncounterCorrectionType,
  MedicationPayload,
  PatientInsuranceCoverageType,
  PatientSummaryType,
  QuickNoteType,
  SpecialRemarkType,
  TodayScheduleItemType,
} from "@/types/emr.type";
import { VitalsHistoryEntryType, NurseNoteType, ExaminationNoteType } from "@/types/nursing.type";
import { AssignedDoctorsInfo } from "@/types/assignedDoctors.type";
import { SpecializationTypes } from "@/types/specialization.type";
import { UserType } from "@/types/user.type";
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

  const addCondition = async () => {
    if (!selectedPatientId || !conditionForm.name.trim()) {
      toast.error("Condition name is required");
      return;
    }
    if (!requireDoctorSelected()) return;
    try {
      await EmrService.addChronicCondition(
        selectedPatientId,
        {
          name: conditionForm.name.trim(),
          diagnosedYear: conditionForm.diagnosedYear ? Number(conditionForm.diagnosedYear) : undefined,
          status: conditionForm.status,
          diabetesType: isDiabetesCondition && conditionForm.diabetesType ? conditionForm.diabetesType : undefined,
          diagnosisDate: conditionForm.diagnosisDate || undefined,
          hasPcos: isDiabetesCondition ? conditionForm.hasPcos : undefined,
          hasEsrd: isHypertensionCondition ? conditionForm.hasEsrd : undefined,
        },
        doctorIdParam
      );
      toast.success("Chronic condition added");
      setConditionForm({
        name: "",
        diagnosedYear: "",
        status: "Managed",
        diabetesType: "",
        diagnosisDate: "",
        hasPcos: false,
        hasEsrd: false,
      });
      await fetchSummary(selectedPatientId);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to add condition"));
    }
  };

  // ---------------- ALLERGIES ----------------
  const [allergyForm, setAllergyForm] = useState({ substance: "", reaction: "" });

  const addAllergy = async () => {
    if (!selectedPatientId || !allergyForm.substance.trim()) {
      toast.error("Substance is required");
      return;
    }
    if (!requireDoctorSelected()) return;
    try {
      await EmrService.addAllergy(
        selectedPatientId,
        { substance: allergyForm.substance.trim(), reaction: allergyForm.reaction.trim() || undefined },
        doctorIdParam
      );
      toast.success("Allergy added");
      setAllergyForm({ substance: "", reaction: "" });
      await fetchSummary(selectedPatientId);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to add allergy"));
    }
  };

  // ---------------- MEDICATIONS ----------------
  const addMedication = async (payload: MedicationPayload): Promise<boolean> => {
    if (!selectedPatientId) return false;
    if (!requireDoctorSelected()) return false;
    try {
      await EmrService.addMedication(
        selectedPatientId,
        { ...payload, encounterId: summary?.latestEncounter?.encounterId },
        doctorIdParam
      );
      toast.success("Medication order added");
      await fetchSummary(selectedPatientId);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "Failed to add medication"));
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

  // ---------------- TREATMENTS (non-drug orders; nurse can only mark Done) ----------------
  const [treatmentForm, setTreatmentForm] = useState({
    listItemId: undefined as string | undefined,
    description: "",
    instructions: "",
    quantity: "1",
    isPackage: false,
    isBillingPending: false,
  });

  const addTreatment = async () => {
    if (!selectedPatientId || !treatmentForm.description.trim()) {
      toast.error("Select a treatment first");
      return;
    }
    if (!requireDoctorSelected()) return;
    try {
      await EmrService.addTreatment(
        selectedPatientId,
        {
          encounterId: summary?.latestEncounter?.encounterId,
          listItemId: treatmentForm.listItemId,
          description: treatmentForm.description.trim(),
          instructions: treatmentForm.instructions.trim() || undefined,
          quantity: treatmentForm.quantity ? Number(treatmentForm.quantity) : 1,
          isPackage: treatmentForm.isPackage,
          isBillingPending: treatmentForm.isBillingPending,
        },
        doctorIdParam
      );
      toast.success("Treatment ordered");
      setTreatmentForm({ listItemId: undefined, description: "", instructions: "", quantity: "1", isPackage: false, isBillingPending: false });
      await fetchSummary(selectedPatientId);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to add treatment"));
    }
  };

  // ---------------- INVESTIGATION ORDERING (LAB / RADIOLOGY) ----------------
  const [orderForm, setOrderForm] = useState({
    category: "Lab" as "Lab" | "Radiology",
    testType: "",
    listItemId: undefined as string | undefined,
    quantity: "1",
    remarks: "",
    priority: "Normal",
    source: "InHouse",
    price: "",
    uccCode: "",
    covered: "" as "" | "Yes" | "No",
    patientShareAmount: "",
    coInsurancePercent: "",
    preAuthStatus: "Not Required",
    bodyParts: "",
  });
  const [isOrdering, setIsOrdering] = useState(false);

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
  const matchedCoverage = useMemo(
    () => insuranceCoverage?.coverages.find((c) => c.serviceCategory === orderForm.category) || null,
    [insuranceCoverage, orderForm.category]
  );

  const orderInvestigation = async () => {
    if (!selectedPatientId || !orderForm.testType.trim()) {
      toast.error("Select an investigation first");
      return;
    }
    try {
      setIsOrdering(true);
      const quantity = orderForm.quantity ? Number(orderForm.quantity) : 1;
      const shared = {
        patientId: selectedPatientId,
        doctorId: doctorIdParam,
        visitId: visitIdParam,
        listItemId: orderForm.listItemId,
        quantity,
        remarks: orderForm.remarks.trim() || undefined,
        priority: orderForm.priority,
        source: orderForm.source,
        price: orderForm.price ? Number(orderForm.price) : undefined,
        uccCode: orderForm.uccCode.trim() || undefined,
        covered: orderForm.covered ? orderForm.covered === "Yes" : undefined,
        patientShareAmount: orderForm.patientShareAmount ? Number(orderForm.patientShareAmount) : undefined,
        coInsurancePercent: orderForm.coInsurancePercent ? Number(orderForm.coInsurancePercent) : undefined,
        preAuthStatus: orderForm.preAuthStatus || undefined,
      };
      if (orderForm.category === "Lab") {
        await LabService.create({ ...shared, testType: orderForm.testType.trim() });
      } else {
        await RadiologyService.create({
          ...shared,
          scanType: orderForm.testType.trim(),
          bodyParts: orderForm.bodyParts.trim() || undefined,
        });
      }
      toast.success(`${orderForm.category} order placed`);
      setOrderForm({
        category: orderForm.category,
        testType: "",
        listItemId: undefined,
        quantity: "1",
        remarks: "",
        priority: "Normal",
        source: "InHouse",
        price: "",
        uccCode: "",
        covered: "",
        patientShareAmount: "",
        coInsurancePercent: "",
        preAuthStatus: "Not Required",
        bodyParts: "",
      });
    } catch (error) {
      toast.error(errorMessage(error, "Failed to place order"));
    } finally {
      setIsOrdering(false);
    }
  };

  // ---------------- CONFIDENTIAL STATEMENT (visible only to this doctor) ----------------
  const [confidentialText, setConfidentialText] = useState("");
  const [isSavingConfidential, setIsSavingConfidential] = useState(false);

  const addConfidentialNote = async () => {
    if (!selectedPatientId || !confidentialText.trim()) return;
    try {
      setIsSavingConfidential(true);
      await EmrService.addConfidentialNote(selectedPatientId, { contentHtml: confidentialText.trim() });
      toast.success("Confidential statement saved");
      setConfidentialText("");
      await fetchConfidentialNotes(selectedPatientId);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save confidential statement"));
    } finally {
      setIsSavingConfidential(false);
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

  const addFollowUp = async () => {
    if (!selectedPatientId || !followUpForm.followUpDate) {
      toast.error("Follow-up date is required");
      return;
    }
    if (!requireDoctorSelected()) return;
    try {
      await EmrService.addFollowUp(
        selectedPatientId,
        {
          encounterId: summary?.latestEncounter?.encounterId,
          followUpDate: followUpForm.followUpDate,
          instructions: followUpForm.instructions.trim() || undefined,
        },
        doctorIdParam
      );
      toast.success("Follow-up added");
      setFollowUpForm({ followUpDate: "", instructions: "" });
      await fetchSummary(selectedPatientId);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to add follow-up"));
    }
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

  const addReferral = async () => {
    if (!selectedPatientId || !referralForm.targetSpecializationId) {
      toast.error("Select a target specialty");
      return;
    }
    if (!requireDoctorSelected()) return;
    try {
      await EmrService.addReferral(
        selectedPatientId,
        {
          encounterId: summary?.latestEncounter?.encounterId,
          targetSpecializationId: referralForm.targetSpecializationId,
          priority: referralForm.priority,
          notes: referralForm.notes.trim() || undefined,
          cancerSiteListItemId: referralForm.cancerSiteListItemId || undefined,
          externalFacility: referralForm.externalFacility.trim() || undefined,
        },
        doctorIdParam
      );
      toast.success("Referral created");
      setReferralForm({
        targetSpecializationId: "",
        priority: "Routine",
        notes: "",
        cancerSiteListItemId: "",
        cancerSiteName: "",
        externalFacility: "",
      });
      await fetchSummary(selectedPatientId);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to create referral"));
    }
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
              <div className="flex flex-wrap items-center justify-between gap-3">
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
                <div className="flex items-center gap-2">
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
                {/* Confidential statement — visible only to this doctor, never shared
                    with other doctors, nurses, or admin. */}
                <div className="card p-6 flex flex-col gap-3 border-l-4 border-l-amber-500">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Lock size={18} className="text-amber-500" /> Confidential Statement
                    <span className="text-xs font-normal text-muted-foreground ml-1">(visible only to you)</span>
                  </h2>
                  <textarea
                    placeholder="Private notes only you can see..."
                    value={confidentialText}
                    onChange={(e) => setConfidentialText(e.target.value)}
                    className="w-full min-h-16 text-sm"
                  />
                  <button
                    onClick={addConfidentialNote}
                    disabled={isSavingConfidential || !confidentialText.trim()}
                    className="self-start flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    <Lock size={15} /> Save Privately
                  </button>
                  {confidentialNotes.length > 0 && (
                    <div className="flex flex-col gap-1.5 border-t border-border pt-3 max-h-40 overflow-y-auto">
                      {confidentialNotes.map((n) => (
                        <div key={n.doctorConfidentialNoteId} className="rounded-lg bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-sm">
                          <p className="text-foreground">{n.contentHtml}</p>
                          <p className="text-xs text-muted-foreground mt-1">{formatDateTime(n.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

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

                  <div className="flex gap-3">
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
                          className="rounded-lg border border-border bg-muted/30 px-3 py-2 min-w-48"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm text-foreground">{c.name}</span>
                            <span className="rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5">
                              {c.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Diagnosed {c.diagnosedYear ?? "—"}
                          </p>
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
                      <Plus size={14} /> Add Condition
                    </button>
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
                            className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-1.5 text-sm text-red-700 dark:text-red-400"
                          >
                            {a.substance} {a.reaction ? `— ${a.reaction}` : ""}
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
                        <Plus size={14} /> Add
                      </button>
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
                                <td className="font-semibold">{m.drugName}</td>
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
                                  <button
                                    onClick={() => discontinueMedication(m.medicationId)}
                                    className="text-sm font-semibold text-red-600 hover:underline"
                                  >
                                    Discontinue
                                  </button>
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

                {/* Treatments — non-drug orders (dressing changes, physio, etc.); nurse
                    may only flip Status to Done, never edit the order itself. */}
                <div className="card p-6 flex flex-col gap-4">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <ClipboardCheck size={18} className="text-primary" /> Treatments
                  </h2>
                  {summary.treatments.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {summary.treatments.map((t) => (
                        <div key={t.treatmentId} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm">
                          <div>
                            <span className="font-medium">
                              {t.description} {t.quantity > 1 && <span className="text-xs text-muted-foreground">×{t.quantity}</span>}
                            </span>
                            {t.instructions && <span className="text-xs text-muted-foreground ml-2">{t.instructions}</span>}
                            <div className="flex gap-1 mt-1">
                              {t.isPackage && (
                                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700">Package</span>
                              )}
                              {t.isBillingPending && (
                                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-purple-100 text-purple-700">Billing pending</span>
                              )}
                            </div>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${t.status === "Done" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                            {t.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No treatments ordered.</p>
                  )}

                  <div className="border-t border-border pt-4 flex flex-col gap-2">
                    <p className="text-sm font-semibold text-foreground/90">New Treatment</p>
                    {treatmentForm.description ? (
                      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                        <span className="font-medium">{treatmentForm.description}</span>
                        <button
                          type="button"
                          onClick={() => setTreatmentForm((p) => ({ ...p, listItemId: undefined, description: "" }))}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <CatalogSearchInput
                        placeholder="Search treatment..."
                        fetchOptions={async (search) => {
                          const res = await ConfigListService.get("Treatment", search);
                          return (res.data || []).map((i: { listItemId: string; name: string; code: string | null }) => ({
                            id: i.listItemId,
                            name: i.name,
                            code: i.code,
                          }));
                        }}
                        onSelect={(opt) => setTreatmentForm((p) => ({ ...p, listItemId: opt.id, description: opt.name }))}
                      />
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        min={1}
                        placeholder="Quantity"
                        value={treatmentForm.quantity}
                        onChange={(e) => setTreatmentForm((p) => ({ ...p, quantity: e.target.value }))}
                        className="h-10 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Instructions (optional)"
                        value={treatmentForm.instructions}
                        onChange={(e) => setTreatmentForm((p) => ({ ...p, instructions: e.target.value }))}
                        className="h-10 text-sm"
                      />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2 text-sm">
                        <ToggleButton
                          checked={treatmentForm.isPackage}
                          onChange={(checked) => setTreatmentForm((p) => ({ ...p, isPackage: checked }))}
                        />
                        <span>Package</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <ToggleButton
                          checked={treatmentForm.isBillingPending}
                          onChange={(checked) => setTreatmentForm((p) => ({ ...p, isBillingPending: checked }))}
                        />
                        <span>Pending (don&apos;t bill now — carry to next visit)</span>
                      </div>
                    </div>
                    <button
                      onClick={addTreatment}
                      className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                    >
                      <Plus size={15} /> Order Treatment
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <MedicationOrderPanel onSubmit={addMedication} />

                {/* Investigation ordering */}
                <div className="card p-6 flex flex-col gap-3">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <FlaskConical size={18} className="text-primary" /> Order Investigation
                  </h2>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        checked={orderForm.category === "Lab"}
                        onChange={() => setOrderForm((p) => ({ ...p, category: "Lab" }))}
                      />
                      Lab
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        checked={orderForm.category === "Radiology"}
                        onChange={() => setOrderForm((p) => ({ ...p, category: "Radiology" }))}
                      />
                      Radiology
                    </label>
                  </div>
                  {orderForm.testType ? (
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                      <span className="font-medium">{orderForm.testType}</span>
                      <button
                        type="button"
                        onClick={() => setOrderForm((p) => ({ ...p, listItemId: undefined, testType: "" }))}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <CatalogSearchInput
                      placeholder="Search investigation..."
                      fetchOptions={async (search) => {
                        const res = await ConfigListService.get("Investigation", search);
                        return (res.data || []).map((i: { listItemId: string; name: string; code: string | null }) => ({
                          id: i.listItemId,
                          name: i.name,
                          code: i.code,
                        }));
                      }}
                      onSelect={(opt) => setOrderForm((p) => ({ ...p, listItemId: opt.id, testType: opt.name }))}
                    />
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      min={1}
                      placeholder="Quantity"
                      value={orderForm.quantity}
                      onChange={(e) => setOrderForm((p) => ({ ...p, quantity: e.target.value }))}
                      className="h-10 text-sm"
                    />
                    <select
                      value={orderForm.priority}
                      onChange={(e) => setOrderForm((p) => ({ ...p, priority: e.target.value }))}
                      className="h-10 text-sm"
                    >
                      <option value="Normal">Normal</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                  <select
                    value={orderForm.source}
                    onChange={(e) => setOrderForm((p) => ({ ...p, source: e.target.value }))}
                    className="h-10 text-sm"
                  >
                    <option value="InHouse">In-house</option>
                    <option value="External">External</option>
                  </select>
                  <textarea
                    placeholder="Remarks for the lab (optional)"
                    value={orderForm.remarks}
                    onChange={(e) => setOrderForm((p) => ({ ...p, remarks: e.target.value }))}
                    className="w-full min-h-12 text-sm"
                  />

                  {orderForm.category === "Radiology" && (
                    <input
                      type="text"
                      placeholder="Body parts (e.g. Chest, Left knee)"
                      value={orderForm.bodyParts}
                      onChange={(e) => setOrderForm((p) => ({ ...p, bodyParts: e.target.value }))}
                      className="h-10 text-sm"
                    />
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted-foreground">Price (AED)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={orderForm.price}
                        onChange={(e) => setOrderForm((p) => ({ ...p, price: e.target.value }))}
                        className="h-10 text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted-foreground">UCC code</label>
                      <input
                        type="text"
                        value={orderForm.uccCode}
                        onChange={(e) => setOrderForm((p) => ({ ...p, uccCode: e.target.value }))}
                        className="h-10 text-sm"
                      />
                    </div>
                  </div>

                  {/* Insurance snapshot — reference-only hint pulled from the patient's
                      coverage on file (set at registration); fields below stay editable. */}
                  {insuranceCoverage && insuranceCoverage.paymentType !== "Cash" && (
                    <p className="text-xs text-muted-foreground bg-muted/40 rounded-md px-2.5 py-1.5">
                      {matchedCoverage
                        ? `${insuranceCoverage.paymentType} on file for ${orderForm.category}: Co-Insurance ${matchedCoverage.coPayPercent ?? "—"}%, Deductible ${matchedCoverage.deductible ?? "—"} AED (${matchedCoverage.deductibleAppliesTo || "—"})`
                        : `${insuranceCoverage.paymentType} patient — no ${orderForm.category} coverage on file`}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted-foreground">Covered</label>
                      <div className="flex items-center gap-3 h-10 text-sm">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" checked={orderForm.covered === "Yes"} onChange={() => setOrderForm((p) => ({ ...p, covered: "Yes" }))} /> Yes
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" checked={orderForm.covered === "No"} onChange={() => setOrderForm((p) => ({ ...p, covered: "No" }))} /> No
                        </label>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted-foreground">Pre-authorization</label>
                      <select
                        value={orderForm.preAuthStatus}
                        onChange={(e) => setOrderForm((p) => ({ ...p, preAuthStatus: e.target.value }))}
                        className="h-10 text-sm"
                      >
                        <option value="Not Required">Not Required</option>
                        <option value="Required">Required</option>
                        <option value="Pending">Pending</option>
                        <option value="Approved">Approved</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted-foreground">Patient share (AED)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={orderForm.patientShareAmount}
                        onChange={(e) => setOrderForm((p) => ({ ...p, patientShareAmount: e.target.value }))}
                        className="h-10 text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted-foreground">Co-Insurance (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={orderForm.coInsurancePercent}
                        onChange={(e) => setOrderForm((p) => ({ ...p, coInsurancePercent: e.target.value }))}
                        className="h-10 text-sm"
                      />
                    </div>
                  </div>

                  <button
                    onClick={orderInvestigation}
                    disabled={isOrdering}
                    className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    <Plus size={15} /> Place Order
                  </button>
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
                  <button
                    onClick={addReferral}
                    className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                  >
                    <Share2 size={15} /> Send Referral
                  </button>
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
                            <span
                              className={`text-xs font-semibold ${
                                r.priority === "Urgent" ? "text-red-600" : "text-muted-foreground"
                              }`}
                            >
                              {r.priority}
                            </span>
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
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dental checklist — only shown for a doctor whose specialization is
                    flagged dental (see Specialization.IsDentalSpecialty), feeds the PL4.6,
                    PL4.11, and PL5.2 KPI reports. */}
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

                {/* Follow-up — an optional booking, not a confirmed appointment; front
                    office calls the patient to arrange the actual visit. */}
                <div className="card p-6 flex flex-col gap-3">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <CalendarPlus size={18} className="text-primary" /> Follow-Up
                  </h2>
                  <input
                    type="date"
                    value={followUpForm.followUpDate}
                    onChange={(e) => setFollowUpForm((p) => ({ ...p, followUpDate: e.target.value }))}
                    className="h-10 text-sm"
                  />
                  <textarea
                    placeholder="Follow-up instructions (optional)"
                    value={followUpForm.instructions}
                    onChange={(e) => setFollowUpForm((p) => ({ ...p, instructions: e.target.value }))}
                    className="w-full min-h-14 text-sm"
                  />
                  <button
                    onClick={addFollowUp}
                    className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                  >
                    <CalendarPlus size={15} /> Add Follow-Up
                  </button>
                  {summary.followUps.length > 0 && (
                    <div className="flex flex-col gap-1.5 border-t border-border pt-3">
                      {summary.followUps.map((f) => (
                        <div
                          key={f.followUpId}
                          className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm"
                        >
                          <span className="font-medium">{formatDate(f.followUpDate)}</span>
                          {f.instructions && <span className="text-xs text-muted-foreground truncate ml-2">{f.instructions}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick notes */}
                <div className="card p-6 flex flex-col gap-3">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <FileText size={18} className="text-primary" /> Quick Notes
                  </h2>
                  <textarea
                    placeholder="Add a quick note..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="w-full min-h-16 text-sm"
                  />
                  <button
                    onClick={addQuickNote}
                    className="flex items-center justify-center gap-2 rounded-lg border border-primary/30 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
                  >
                    <Plus size={15} /> Add Note
                  </button>
                  <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                    {quickNotes.length > 0 ? (
                      quickNotes.map((n) => (
                        <div
                          key={n.consultationNoteId}
                          className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
                        >
                          <p className="text-foreground">{n.notes}</p>
                          <p className="text-xs text-muted-foreground mt-1">{formatDateTime(n.createdAt)}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No notes yet.</p>
                    )}
                  </div>
                </div>
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
