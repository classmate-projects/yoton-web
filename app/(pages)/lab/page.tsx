"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { FlaskConical, Pencil, Trash2 } from "lucide-react";
import { MdAdd, MdOutlineFileUpload } from "react-icons/md";
import LoadingSpinner from "@/components/LoadingSpinner";
import CatalogSearchInput from "@/components/doctor/CatalogSearchInput";
import SampleBarcodeLabel from "@/components/SampleBarcodeLabel";
import CorrectedFromNote from "@/components/CorrectedFromNote";
import { confirmDeleteToast } from "@/lib/confirmDeleteToast";
import { LabService } from "@/services/lab.service";
import { ReceptionService } from "@/services/reception.service";
import { ConfigListService } from "@/services/configList.service";
import { TestParameterService } from "@/services/testParameter.service";
import { UserService } from "@/services/user.service";
import { LabRequestType, LabSummaryType } from "@/types/lab.type";
import { PatientListItemType, DoctorGridType } from "@/types/appointment.type";
import { TestParameterType } from "@/types/testParameter.type";
import { UserType } from "@/types/user.type";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { backendAssetUrl } from "@/lib/backendAsset";

const errorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.message || fallback : fallback;

const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : "—";

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString() : "—";

const STATUS_FLOW = ["Requested", "SampleCollected", "Processing", "Completed", "Delivered"];

const statusBadgeClass = (status: string) => {
  switch (status) {
    case "Delivered":
      return "bg-emerald-500/10 text-emerald-500";
    case "Completed":
      return "bg-primary/10 text-primary";
    case "Processing":
      return "bg-amber-500/10 text-amber-500";
    case "SampleCollected":
      return "bg-sky-500/10 text-sky-500";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export default function LaboratoryPage() {
  const router = useRouter();
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [role, setRole] = useState("");
  const isAdmin = role === "admin";
  // Nurses can view this module and collect samples (see sidebaritems.ts) but everything
  // past that - advancing status, uploading results, structured result entry - stays lab
  // technician/admin, matching LabController's own authorization.
  const isNurse = role === "nurse";

  const [summary, setSummary] = useState<LabSummaryType | null>(null);
  const [requests, setRequests] = useState<LabRequestType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending">("pending");

  const [patients, setPatients] = useState<PatientListItemType[]>([]);
  const [doctors, setDoctors] = useState<DoctorGridType[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientListItemType | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [testType, setTestType] = useState("");
  const [testListItemId, setTestListItemId] = useState<string | undefined>(undefined);
  const [priority, setPriority] = useState("Normal");
  const [source, setSource] = useState("InHouse");
  const [price, setPrice] = useState("");
  // Set while correcting an existing not-yet-Completed request - reuses the same modal/form
  // as creating a new one, matching every other add-form-doubles-as-edit-form in this feature.
  const [editingLabRequestId, setEditingLabRequestId] = useState<string | null>(null);

  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Sample collection (nurse's action - see LabController.CollectSample) and the barcode
  // label that follows it, moved in from the old standalone "Doctor Investigations" page.
  const [nurses, setNurses] = useState<UserType[]>([]);
  const [selectedNurseId, setSelectedNurseId] = useState("");
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [barcodeLabId, setBarcodeLabId] = useState<string | null>(null);

  // Structured per-parameter result entry (admin-configured under the Investigation catalog
  // — see ListItemManager's "Parameters" action). Only offered when the request's TestType
  // was picked from the catalog (has a ListItemId) and that test actually has parameters.
  const [resultEntryTarget, setResultEntryTarget] = useState<LabRequestType | null>(null);
  const [resultEntryParameters, setResultEntryParameters] = useState<TestParameterType[]>([]);
  const [resultEntryValues, setResultEntryValues] = useState<Record<string, string>>({});
  const [isLoadingResultParams, setIsLoadingResultParams] = useState(false);
  const [isSavingResultValues, setIsSavingResultValues] = useState(false);

  // ---------------- ROLE GUARD ----------------
  useEffect(() => {
    const detail = JSON.parse(localStorage.getItem("yoton_user_detail") || "{}");
    const currentRole = (detail.role || "").toLowerCase();
    const allowedModules: string[] = detail.allowedModules || [];
    if (currentRole !== "admin" && !allowedModules.includes("/lab")) {
      router.replace("/");
      return;
    }
    setRole(currentRole);
    setCheckedAuth(true);
  }, [router]);

  // ---------------- DATA ----------------
  const fetchAll = async () => {
    try {
      setIsLoading(true);
      const [summaryRes, listRes] = await Promise.all([
        LabService.getSummary(),
        filter === "pending" ? LabService.getPending() : LabService.getAll(),
      ]);
      setSummary(summaryRes.data ?? null);
      setRequests(listRes.data ?? []);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load lab requests"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!checkedAuth) return;
    fetchAll();
    if (isAdmin) {
      UserService.getAllByRole("nurse").then((res) => setNurses(res.data || [])).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedAuth, filter]);

  useSignalRRefetch(["labRequestCreated", "labStatusUpdated"], fetchAll);

  useEffect(() => {
    if (!checkedAuth) return;
    const fetchPickers = async () => {
      try {
        const [patientsRes, gridRes] = await Promise.all([
          ReceptionService.getAllPatients(),
          ReceptionService.getSpecializationsWithDoctors(),
        ]);
        setPatients(patientsRes.patients ?? []);
        const allDoctors = (gridRes.specializations ?? []).flatMap(
          (s: { doctors: DoctorGridType[] }) => s.doctors
        );
        setDoctors(allDoctors);
      } catch (error) {
        console.error("Failed to load patient/doctor pickers:", error);
      }
    };
    fetchPickers();
  }, [checkedAuth]);

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return [];
    const q = patientSearch.toLowerCase();
    return patients.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.phone?.toLowerCase().includes(q) ||
        p.opNumber?.toLowerCase().includes(q) ||
        p.opId?.toLowerCase().includes(q)
    );
  }, [patientSearch, patients]);

  const resetForm = () => {
    setPatientSearch("");
    setSelectedPatient(null);
    setSelectedDoctorId("");
    setTestType("");
    setTestListItemId(undefined);
    setPriority("Normal");
    setSource("InHouse");
    setPrice("");
  };

  const openCreateModal = () => {
    resetForm();
    setEditingLabRequestId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (request: LabRequestType) => {
    resetForm();
    setEditingLabRequestId(request.labRequestId);
    const matchedPatient = patients.find((p) => p.opId === request.patientId);
    if (matchedPatient) {
      setSelectedPatient(matchedPatient);
      setPatientSearch(matchedPatient.name);
    }
    setSelectedDoctorId(request.doctorId || "");
    setTestType(request.testType || "");
    setTestListItemId(request.listItemId || undefined);
    setPriority(request.priority);
    setSource(request.source);
    setPrice(request.price != null ? String(request.price) : "");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingLabRequestId(null);
    resetForm();
  };

  const removeLabRequest = (request: LabRequestType) => {
    confirmDeleteToast(
      <span>Delete this lab request for <b className="text-red-500 ml-1">{request.patientName}</b>?</span>,
      async () => {
        try {
          await LabService.remove(request.labRequestId);
          toast.success("Lab request removed");
          fetchAll();
        } catch (error) {
          toast.error(errorMessage(error, "Failed to remove lab request"));
        }
      }
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !testType.trim()) {
      toast.warning("Please select a patient and enter a test type");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        patientId: selectedPatient.opId,
        doctorId: selectedDoctorId || undefined,
        testType,
        listItemId: testListItemId,
        priority,
        source,
        price: price ? Number(price) : undefined,
      };
      const data = editingLabRequestId
        ? await LabService.update(editingLabRequestId, payload)
        : await LabService.create(payload);
      toast.success(data.message || (editingLabRequestId ? "Lab request corrected" : "Lab request created"));
      closeModal();
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error, editingLabRequestId ? "Failed to correct lab request" : "Failed to create lab request"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const requireNurseSelected = () => {
    if (isAdmin && !selectedNurseId) {
      toast.error("Select a nurse first — you're viewing across all nurses.");
      return false;
    }
    return true;
  };

  const collectSample = async (labRequestId: string) => {
    if (!requireNurseSelected()) return;
    try {
      setCollectingId(labRequestId);
      await LabService.collectSample(labRequestId, isAdmin ? selectedNurseId : undefined);
      toast.success("Sample collected");
      setBarcodeLabId(labRequestId);
      await fetchAll();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to collect sample"));
    } finally {
      setCollectingId(null);
    }
  };

  // Fire-and-forget audit trail — the print itself already happened client-side by the time
  // this is called (see SampleBarcodeLabel's onPrint), so a failure here shouldn't block or
  // roll back anything already done.
  const recordPrint = async (labRequestId: string) => {
    try {
      const res = await LabService.recordPrint(labRequestId);
      setRequests((prev) =>
        prev.map((l) =>
          l.labRequestId === labRequestId
            ? { ...l, printCount: res.printCount, lastPrintedAt: res.lastPrintedAt, lastPrintedByName: res.lastPrintedByName }
            : l
        )
      );
    } catch {
      // non-fatal
    }
  };

  const viewReport = (path: string | null | undefined) => {
    const url = backendAssetUrl(path);
    if (url) window.open(url, "_blank");
  };

  const advanceStatus = async (request: LabRequestType) => {
    const currentIndex = STATUS_FLOW.indexOf(request.status);
    const next = STATUS_FLOW[currentIndex + 1];
    if (!next) return;

    try {
      const data = await LabService.updateStatus(request.labRequestId, next);
      toast.success(data.message || "Status updated");
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update status"));
    }
  };

  const handleUploadResult = async (request: LabRequestType, file: File | undefined) => {
    if (!file) return;
    try {
      setUploadingId(request.labRequestId);
      const data = await LabService.uploadResult(request.labRequestId, file);
      toast.success(data.message || "Result uploaded");
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to upload result"));
    } finally {
      setUploadingId(null);
    }
  };

  const openResultEntry = async (request: LabRequestType) => {
    if (!request.listItemId) return;
    setResultEntryTarget(request);
    setResultEntryValues({});
    try {
      setIsLoadingResultParams(true);
      const res = await TestParameterService.get(request.listItemId);
      const params: TestParameterType[] = res.data || [];
      setResultEntryParameters(params);
      // Pre-fill from any previously saved values, matched by parameter name (the saved
      // result snapshots name/unit/range rather than the parameter id).
      const prefill: Record<string, string> = {};
      params.forEach((p) => {
        const existing = request.resultValues.find((v) => v.parameterName === p.name);
        if (existing) prefill[p.testParameterId] = existing.value;
      });
      setResultEntryValues(prefill);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load test parameters"));
      setResultEntryParameters([]);
    } finally {
      setIsLoadingResultParams(false);
    }
  };

  const closeResultEntry = () => {
    setResultEntryTarget(null);
    setResultEntryParameters([]);
    setResultEntryValues({});
  };

  const handleSaveResultValues = async () => {
    if (!resultEntryTarget) return;
    const values = Object.entries(resultEntryValues)
      .filter(([, v]) => v.trim())
      .map(([testParameterId, value]) => ({ testParameterId, value: value.trim() }));

    if (values.length === 0) {
      toast.warning("Enter at least one parameter value");
      return;
    }

    try {
      setIsSavingResultValues(true);
      const data = await LabService.saveResultValues(resultEntryTarget.labRequestId, values);
      toast.success(data.message || "Result values saved");
      closeResultEntry();
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save result values"));
    } finally {
      setIsSavingResultValues(false);
    }
  };

  const barcodeLab = requests.find((l) => l.labRequestId === barcodeLabId);

  if (!checkedAuth) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
            <FlaskConical size={34} className="text-primary" />
            Laboratory
          </h1>
          <p className="text-sm text-muted-foreground">
            Track sample collection, processing, and delivery of lab test requests.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <select
              value={selectedNurseId}
              onChange={(e) => setSelectedNurseId(e.target.value)}
              title="Nurse identity for collecting samples"
              className="h-9 w-48 shrink-0 text-sm"
            >
              <option value="">Acting nurse…</option>
              {nurses.map((n) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
          )}
          {!isNurse && (
            <button
              type="button"
              onClick={openCreateModal}
              className="bg-primary px-4 py-2 rounded-md text-white text-lg flex gap-2 items-center cursor-pointer hover:opacity-90 transition duration-150 shrink-0"
            >
              <MdAdd size={22} />
              New Lab Request
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <p className="text-sm text-muted-foreground">Pending Requests</p>
          <p className="text-3xl font-bold text-foreground mt-1">{summary?.totalPending ?? "—"}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-muted-foreground">Urgent</p>
          <p className="text-3xl font-bold text-destructive mt-1">{summary?.urgent ?? "—"}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-muted-foreground">Completed Today</p>
          <p className="text-3xl font-bold text-emerald-500 mt-1">{summary?.completedToday ?? "—"}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(["pending", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors cursor-pointer ${
              filter === f ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f === "pending" ? "Pending Queue" : "All Requests"}
          </button>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
          <div className="bg-card w-full max-w-md rounded-xl border border-border p-6 shadow-2xl mx-4">
            <h2 className="text-2xl font-semibold mb-1 text-foreground">{editingLabRequestId ? "Correct Lab Request" : "New Lab Request"}</h2>
            <p className="text-sm text-muted-foreground mb-6">
              {editingLabRequestId ? "Correcting a request before it's completed." : "Register a new laboratory test request for a patient."}
            </p>

            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="relative">
                <label className="text-sm font-bold text-foreground/90 required">Patient</label>
                <input
                  type="text"
                  required
                  value={patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    setSelectedPatient(null);
                  }}
                  placeholder="Search by name, phone or MRN..."
                  className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                />
                {!selectedPatient && filteredPatients.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                    {filteredPatients.map((p) => (
                      <button
                        type="button"
                        key={p.opId}
                        onClick={() => {
                          setSelectedPatient(p);
                          setPatientSearch(p.name);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-primary/5 border-b border-border last:border-b-0 transition-colors"
                      >
                        <div className="font-medium text-foreground">{p.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {p.opNumber || p.opId} • {p.phone}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-bold text-foreground/90">Ordering Doctor</label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                >
                  <option value="">Not specified</option>
                  {doctors.map((d) => (
                    <option key={d.doctorId} value={d.doctorId}>
                      {d.name} — {d.specializationName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-bold text-foreground/90 required">Test Type</label>
                <CatalogSearchInput
                  placeholder="Search investigation catalog..."
                  value={testType}
                  fetchOptions={async (search) => {
                    const res = await ConfigListService.get("Investigation", search);
                    return (res.data || []).map((i: { listItemId: string; name: string; code: string | null }) => ({
                      id: i.listItemId,
                      name: i.name,
                      code: i.code,
                    }));
                  }}
                  onSelect={(option) => {
                    setTestType(option.name);
                    setTestListItemId(option.id);
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {testType
                    ? `Selected: ${testType}${testListItemId ? "" : " (not from catalog — free text, no configured parameters)"}`
                    : "Pick from the catalog to enable structured result-parameter entry."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-bold text-foreground/90">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-bold text-foreground/90">Source</label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                  >
                    <option value="InHouse">In-house</option>
                    <option value="External">External</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-foreground/90">Price (optional)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Amount for billing"
                  className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                />
              </div>

              <div className="flex items-center justify-end gap-3 mt-2 w-full">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 rounded-md border border-border hover:bg-muted transition-all duration-200 cursor-pointer text-foreground w-full"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-md bg-primary text-white hover:opacity-90 transition-all duration-200 cursor-pointer w-full disabled:opacity-60"
                >
                  {isSubmitting ? "Saving..." : editingLabRequestId ? "Save Correction" : "Create Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {barcodeLab && (
        <div className="card p-6 flex flex-col items-start gap-2 mb-6">
          <h2 className="text-lg font-semibold text-foreground">Sample Label — {barcodeLab.testType}</h2>
          <SampleBarcodeLabel
            label={{
              labRequestId: barcodeLab.labRequestId,
              testName: barcodeLab.testType || "Lab Test",
              doctorName: barcodeLab.doctorName || "Unassigned",
              date: formatDate(barcodeLab.sampleCollectedAt || barcodeLab.requestedDate),
              mrn: barcodeLab.patientOPNumber || barcodeLab.patientId || "—",
              collectedByName: barcodeLab.sampleCollectedByName || "—",
              visitId: barcodeLab.visitId,
            }}
            onPrint={() => recordPrint(barcodeLab.labRequestId)}
            printCount={barcodeLab.printCount}
            lastPrintedByName={barcodeLab.lastPrintedByName}
            lastPrintedAt={barcodeLab.lastPrintedAt}
          />
        </div>
      )}

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-foreground/90">Patient</th>
                <th className="text-foreground/90">Test</th>
                <th className="text-foreground/90">Doctor</th>
                <th className="text-foreground/90">Priority</th>
                <th className="text-foreground/90">Requested</th>
                <th className="text-foreground/90">Status</th>
                <th className="text-center text-foreground/90">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <LoadingSpinner />
                  </td>
                </tr>
              ) : requests.length > 0 ? (
                requests.map((r) => {
                  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(r.status) + 1];
                  return (
                    <tr key={r.labRequestId} className="hover:bg-muted/30 transition-colors">
                      <td className="font-semibold text-foreground">{r.patientName}</td>
                      <td className="text-foreground/80">
                        {r.testType}
                        {r.resultValues.length > 0 && (
                          <div className="mt-1 flex flex-col gap-0.5">
                            {r.resultValues.map((v, i) => (
                              <span
                                key={i}
                                className={`text-[11px] ${v.isAbnormal ? "font-semibold text-red-600" : "text-muted-foreground"}`}
                              >
                                {v.parameterName}: {v.value}
                                {v.unit ? ` ${v.unit}` : ""}
                                {v.isAbnormal ? " ⚠" : ""}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="text-foreground/80">{r.doctorName}</td>
                      <td>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            r.priority === "Urgent"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {r.priority}
                        </span>
                      </td>
                      <td className="text-foreground/70 text-sm">{formatDateTime(r.requestedDate)}</td>
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadgeClass(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-wrap justify-center items-center gap-2">
                          {(isNurse || isAdmin) && r.status === "Requested" && (
                            <button
                              onClick={() => collectSample(r.labRequestId)}
                              disabled={collectingId === r.labRequestId}
                              className="px-3 py-1.5 text-xs font-semibold rounded-md border border-primary/30 text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Collect Sample
                            </button>
                          )}
                          {(isNurse || isAdmin) && r.sampleCollectedByName && (
                            <button
                              onClick={() => setBarcodeLabId(r.labRequestId)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                            >
                              {r.printCount > 0 ? "Reprint Barcode" : "Barcode"}
                            </button>
                          )}
                          {!isNurse && nextStatus && (
                            <button
                              onClick={() => advanceStatus(r)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                            >
                              Mark {nextStatus}
                            </button>
                          )}
                          {!isNurse && r.listItemId && (
                            <button
                              onClick={() => openResultEntry(r)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-md border border-primary/30 text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                            >
                              Enter Results
                            </button>
                          )}
                          {!isNurse && (
                            <label
                              title="Upload result file"
                              className={`p-1.5 rounded-full transition-all cursor-pointer ${
                                uploadingId === r.labRequestId ? "opacity-50" : "hover:bg-primary/10"
                              }`}
                            >
                              <MdOutlineFileUpload size={18} className="text-primary" />
                              <input
                                type="file"
                                className="hidden"
                                disabled={uploadingId === r.labRequestId}
                                onChange={(e) => handleUploadResult(r, e.target.files?.[0])}
                              />
                            </label>
                          )}
                          {r.hasResultFile && (
                            <button
                              onClick={() => viewReport(r.resultFilePath)}
                              className="text-[11px] font-semibold text-primary hover:underline"
                            >
                              View Report
                            </button>
                          )}
                          {!isNurse && r.status !== "Completed" && r.status !== "Delivered" && (
                            <>
                              <button
                                onClick={() => openEditModal(r)}
                                title="Correct request"
                                className="p-1.5 hover:bg-primary/10 rounded-full text-primary cursor-pointer"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => removeLabRequest(r)}
                                title="Delete request"
                                className="p-1.5 hover:bg-destructive/10 rounded-full text-destructive cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                        {r.correctedFrom && (
                          <CorrectedFromNote>
                            <div>
                              Previous: {r.correctedFrom.testType ?? "—"} · qty {r.correctedFrom.quantity} ·{" "}
                              {r.correctedFrom.priority}
                              {r.correctedFrom.remarks ? ` · ${r.correctedFrom.remarks}` : ""}
                            </div>
                            <div>Requested {formatDateTime(r.correctedFrom.requestedDate)}</div>
                          </CorrectedFromNote>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground">
                    No lab requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {resultEntryTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
          <div className="bg-card w-full max-w-md rounded-xl border border-border p-6 shadow-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-foreground">Enter Results — {resultEntryTarget.testType}</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-4">{resultEntryTarget.patientName}</p>

            {isLoadingResultParams ? (
              <div className="py-8 flex justify-center">
                <LoadingSpinner />
              </div>
            ) : resultEntryParameters.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No parameters configured for this test yet — ask an admin to add them under Configurable Lists.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {resultEntryParameters.map((p) => (
                  <div key={p.testParameterId}>
                    <label className="text-sm font-bold text-foreground/90">
                      {p.name}
                      {p.unit && <span className="text-muted-foreground font-normal"> ({p.unit})</span>}
                    </label>
                    {(p.normalLow != null || p.normalHigh != null) && (
                      <p className="text-xs text-muted-foreground">
                        Normal range: {p.normalLow ?? "—"} – {p.normalHigh ?? "—"}
                      </p>
                    )}
                    <input
                      type="text"
                      value={resultEntryValues[p.testParameterId] || ""}
                      onChange={(e) =>
                        setResultEntryValues((prev) => ({ ...prev, [p.testParameterId]: e.target.value }))
                      }
                      className="w-full mt-1 p-2.5 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-6 w-full">
              <button
                type="button"
                onClick={closeResultEntry}
                className="px-5 py-2.5 rounded-md border border-border hover:bg-muted transition-all duration-200 cursor-pointer text-foreground w-full"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveResultValues}
                disabled={isSavingResultValues || resultEntryParameters.length === 0}
                className="px-5 py-2.5 rounded-md bg-primary text-white hover:opacity-90 transition-all duration-200 cursor-pointer w-full disabled:opacity-60"
              >
                {isSavingResultValues ? "Saving..." : "Save Results"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
