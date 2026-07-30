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
  FileText,
  FlaskConical,
  HeartPulse,
  Pill,
  Plus,
  Save,
  Search,
  Share2,
  Stethoscope,
  Users,
} from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { EmrService } from "@/services/emr.service";
import { UserService } from "@/services/user.service";
import { SpecializationService } from "@/services/specialization.service";
import { LabService } from "@/services/lab.service";
import { RadiologyService } from "@/services/radiology.service";
import {
  ActiveCaseItemType,
  DoctorDashboardSummaryType,
  EmrPatientListItem,
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

  const isAdmin = role === "admin";
  const doctorIdParam = isAdmin ? selectedDoctorId || undefined : undefined;

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
    await Promise.all([fetchSummary(patientId), fetchQuickNotes(patientId), fetchDocuments(patientId)]);
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

  const backToWorkbench = () => {
    setSelectedPatientId(null);
    setSummary(null);
    setQuickNotes([]);
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
  const [encounterForm, setEncounterForm] = useState({
    chiefComplaint: "",
    diagnosisCode: "",
    diagnosisDescription: "",
    plannedProcedures: "",
  });
  const [isSavingEncounter, setIsSavingEncounter] = useState(false);

  useEffect(() => {
    setEncounterForm({
      chiefComplaint: summary?.latestEncounter?.chiefComplaint || "",
      diagnosisCode: summary?.latestEncounter?.diagnosisCode || "",
      diagnosisDescription: summary?.latestEncounter?.diagnosisDescription || "",
      plannedProcedures: summary?.latestEncounter?.plannedProcedures || "",
    });
    // Intentionally re-run only when the encounter identity changes, not on every field edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary?.latestEncounter?.encounterId]);

  const saveEncounter = async () => {
    if (!selectedPatientId) return;
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
  const [medicationForm, setMedicationForm] = useState({
    drugName: "",
    dosage: "",
    frequency: "Once daily (QD)",
    durationDays: "",
    priority: "Routine",
  });

  const addMedication = async () => {
    if (!selectedPatientId || !medicationForm.drugName.trim()) {
      toast.error("Drug name is required");
      return;
    }
    try {
      await EmrService.addMedication(
        selectedPatientId,
        {
          encounterId: summary?.latestEncounter?.encounterId,
          drugName: medicationForm.drugName.trim(),
          dosage: medicationForm.dosage.trim() || undefined,
          frequency: medicationForm.frequency || undefined,
          durationDays: medicationForm.durationDays ? Number(medicationForm.durationDays) : undefined,
          priority: medicationForm.priority,
        },
        doctorIdParam
      );
      toast.success("Prescription added");
      setMedicationForm({ drugName: "", dosage: "", frequency: "Once daily (QD)", durationDays: "", priority: "Routine" });
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

  // ---------------- INVESTIGATION ORDERING (LAB / RADIOLOGY) ----------------
  const [orderForm, setOrderForm] = useState({
    category: "Lab" as "Lab" | "Radiology",
    testType: "",
    priority: "Normal",
    source: "InHouse",
  });
  const [isOrdering, setIsOrdering] = useState(false);

  const orderInvestigation = async () => {
    if (!selectedPatientId || !orderForm.testType.trim()) {
      toast.error("Test/scan type is required");
      return;
    }
    try {
      setIsOrdering(true);
      if (orderForm.category === "Lab") {
        await LabService.create({
          patientId: selectedPatientId,
          doctorId: doctorIdParam,
          visitId: visitIdParam,
          testType: orderForm.testType.trim(),
          priority: orderForm.priority,
          source: orderForm.source,
        });
      } else {
        await RadiologyService.create({
          patientId: selectedPatientId,
          doctorId: doctorIdParam,
          visitId: visitIdParam,
          scanType: orderForm.testType.trim(),
          priority: orderForm.priority,
          source: orderForm.source,
        });
      }
      toast.success(`${orderForm.category} order placed`);
      setOrderForm({ category: orderForm.category, testType: "", priority: "Normal", source: "InHouse" });
    } catch (error) {
      toast.error(errorMessage(error, "Failed to place order"));
    } finally {
      setIsOrdering(false);
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
    if (!selectedPatientId || !noteText.trim()) return;
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
      <div className="py-8 px-10 h-full overflow-y-auto">
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
                {/* Chief complaint / diagnosis */}
                <div className="card p-6 flex flex-col gap-4">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <FileText size={18} className="text-primary" /> Chief Complaint & Diagnosis
                  </h2>
                  <textarea
                    placeholder="Describe the patient's primary reason for the visit..."
                    value={encounterForm.chiefComplaint}
                    onChange={(e) => setEncounterForm((p) => ({ ...p, chiefComplaint: e.target.value }))}
                    className="w-full min-h-24 text-sm"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Diagnosis code (e.g. E11.9)"
                      value={encounterForm.diagnosisCode}
                      onChange={(e) => setEncounterForm((p) => ({ ...p, diagnosisCode: e.target.value }))}
                      className="h-10 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Diagnosis description"
                      value={encounterForm.diagnosisDescription}
                      onChange={(e) => setEncounterForm((p) => ({ ...p, diagnosisDescription: e.target.value }))}
                      className="h-10 text-sm"
                    />
                  </div>
                  <textarea
                    placeholder="Planned procedures..."
                    value={encounterForm.plannedProcedures}
                    onChange={(e) => setEncounterForm((p) => ({ ...p, plannedProcedures: e.target.value }))}
                    className="w-full min-h-16 text-sm"
                  />
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
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Pill size={18} className="text-primary" /> Medication Tracking
                  </h2>

                  <div>
                    <p className="text-sm font-semibold text-foreground/90 mb-2">Current Medications</p>
                    {summary.currentMedications.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table>
                          <thead>
                            <tr>
                              <th>Drug</th>
                              <th>Dosage</th>
                              <th>Frequency</th>
                              <th>Priority</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summary.currentMedications.map((m) => (
                              <tr key={m.medicationId}>
                                <td className="font-semibold">{m.drugName}</td>
                                <td>{m.dosage || "—"}</td>
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

                  <div className="border-t border-border pt-4 flex flex-col gap-2">
                    <p className="text-sm font-semibold text-foreground/90">New Prescription</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Drug name (e.g. Metoprolol)"
                        value={medicationForm.drugName}
                        onChange={(e) => setMedicationForm((p) => ({ ...p, drugName: e.target.value }))}
                        className="h-10 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Dose (e.g. 50mg)"
                        value={medicationForm.dosage}
                        onChange={(e) => setMedicationForm((p) => ({ ...p, dosage: e.target.value }))}
                        className="h-10 text-sm"
                      />
                      <select
                        value={medicationForm.frequency}
                        onChange={(e) => setMedicationForm((p) => ({ ...p, frequency: e.target.value }))}
                        className="h-10 text-sm"
                      >
                        <option>Once daily (QD)</option>
                        <option>Twice daily (BID)</option>
                        <option>Three times daily (TID)</option>
                        <option>Four times daily (QID)</option>
                        <option>As needed (PRN)</option>
                      </select>
                      <input
                        type="number"
                        placeholder="Duration (days)"
                        value={medicationForm.durationDays}
                        onChange={(e) => setMedicationForm((p) => ({ ...p, durationDays: e.target.value }))}
                        className="h-10 text-sm"
                      />
                      <select
                        value={medicationForm.priority}
                        onChange={(e) => setMedicationForm((p) => ({ ...p, priority: e.target.value }))}
                        className="h-10 text-sm"
                      >
                        <option value="Routine">Routine</option>
                        <option value="STAT">STAT</option>
                        <option value="PRN">PRN</option>
                      </select>
                    </div>
                    <button
                      onClick={addMedication}
                      className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                    >
                      <Plus size={15} /> Add Prescription
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
                  <input
                    type="text"
                    placeholder={orderForm.category === "Lab" ? "Test type (e.g. CBC)" : "Scan type (e.g. MRI Brain)"}
                    value={orderForm.testType}
                    onChange={(e) => setOrderForm((p) => ({ ...p, testType: e.target.value }))}
                    className="h-10 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={orderForm.priority}
                      onChange={(e) => setOrderForm((p) => ({ ...p, priority: e.target.value }))}
                      className="h-10 text-sm"
                    >
                      <option value="Normal">Normal</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                    <select
                      value={orderForm.source}
                      onChange={(e) => setOrderForm((p) => ({ ...p, source: e.target.value }))}
                      className="h-10 text-sm"
                    >
                      <option value="InHouse">In-house</option>
                      <option value="External">External</option>
                    </select>
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
    <div className="py-8 px-10 h-full overflow-y-auto">
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
