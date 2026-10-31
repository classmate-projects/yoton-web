"use client";

import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardList, FlaskConical, Pencil, Settings, Trash2, Undo2 } from "lucide-react";
import { notifySaveStatus } from "@/lib/saveStatus";
import { MdAdd, MdOutlineFileUpload } from "react-icons/md";
import LoadingSpinner from "@/components/LoadingSpinner";
import DatePicker from "@/components/DatePicker";
import { toDateInputValue, formatDateTime } from "@/lib/date";
import CatalogSearchInput from "@/components/doctor/CatalogSearchInput";
import SearchableSelect from "@/components/SearchableSelect";
import SampleBarcodeLabels from "@/components/SampleBarcodeLabel";
import SpecimenChips from "@/components/lab/SpecimenChips";
import CollectionGuideModal from "@/components/lab/CollectionGuideModal";
import LabRadiologyConfigModal from "@/components/orders/LabRadiologyConfigModal";
import CorrectedFromNote from "@/components/CorrectedFromNote";
import { confirmDeleteToast } from "@/lib/confirmDeleteToast";
import { LabService } from "@/services/lab.service";
import { ReceptionService } from "@/services/reception.service";
import { ConfigListService } from "@/services/configList.service";
import { TestParameterService } from "@/services/testParameter.service";
import { UserService } from "@/services/user.service";
import { LabRequestType, LabSummaryType } from "@/types/lab.type";
import { DoctorGridType } from "@/types/appointment.type";
import { PatientSummaryType } from "@/types/patient.type";
import { TestParameterType } from "@/types/testParameter.type";
import { UserType } from "@/types/user.type";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { backendAssetUrl } from "@/lib/backendAsset";
import PatientPicker, { patientFromOrder } from "@/components/patients/PatientPicker";
import PatientStreamTabs, { type PatientStream } from "@/components/patients/PatientStreamTabs";
import { BillStatusBadge, WalkInPatientBadge, billedLockTitle } from "@/components/patients/PatientBadges";
import { apiErrorMessage } from "@/lib/apiError";

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
  const [selectedDate, setSelectedDate] = useState(() => toDateInputValue(new Date()));

  const [doctors, setDoctors] = useState<DoctorGridType[]>([]);
  // Orders from a consultation here vs walk-ins with an outside request - separate grids.
  const [stream, setStream] = useState<PatientStream>("consultation");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientSummaryType | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  // Outside doctor/facility on a walk-in's own lab request (when no in-house doctor ordered it).
  const [externalProvider, setExternalProvider] = useState("");
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
  // Requests whose tube labels are showing - one after a single collection, several after
  // "Mark all collected" from the collection guide.
  const [barcodeLabIds, setBarcodeLabIds] = useState<string[]>([]);
  // The patient whose collection guide is open: every one of their tests still waiting for
  // collection, grouped by container in the region's order of draw.
  const [guideFor, setGuideFor] = useState<LabRequestType | null>(null);
  const [collectingAll, setCollectingAll] = useState(false);

  // Read-only configuration view (gear icon) and the Revert action that undoes a started
  // request back to Requested, handing editing control back to the doctor - see
  // OrderLockHelper on the backend.
  const [viewingLabConfig, setViewingLabConfig] = useState<LabRequestType | null>(null);
  const [revertingId, setRevertingId] = useState<string | null>(null);

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
  // silent: live SignalR refreshes update the list in place instead of flashing the spinner.
  const fetchAll = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const [summaryRes, listRes] = await Promise.all([
        LabService.getSummary(),
        filter === "pending" ? LabService.getPending(selectedDate || undefined) : LabService.getAll(selectedDate || undefined),
      ]);
      setSummary(summaryRes.data ?? null);
      setRequests(listRes.data ?? []);
    } catch (error) {
      if (!silent) toast.error(apiErrorMessage(error, "Failed to load lab requests"));
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!checkedAuth) return;
    fetchAll();
    if (isAdmin) {
      UserService.getAllByRole("nurse").then((res) => setNurses(res.data || [])).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedAuth, filter, selectedDate]);

  useSignalRRefetch(
    ["labRequestCreated", "labStatusUpdated", "labRequestUpdated", "labRequestRemoved", "encounterFinished", "encounterReopened", "labSpecimensUpdated"],
    () => fetchAll(true)
  );

  useEffect(() => {
    if (!checkedAuth) return;
    const fetchDoctors = async () => {
      try {
        const gridRes = await ReceptionService.getSpecializationsWithDoctors();
        const allDoctors = (gridRes.specializations ?? []).flatMap(
          (s: { doctors: DoctorGridType[] }) => s.doctors
        );
        setDoctors(allDoctors);
      } catch (error) {
        console.error("Failed to load doctor picker:", error);
      }
    };
    fetchDoctors();
  }, [checkedAuth]);

  // A consultation order carries its visit; a walk-in's outside request doesn't.
  const consultationRequests = useMemo(() => requests.filter((r) => r.visitId), [requests]);
  const walkInRequests = useMemo(() => requests.filter((r) => !r.visitId), [requests]);
  const visibleRequests = stream === "consultation" ? consultationRequests : walkInRequests;

  const resetForm = () => {
    setSelectedPatient(null);
    setSelectedDoctorId("");
    setExternalProvider("");
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
    setSelectedPatient(patientFromOrder(request));
    setSelectedDoctorId(request.doctorId || "");
    setExternalProvider(request.externalProvider || "");
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
          toast.error(apiErrorMessage(error, "Failed to remove lab request"));
        }
      }
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      toast.warning("Select the patient, or register them as a walk-in");
      return;
    }
    if (!testType.trim()) {
      toast.warning("Please enter a test type");
      return;
    }

    notifySaveStatus("saving");
    try {
      setIsSubmitting(true);
      const payload = {
        patientId: selectedPatient.opId,
        doctorId: selectedDoctorId || undefined,
        externalProvider: selectedDoctorId ? undefined : externalProvider.trim() || undefined,
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
      notifySaveStatus("saved");
      // Requests raised here have no visit behind them - they belong to the walk-in list.
      if (!editingLabRequestId) setStream("walkIn");
      closeModal();
      fetchAll();
    } catch (error) {
      notifySaveStatus("error");
      toast.error(apiErrorMessage(error, editingLabRequestId ? "Failed to correct lab request" : "Failed to create lab request"));
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
      setBarcodeLabIds([labRequestId]);
      await fetchAll();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Failed to collect sample"));
    } finally {
      setCollectingId(null);
    }
  };

  // Same visit (or both walk-in) - what one venipuncture covers.
  const waitingForSameDraw = (r: LabRequestType) =>
    requests.filter(
      (x) => x.status === "Requested" && x.patientId === r.patientId && (x.visitId ?? null) === (r.visitId ?? null)
    );

  const collectAll = async (pending: LabRequestType[]) => {
    if (!requireNurseSelected()) return;
    const collected: string[] = [];
    try {
      setCollectingAll(true);
      for (const r of pending) {
        await LabService.collectSample(r.labRequestId, isAdmin ? selectedNurseId : undefined);
        collected.push(r.labRequestId);
      }
      toast.success(collected.length === 1 ? "Sample collected" : `${collected.length} samples collected`);
      setGuideFor(null);
    } catch (error) {
      toast.error(apiErrorMessage(error, collected.length ? `Collected ${collected.length}, then failed` : "Failed to collect samples"));
    } finally {
      if (collected.length) setBarcodeLabIds(collected);
      setCollectingAll(false);
      await fetchAll();
    }
  };

  const revertLabRequest = async (labRequestId: string) => {
    try {
      setRevertingId(labRequestId);
      await LabService.revert(labRequestId);
      toast.success("Reverted to Requested — the doctor can edit it again");
      await fetchAll();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Failed to revert request"));
    } finally {
      setRevertingId(null);
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
      toast.error(apiErrorMessage(error, "Failed to update status"));
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
      toast.error(apiErrorMessage(error, "Failed to upload result"));
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
      toast.error(apiErrorMessage(error, "Failed to load test parameters"));
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

    notifySaveStatus("saving");
    try {
      setIsSavingResultValues(true);
      const data = await LabService.saveResultValues(resultEntryTarget.labRequestId, values);
      toast.success(data.message || "Result values saved");
      notifySaveStatus("saved");
      closeResultEntry();
      fetchAll();
    } catch (error) {
      notifySaveStatus("error");
      toast.error(apiErrorMessage(error, "Failed to save result values"));
    } finally {
      setIsSavingResultValues(false);
    }
  };

  const barcodeLabs = requests.filter((l) => barcodeLabIds.includes(l.labRequestId));

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
            <div className="w-48 shrink-0">
              <SearchableSelect
                value={selectedNurseId}
                onChange={setSelectedNurseId}
                options={[
                  { value: "", label: "Acting nurse…" },
                  ...nurses.map((n) => ({ value: n.id, label: n.name })),
                ]}
              />
            </div>
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
      <div className="flex flex-wrap items-center gap-2 mb-4">
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
        <div className="w-44 ml-auto">
          <DatePicker
            value={selectedDate}
            onChange={setSelectedDate}
            max={toDateInputValue(new Date())}
            placeholder="All dates"
            className="flex h-9 w-full items-center gap-2 overflow-hidden rounded-lg border border-border bg-(--color-highlight) px-3 py-1.5 text-sm text-foreground ring-offset-background transition-all focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
          />
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
          <div className="bg-card w-full max-w-md rounded-xl border border-border p-6 shadow-2xl mx-4">
            <h2 className="text-2xl font-semibold mb-1 text-foreground">{editingLabRequestId ? "Correct Lab Request" : "New Lab Request"}</h2>
            <p className="text-sm text-muted-foreground mb-6">
              {editingLabRequestId ? "Correcting a request before it's completed." : "Register a new laboratory test request for a patient."}
            </p>

            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <PatientPicker value={selectedPatient} onChange={setSelectedPatient} required />

              <div>
                <label className="text-sm font-bold text-foreground/90">Ordering Doctor</label>
                <div className="mt-1">
                  <SearchableSelect
                    value={selectedDoctorId}
                    onChange={setSelectedDoctorId}
                    options={[
                      { value: "", label: "Outside doctor / not specified" },
                      ...doctors.map((d) => ({ value: d.doctorId, label: `${d.name} — ${d.specializationName}` })),
                    ]}
                  />
                </div>
              </div>

              {!selectedDoctorId && (
                <div>
                  <label className="text-sm font-bold text-foreground/90">Requested by (outside doctor / facility)</label>
                  <input
                    type="text"
                    value={externalProvider}
                    onChange={(e) => setExternalProvider(e.target.value)}
                    maxLength={200}
                    placeholder="e.g. Dr. Ahmed, City Clinic"
                    className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                  />
                </div>
              )}

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
                  <div className="mt-1">
                    <SearchableSelect
                      value={priority}
                      onChange={setPriority}
                      options={[
                        { value: "Normal", label: "Normal" },
                        { value: "Urgent", label: "Urgent" },
                      ]}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold text-foreground/90">Source</label>
                  <div className="mt-1">
                    <SearchableSelect
                      value={source}
                      onChange={setSource}
                      options={[
                        { value: "InHouse", label: "In-house" },
                        { value: "External", label: "External" },
                      ]}
                    />
                  </div>
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

      {barcodeLabs.length > 0 && (
        <div className="card p-6 flex flex-col items-start gap-2 mb-6">
          <div className="flex w-full items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              Sample Labels — {barcodeLabs.length === 1 ? barcodeLabs[0].testType : `${barcodeLabs[0].patientName} (${barcodeLabs.length} tests)`}
            </h2>
            <button onClick={() => setBarcodeLabIds([])} className="text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer">
              Close
            </button>
          </div>
          <p className="text-xs text-muted-foreground">One label per tube or container - stick each on its matching tube.</p>
          <SampleBarcodeLabels
            sets={barcodeLabs.map((l) => ({
              label: {
                labRequestId: l.labRequestId,
                testName: l.testType || "Lab Test",
                patientName: l.patientName,
                doctorName: l.doctorName || "Unassigned",
                collectedAt: formatDateTime(l.sampleCollectedAt || l.requestedDate),
                mrn: l.patientOPNumber || l.patientId || "—",
                collectedByName: l.sampleCollectedByName || "—",
                visitId: l.visitId,
              },
              specimens: l.specimens,
            }))}
            onPrint={() => barcodeLabs.forEach((l) => recordPrint(l.labRequestId))}
            printCount={barcodeLabs.length === 1 ? barcodeLabs[0].printCount : undefined}
            lastPrintedByName={barcodeLabs.length === 1 ? barcodeLabs[0].lastPrintedByName : undefined}
            lastPrintedAt={barcodeLabs.length === 1 ? barcodeLabs[0].lastPrintedAt : undefined}
          />
        </div>
      )}

      <div className="mb-4">
        <PatientStreamTabs
          value={stream}
          onChange={setStream}
          consultationCount={consultationRequests.length}
          walkInCount={walkInRequests.length}
        />
      </div>

      {isLoading ? (
        <div className="card py-16 flex justify-center">
          <LoadingSpinner />
        </div>
      ) : visibleRequests.length === 0 ? (
        <div className="card">
          <EmptyState
            illustration="lab"
            title={stream === "consultation" ? "No lab requests from consultations" : "No walk-in lab requests"}
            description={
              stream === "consultation"
                ? "Tests ordered by doctors show up here once they finish the encounter."
                : "Use New Lab Request for a patient who brings an outside lab request."
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleRequests.map((r) => {
            const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(r.status) + 1];
            const isWalkIn = !r.visitId;
            return (
              <div key={r.labRequestId} className="card p-4 flex flex-col gap-3">
                {/* Header: patient + badges */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-semibold text-foreground truncate">{r.patientName}</p>
                      <WalkInPatientBadge registrationType={r.patientRegistrationType} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.patientOPNumber ? `MRN ${r.patientOPNumber} · ` : ""}
                      {isWalkIn && !r.doctorId ? (r.externalProvider ? `Requested by ${r.externalProvider}` : "Outside request") : r.doctorName}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end items-center gap-1.5">
                    {isWalkIn && <BillStatusBadge billStatus={r.billStatus} />}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      r.priority === "Urgent" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                    }`}>
                      {r.priority}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass(r.status)}`}>
                      {r.status}
                    </span>
                  </div>
                </div>

                {/* Test name + result values */}
                <div>
                  <p className="text-sm text-foreground/80 font-medium leading-snug">{r.testType}</p>
                  <div className="mt-1.5">
                    <SpecimenChips specimens={r.specimens} source={r.specimenSource} />
                  </div>
                  {r.resultValues.length > 0 && (
                    <div className="mt-1.5 flex flex-col gap-0.5">
                      {r.resultValues.map((v, i) => (
                        <span key={i} className={`text-[11px] ${v.isAbnormal ? "font-semibold text-red-600" : "text-muted-foreground"}`}>
                          {v.parameterName}: {v.value}{v.unit ? ` ${v.unit}` : ""}{v.isAbnormal ? " ⚠" : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Requested date */}
                <p className="text-xs text-muted-foreground">{formatDateTime(r.requestedDate)}</p>

                {/* Primary action buttons */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  {(isNurse || isAdmin) && r.status === "Requested" && (
                    <button
                      onClick={() => collectSample(r.labRequestId)}
                      disabled={collectingId === r.labRequestId}
                      className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-md border border-primary/30 text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {collectingId === r.labRequestId ? "Collecting..." : "Mark Sample Collected"}
                    </button>
                  )}
                  {r.status === "Requested" && (
                    <button
                      onClick={() => setGuideFor(r)}
                      title="Which tubes to draw, in order, for all of this patient's waiting tests"
                      className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <ClipboardList size={13} /> Collection guide
                    </button>
                  )}
                  {(isNurse || isAdmin) && r.sampleCollectedByName && (
                    <button
                      onClick={() => setBarcodeLabIds([r.labRequestId])}
                      className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      {r.printCount > 0 ? "Reprint Barcode" : "Barcode"}
                    </button>
                  )}
                  {!isNurse && nextStatus && (
                    <button
                      onClick={() => advanceStatus(r)}
                      className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                    >
                      Mark {nextStatus}
                    </button>
                  )}
                  {!isNurse && r.listItemId && (
                    <button
                      onClick={() => openResultEntry(r)}
                      className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-md border border-primary/30 text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                    >
                      Enter Results
                    </button>
                  )}
                  {r.hasResultFile && (
                    <button
                      onClick={() => viewReport(r.resultFilePath)}
                      className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-md border border-border text-primary hover:bg-muted transition-colors cursor-pointer"
                    >
                      View Report
                    </button>
                  )}
                </div>

                {/* Icon actions row */}
                <div className="flex items-center gap-1">
                  {!isNurse && (
                    <label title="Upload result file" className={`p-1.5 rounded-full transition-all cursor-pointer ${uploadingId === r.labRequestId ? "opacity-50" : "hover:bg-primary/10"}`}>
                      <MdOutlineFileUpload size={16} className="text-primary" />
                      <input type="file" className="hidden" disabled={uploadingId === r.labRequestId} onChange={(e) => handleUploadResult(r, e.target.files?.[0])} />
                    </label>
                  )}
                  {!isNurse && r.status !== "Requested" && r.status !== "Completed" && r.status !== "Delivered" && (
                    <button onClick={() => revertLabRequest(r.labRequestId)} disabled={revertingId === r.labRequestId} title="Revert to Requested" className="p-1.5 hover:bg-muted rounded-full text-muted-foreground cursor-pointer disabled:opacity-50">
                      <Undo2 size={14} />
                    </button>
                  )}
                  {!isNurse && r.status !== "Completed" && r.status !== "Delivered" && (
                    <>
                      <button
                        onClick={() => openEditModal(r)}
                        disabled={!!r.billStatus}
                        title={r.billStatus ? billedLockTitle(r.billStatus) : "Correct request"}
                        className="p-1.5 hover:bg-primary/10 rounded-full text-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => removeLabRequest(r)}
                        disabled={!!r.billStatus}
                        title={r.billStatus ? billedLockTitle(r.billStatus) : "Delete request"}
                        className="p-1.5 hover:bg-destructive/10 rounded-full text-destructive cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                  <button onClick={() => setViewingLabConfig(r)} title="Configuration" className="p-1.5 hover:bg-primary/10 rounded-full text-muted-foreground hover:text-primary cursor-pointer">
                    <Settings size={14} />
                  </button>
                </div>

                {r.correctedFrom && (
                  <CorrectedFromNote>
                    <div>Previous: {r.correctedFrom.testType ?? "—"} · qty {r.correctedFrom.quantity} · {r.correctedFrom.priority}{r.correctedFrom.remarks ? ` · ${r.correctedFrom.remarks}` : ""}</div>
                    <div>Requested {formatDateTime(r.correctedFrom.requestedDate)}</div>
                  </CorrectedFromNote>
                )}
              </div>
            );
          })}
        </div>
      )}

      {guideFor && (
        <CollectionGuideModal
          patientName={guideFor.patientName}
          requests={waitingForSameDraw(guideFor)}
          canCollect={isNurse || isAdmin}
          collecting={collectingAll}
          onCollectAll={() => collectAll(waitingForSameDraw(guideFor))}
          onClose={() => setGuideFor(null)}
        />
      )}

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

      {/* Read-only configuration view - the doctor's own fields, gear icon on each row.
          Lab's own actions (Collect Sample, Mark Status, Enter Results, Revert, ...) stay
          fully functional above; only these config fields are view-only here. */}
      {viewingLabConfig && (
        <LabRadiologyConfigModal
          category="Lab"
          itemName={viewingLabConfig.testType || "Lab test"}
          values={{
            quantity: String(viewingLabConfig.quantity),
            priority: viewingLabConfig.priority,
            source: viewingLabConfig.source,
            remarks: viewingLabConfig.remarks || "",
            bodyParts: "",
            price: viewingLabConfig.price != null ? String(viewingLabConfig.price) : "",
            uccCode: viewingLabConfig.uccCode || "",
            covered: viewingLabConfig.covered === true ? "Yes" : viewingLabConfig.covered === false ? "No" : "",
            preAuthStatus: viewingLabConfig.preAuthStatus || "Not Required",
            patientShareAmount: viewingLabConfig.patientShareAmount != null ? String(viewingLabConfig.patientShareAmount) : "",
            coInsurancePercent: viewingLabConfig.coInsurancePercent != null ? String(viewingLabConfig.coInsurancePercent) : "",
          }}
          readOnly
          submitLabel="Save changes"
          onSave={() => {}}
          onClose={() => setViewingLabConfig(null)}
        />
      )}
    </div>
  );
}
