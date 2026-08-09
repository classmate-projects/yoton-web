"use client";

import { useEffect, useState, Suspense } from "react";
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
  ClipboardCheck,
  ClipboardList,
  FileText,
  FlaskConical,
  HeartPulse,
  Lock,
  Pill,
  Plus,
  Save,
  Search,
  Share2,
  Stethoscope,
  Stamp,
  Users,
} from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import CatalogSearchInput from "@/components/doctor/CatalogSearchInput";
import MedicationOrderModal from "@/components/doctor/MedicationOrderModal";
import ReviewOfSystemsPanel, { ReviewOfSystemsValue } from "@/components/doctor/ReviewOfSystemsPanel";
import { EmrService } from "@/services/emr.service";
import { UserService } from "@/services/user.service";
import { SpecializationService } from "@/services/specialization.service";
import { LabService } from "@/services/lab.service";
import { RadiologyService } from "@/services/radiology.service";
import { ConfigListService } from "@/services/configList.service";
import {
  ActiveCaseItemType,
  DoctorConfidentialNoteType,
  DoctorDashboardSummaryType,
  EmrPatientListItem,
  MedicationPayload,
  PatientSummaryType,
  QuickNoteType,
  TodayScheduleItemType,
} from "@/types/emr.type";
import { AssignedDoctorsInfo } from "@/types/assignedDoctors.type";
import { SpecializationTypes } from "@/types/specialization.type";
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

  const [dashboard, setDashboard] = useState<DoctorDashboardSummaryType | null>(null);
  const [schedule, setSchedule] = useState<TodayScheduleItemType[]>([]);
  const [activeCases, setActiveCases] = useState<ActiveCaseItemType[]>([]);
  const [patients, setPatients] = useState<EmrPatientListItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingWorkbench, setIsLoadingWorkbench] = useState(true);

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [summary, setSummary] = useState<PatientSummaryType | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  const [specializations, setSpecializations] = useState<SpecializationTypes[]>([]);
  const [quickNotes, setQuickNotes] = useState<QuickNoteType[]>([]);
  const [confidentialNotes, setConfidentialNotes] = useState<DoctorConfidentialNoteType[]>([]);

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
    if (currentRole !== "doctor" && currentRole !== "admin") {
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
      .then((data) => setSpecializations(Array.isArray(data) ? data : []))
      .catch(() => toast.error("Failed to load specialties"));
  }, [checkedAuth]);

  // ---------------- PATIENT SUMMARY (EMR PANEL) ----------------
  const openPatient = async (patientId: string) => {
    setSelectedPatientId(patientId);
    await Promise.all([
      fetchSummary(patientId),
      fetchQuickNotes(patientId),
      fetchDocuments(patientId),
      fetchConfidentialNotes(patientId),
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
  const [isSavingEncounter, setIsSavingEncounter] = useState(false);

  useEffect(() => {
    const e = summary?.latestEncounter;
    setEncounterForm({
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
    });
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
  const [conditionForm, setConditionForm] = useState({ name: "", diagnosedYear: "", status: "Managed" });

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
        },
        doctorIdParam
      );
      toast.success("Chronic condition added");
      setConditionForm({ name: "", diagnosedYear: "", status: "Managed" });
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
  const [showMedicationModal, setShowMedicationModal] = useState(false);

  const addMedication = async (payload: MedicationPayload) => {
    if (!selectedPatientId) return;
    if (!requireDoctorSelected()) return;
    try {
      await EmrService.addMedication(
        selectedPatientId,
        { ...payload, encounterId: summary?.latestEncounter?.encounterId },
        doctorIdParam
      );
      toast.success("Medication order added");
      setShowMedicationModal(false);
      await fetchSummary(selectedPatientId);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to add medication"));
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
  });
  const [isOrdering, setIsOrdering] = useState(false);

  const orderInvestigation = async () => {
    if (!selectedPatientId || !orderForm.testType.trim()) {
      toast.error("Select an investigation first");
      return;
    }
    try {
      setIsOrdering(true);
      const quantity = orderForm.quantity ? Number(orderForm.quantity) : 1;
      if (orderForm.category === "Lab") {
        await LabService.create({
          patientId: selectedPatientId,
          doctorId: doctorIdParam,
          visitId: visitIdParam,
          testType: orderForm.testType.trim(),
          listItemId: orderForm.listItemId,
          quantity,
          remarks: orderForm.remarks.trim() || undefined,
          priority: orderForm.priority,
          source: orderForm.source,
        });
      } else {
        await RadiologyService.create({
          patientId: selectedPatientId,
          doctorId: doctorIdParam,
          visitId: visitIdParam,
          scanType: orderForm.testType.trim(),
          listItemId: orderForm.listItemId,
          quantity,
          remarks: orderForm.remarks.trim() || undefined,
          priority: orderForm.priority,
          source: orderForm.source,
        });
      }
      toast.success(`${orderForm.category} order placed`);
      setOrderForm({ category: orderForm.category, testType: "", listItemId: undefined, quantity: "1", remarks: "", priority: "Normal", source: "InHouse" });
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
  const [referralForm, setReferralForm] = useState({ targetSpecializationId: "", priority: "Routine", notes: "" });

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
        },
        doctorIdParam
      );
      toast.success("Referral created");
      setReferralForm({ targetSpecializationId: "", priority: "Routine", notes: "" });
      await fetchSummary(selectedPatientId);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to create referral"));
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
                    MRN #{summary.opId} · {summary.sex || "—"} · DOB {formatDate(summary.dateOfBirth)}
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

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted-foreground">Chief complaint</label>
                    <input
                      type="text"
                      placeholder="Patient's primary reason for the visit..."
                      value={encounterForm.chiefComplaint}
                      onChange={(e) => setEncounterForm((p) => ({ ...p, chiefComplaint: e.target.value }))}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted-foreground">Examination notes</label>
                    <textarea
                      placeholder="Doctor's examination notes..."
                      value={encounterForm.examinationNotes}
                      onChange={(e) => setEncounterForm((p) => ({ ...p, examinationNotes: e.target.value }))}
                      className="w-full min-h-16 text-sm"
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
                      />
                    </div>
                  </details>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted-foreground">Clinical examination</label>
                    <textarea
                      placeholder="Clinical examination findings..."
                      value={encounterForm.clinicalExamination}
                      onChange={(e) => setEncounterForm((p) => ({ ...p, clinicalExamination: e.target.value }))}
                      className="w-full min-h-16 text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted-foreground">Planned procedures</label>
                    <textarea
                      placeholder="Planned procedures..."
                      value={encounterForm.plannedProcedures}
                      onChange={(e) => setEncounterForm((p) => ({ ...p, plannedProcedures: e.target.value }))}
                      className="w-full min-h-16 text-sm"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={saveEncounter}
                      disabled={isSavingEncounter}
                      className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      <Save size={15} /> Save Encounter
                    </button>
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
                    <button
                      onClick={() => setShowMedicationModal(true)}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
                    >
                      <Search size={14} /> New Order
                    </button>
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
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={treatmentForm.isPackage}
                          onChange={(e) => setTreatmentForm((p) => ({ ...p, isPackage: e.target.checked }))}
                        />
                        Package
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={treatmentForm.isBillingPending}
                          onChange={(e) => setTreatmentForm((p) => ({ ...p, isBillingPending: e.target.checked }))}
                        />
                        Pending (don&apos;t bill now — carry to next visit)
                      </label>
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
                          className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm"
                        >
                          <span className="font-medium">{r.targetSpecializationName}</span>
                          <span
                            className={`text-xs font-semibold ${
                              r.priority === "Urgent" ? "text-red-600" : "text-muted-foreground"
                            }`}
                          >
                            {r.priority}
                          </span>
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
        {showMedicationModal && (
          <MedicationOrderModal onClose={() => setShowMedicationModal(false)} onSubmit={addMedication} />
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
                        <td className="font-mono text-xs">#{p.opId}</td>
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
