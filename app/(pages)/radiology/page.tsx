"use client";

import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, ScanLine, Settings, Trash2, Undo2, X } from "lucide-react";
import { notifySaveStatus } from "@/lib/saveStatus";
import { MdAdd, MdOutlineFileUpload, MdOutlineImage } from "react-icons/md";
import LoadingSpinner from "@/components/LoadingSpinner";
import DatePicker from "@/components/DatePicker";
import DateTimePicker from "@/components/DateTimePicker";
import { toDateInputValue, formatDateTime } from "@/lib/date";
import SearchableSelect from "@/components/SearchableSelect";
import CorrectedFromNote from "@/components/CorrectedFromNote";
import LabRadiologyConfigModal from "@/components/orders/LabRadiologyConfigModal";
import { confirmDeleteToast } from "@/lib/confirmDeleteToast";
import { RadiologyService } from "@/services/radiology.service";
import { ReceptionService } from "@/services/reception.service";
import { RadiologyRequestType, RadiologySummaryType } from "@/types/radiology.type";
import { DoctorGridType } from "@/types/appointment.type";
import { PatientSummaryType } from "@/types/patient.type";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { backendAssetUrl } from "@/lib/backendAsset";
import PatientPicker, { patientFromOrder } from "@/components/patients/PatientPicker";
import PatientStreamTabs, { type PatientStream } from "@/components/patients/PatientStreamTabs";
import { BillStatusBadge, WalkInPatientBadge, billedLockTitle } from "@/components/patients/PatientBadges";
import { apiErrorMessage } from "@/lib/apiError";

const STATUS_FLOW = ["Requested", "Scheduled", "Completed", "Delivered"];

const statusBadgeClass = (status: string) => {
  switch (status) {
    case "Delivered":
      return "bg-emerald-500/10 text-emerald-500";
    case "Completed":
      return "bg-primary/10 text-primary";
    case "Scheduled":
      return "bg-sky-500/10 text-sky-500";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export default function RadiologyPage() {
  const router = useRouter();
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [role, setRole] = useState("");
  // Nurses can view this module (see sidebaritems.ts) but only to check on requests a
  // doctor already ordered - ordering, advancing status, and uploading results/images
  // stay radiology technician/admin actions, matching RadiologyController's own
  // authorization (nurse only ever gets the class-level read access there).
  const isNurse = role === "nurse";

  const [summary, setSummary] = useState<RadiologySummaryType | null>(null);
  const [requests, setRequests] = useState<RadiologyRequestType[]>([]);
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
  // Outside doctor/facility on a walk-in's own radiology order (when no in-house doctor ordered it).
  const [externalProvider, setExternalProvider] = useState("");
  const [scanType, setScanType] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [source, setSource] = useState("InHouse");
  const [price, setPrice] = useState("");
  // Set while correcting an existing not-yet-Completed request - reuses the same modal/form
  // as creating a new one, matching every other add-form-doubles-as-edit-form in this feature.
  const [editingRadiologyRequestId, setEditingRadiologyRequestId] = useState<string | null>(null);

  const [scheduleFor, setScheduleFor] = useState<RadiologyRequestType | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadingImagesId, setUploadingImagesId] = useState<string | null>(null);
  const [galleryFor, setGalleryFor] = useState<RadiologyRequestType | null>(null);

  // Read-only configuration view (gear icon) and the Revert action that undoes a started
  // request back to Requested, handing editing control back to the doctor - see
  // OrderLockHelper on the backend.
  const [viewingRadiologyConfig, setViewingRadiologyConfig] = useState<RadiologyRequestType | null>(null);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  // ---------------- ROLE GUARD ----------------
  useEffect(() => {
    const detail = JSON.parse(localStorage.getItem("yoton_user_detail") || "{}");
    const currentRole = (detail.role || "").toLowerCase();
    const allowedModules: string[] = detail.allowedModules || [];
    if (currentRole !== "admin" && !allowedModules.includes("/radiology")) {
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
        RadiologyService.getSummary(),
        filter === "pending" ? RadiologyService.getPending(selectedDate || undefined) : RadiologyService.getAll(selectedDate || undefined),
      ]);
      setSummary(summaryRes.data ?? null);
      setRequests(listRes.data ?? []);
    } catch (error) {
      if (!silent) toast.error(apiErrorMessage(error, "Failed to load radiology requests"));
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!checkedAuth) return;
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedAuth, filter, selectedDate]);

  useSignalRRefetch(
    ["radiologyRequestCreated", "radiologyStatusUpdated", "radiologyRequestUpdated", "radiologyRequestRemoved", "encounterFinished", "encounterReopened"],
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

  // A consultation order carries its visit; a walk-in's outside order doesn't.
  const consultationRequests = useMemo(() => requests.filter((r) => r.visitId), [requests]);
  const walkInRequests = useMemo(() => requests.filter((r) => !r.visitId), [requests]);
  const visibleRequests = stream === "consultation" ? consultationRequests : walkInRequests;

  const resetForm = () => {
    setSelectedPatient(null);
    setSelectedDoctorId("");
    setExternalProvider("");
    setScanType("");
    setPriority("Normal");
    setSource("InHouse");
    setPrice("");
  };

  const openCreateModal = () => {
    resetForm();
    setEditingRadiologyRequestId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (request: RadiologyRequestType) => {
    resetForm();
    setEditingRadiologyRequestId(request.radiologyRequestId);
    setSelectedPatient(patientFromOrder(request));
    setSelectedDoctorId(request.doctorId || "");
    setExternalProvider(request.externalProvider || "");
    setScanType(request.scanType || "");
    setPriority(request.priority);
    setSource(request.source);
    setPrice(request.price != null ? String(request.price) : "");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRadiologyRequestId(null);
    resetForm();
  };

  const removeRadiologyRequest = (request: RadiologyRequestType) => {
    confirmDeleteToast(
      <span>Delete this radiology request for <b className="text-red-500 ml-1">{request.patientName}</b>?</span>,
      async () => {
        try {
          await RadiologyService.remove(request.radiologyRequestId);
          toast.success("Radiology request removed");
          fetchAll();
        } catch (error) {
          toast.error(apiErrorMessage(error, "Failed to remove radiology request"));
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
    if (!scanType.trim()) {
      toast.warning("Please enter a scan type");
      return;
    }

    notifySaveStatus("saving");
    try {
      setIsSubmitting(true);
      const payload = {
        patientId: selectedPatient.opId,
        doctorId: selectedDoctorId || undefined,
        externalProvider: selectedDoctorId ? undefined : externalProvider.trim() || undefined,
        scanType,
        priority,
        source,
        price: price ? Number(price) : undefined,
      };
      const data = editingRadiologyRequestId
        ? await RadiologyService.update(editingRadiologyRequestId, payload)
        : await RadiologyService.create(payload);
      toast.success(data.message || (editingRadiologyRequestId ? "Radiology request corrected" : "Radiology request created"));
      notifySaveStatus("saved");
      // Requests raised here have no visit behind them - they belong to the walk-in list.
      if (!editingRadiologyRequestId) setStream("walkIn");
      closeModal();
      fetchAll();
    } catch (error) {
      notifySaveStatus("error");
      toast.error(apiErrorMessage(error, editingRadiologyRequestId ? "Failed to correct radiology request" : "Failed to create radiology request"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const advanceStatus = async (request: RadiologyRequestType) => {
    const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(request.status) + 1];
    if (!nextStatus) return;

    if (nextStatus === "Scheduled") {
      setScheduleFor(request);
      setScheduledDate("");
      return;
    }

    try {
      const data = await RadiologyService.updateStatus(request.radiologyRequestId, nextStatus);
      toast.success(data.message || "Status updated");
      fetchAll();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Failed to update status"));
    }
  };

  const revertRadiologyRequest = async (radiologyRequestId: string) => {
    try {
      setRevertingId(radiologyRequestId);
      await RadiologyService.revert(radiologyRequestId);
      toast.success("Reverted to Requested — the doctor can edit it again");
      fetchAll();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Failed to revert request"));
    } finally {
      setRevertingId(null);
    }
  };

  const confirmSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleFor || !scheduledDate) return;

    notifySaveStatus("saving");
    try {
      const data = await RadiologyService.updateStatus(
        scheduleFor.radiologyRequestId,
        "Scheduled",
        new Date(scheduledDate).toISOString()
      );
      toast.success(data.message || "Scan scheduled");
      notifySaveStatus("saved");
      setScheduleFor(null);
      fetchAll();
    } catch (error) {
      notifySaveStatus("error");
      toast.error(apiErrorMessage(error, "Failed to schedule scan"));
    }
  };

  const viewReport = (path: string | null | undefined) => {
    const url = backendAssetUrl(path);
    if (url) window.open(url, "_blank");
  };

  const handleUploadResult = async (request: RadiologyRequestType, file: File | undefined) => {
    if (!file) return;
    try {
      setUploadingId(request.radiologyRequestId);
      const data = await RadiologyService.uploadResult(request.radiologyRequestId, file);
      toast.success(data.message || "Scan result uploaded");
      fetchAll();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Failed to upload scan result"));
    } finally {
      setUploadingId(null);
    }
  };

  const handleUploadImages = async (request: RadiologyRequestType, files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      setUploadingImagesId(request.radiologyRequestId);
      const data = await RadiologyService.uploadImages(request.radiologyRequestId, Array.from(files));
      toast.success(data.message || "Images uploaded");
      fetchAll();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Failed to upload images"));
    } finally {
      setUploadingImagesId(null);
    }
  };

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
            <ScanLine size={34} className="text-primary" />
            Radiology
          </h1>
          <p className="text-sm text-muted-foreground">
            Schedule and track X-Ray, MRI, CT and ultrasound requests.
          </p>
        </div>
        {!isNurse && (
          <button
            type="button"
            onClick={openCreateModal}
            className="bg-primary px-4 py-2 rounded-md text-white text-lg flex gap-2 items-center cursor-pointer hover:opacity-90 transition duration-150 shrink-0"
          >
            <MdAdd size={22} />
            New Scan Request
          </button>
        )}
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
            <h2 className="text-2xl font-semibold mb-1 text-foreground">{editingRadiologyRequestId ? "Correct Scan Request" : "New Scan Request"}</h2>
            <p className="text-sm text-muted-foreground mb-6">
              {editingRadiologyRequestId ? "Correcting a request before it's completed." : "Register a new radiology scan request for a patient."}
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
                <label className="text-sm font-bold text-foreground/90 required">Scan Type</label>
                <input
                  type="text"
                  required
                  value={scanType}
                  onChange={(e) => setScanType(e.target.value)}
                  placeholder="e.g. MRI Brain"
                  className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                />
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
                  {isSubmitting ? "Saving..." : editingRadiologyRequestId ? "Save Correction" : "Create Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {scheduleFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
          <div className="bg-card w-full max-w-sm rounded-xl border border-border p-6 shadow-2xl mx-4">
            <h2 className="text-xl font-semibold mb-1 text-foreground">Schedule Scan</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {scheduleFor.patientName} — {scheduleFor.scanType}
            </p>
            <form onSubmit={confirmSchedule} className="flex flex-col gap-4">
              <DateTimePicker
                value={scheduledDate}
                onChange={setScheduledDate}
                required
                dateClassName="flex h-12 w-full items-center gap-2 overflow-hidden rounded-lg border border-border bg-muted px-3 text-foreground focus-within:border-primary"
                timeClassName="h-12 w-32 shrink-0 rounded-lg border border-border bg-muted px-3 text-foreground outline-none focus:border-primary disabled:opacity-50"
              />
              <div className="flex items-center justify-end gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setScheduleFor(null)}
                  className="px-5 py-2.5 rounded-md border border-border hover:bg-muted transition-all duration-200 cursor-pointer text-foreground w-full"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-md bg-primary text-white hover:opacity-90 transition-all duration-200 cursor-pointer w-full"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
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
            illustration="radiology"
            title={stream === "consultation" ? "No radiology requests from consultations" : "No walk-in radiology requests"}
            description={
              stream === "consultation"
                ? "Imaging ordered by doctors shows up here once they finish the encounter."
                : "Use New Scan Request for a patient who brings an outside radiology order."
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleRequests.map((r) => {
            const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(r.status) + 1];
            const isWalkIn = !r.visitId;
            return (
              <div key={r.radiologyRequestId} className="card p-4 flex flex-col gap-3">
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
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        r.priority === "Urgent" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.priority}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass(r.status)}`}>
                      {r.status}
                    </span>
                  </div>
                </div>

                {/* Scan */}
                <div>
                  <p className="text-sm text-foreground/80 font-medium leading-snug">{r.scanType}</p>
                  {r.bodyParts && <p className="text-xs text-muted-foreground">{r.bodyParts}</p>}
                </div>

                <p className="text-xs text-muted-foreground">
                  {r.scheduledDate ? `Scheduled ${formatDateTime(r.scheduledDate)}` : `Requested ${formatDateTime(r.createdAt)}`}
                </p>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  {!isNurse && nextStatus && (
                    <button
                      onClick={() => advanceStatus(r)}
                      className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                    >
                      Mark {nextStatus}
                    </button>
                  )}
                  {!isNurse && (
                    <label
                      title="Upload scan result"
                      className={`p-1.5 rounded-full transition-all cursor-pointer ${
                        uploadingId === r.radiologyRequestId ? "opacity-50" : "hover:bg-primary/10"
                      }`}
                    >
                      <MdOutlineFileUpload size={18} className="text-primary" />
                      <input
                        type="file"
                        className="hidden"
                        disabled={uploadingId === r.radiologyRequestId}
                        onChange={(e) => handleUploadResult(r, e.target.files?.[0])}
                      />
                    </label>
                  )}
                  {r.hasResultFile && (
                    <button
                      onClick={() => viewReport(r.resultFilePath || r.scanFilePath)}
                      className="text-[11px] font-semibold text-primary hover:underline"
                    >
                      View Report
                    </button>
                  )}
                  {!isNurse && (
                    <label
                      title="Attach scan images (X-ray, etc.)"
                      className={`p-1.5 rounded-full transition-all cursor-pointer ${
                        uploadingImagesId === r.radiologyRequestId ? "opacity-50" : "hover:bg-primary/10"
                      }`}
                    >
                      <MdOutlineImage size={18} className="text-primary" />
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={uploadingImagesId === r.radiologyRequestId}
                        onChange={(e) => handleUploadImages(r, e.target.files)}
                      />
                    </label>
                  )}
                  {r.imageUrls.length > 0 && (
                    <button
                      onClick={() => setGalleryFor(r)}
                      className="text-[11px] font-semibold text-primary hover:underline"
                    >
                      {r.imageUrls.length} image{r.imageUrls.length > 1 ? "s" : ""}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1">
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
                        onClick={() => removeRadiologyRequest(r)}
                        disabled={!!r.billStatus}
                        title={r.billStatus ? billedLockTitle(r.billStatus) : "Delete request"}
                        className="p-1.5 hover:bg-destructive/10 rounded-full text-destructive cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                  {!isNurse && r.status !== "Requested" && r.status !== "Completed" && r.status !== "Delivered" && (
                    <button
                      onClick={() => revertRadiologyRequest(r.radiologyRequestId)}
                      disabled={revertingId === r.radiologyRequestId}
                      title="Revert to Requested — hand editing back to the doctor"
                      className="p-1.5 hover:bg-muted rounded-full text-muted-foreground cursor-pointer disabled:opacity-50"
                    >
                      <Undo2 size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => setViewingRadiologyConfig(r)}
                    title="Configuration"
                    className="p-1.5 hover:bg-primary/10 rounded-full text-muted-foreground hover:text-primary cursor-pointer"
                  >
                    <Settings size={14} />
                  </button>
                </div>

                {r.correctedFrom && (
                  <CorrectedFromNote>
                    <div>
                      Previous: {r.correctedFrom.scanType ?? "—"}
                      {r.correctedFrom.bodyParts ? ` · ${r.correctedFrom.bodyParts}` : ""}
                      {` · ${r.correctedFrom.priority}`}
                      {r.correctedFrom.notes ? ` · ${r.correctedFrom.notes}` : ""}
                    </div>
                    <div>Requested {formatDateTime(r.correctedFrom.createdAt)}</div>
                  </CorrectedFromNote>
                )}
              </div>
            );
          })}
        </div>
      )}

      {galleryFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
          <div className="bg-card w-full max-w-3xl rounded-xl border border-border p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Scan Images</h2>
                <p className="text-sm text-muted-foreground">
                  {galleryFor.patientName} — {galleryFor.scanType}
                </p>
              </div>
              <button onClick={() => setGalleryFor(null)} className="text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {galleryFor.imageUrls.map((url, i) => (
                <a key={i} href={backendAssetUrl(url) ?? "#"} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- backend-hosted, runtime-only path */}
                  <img
                    src={backendAssetUrl(url) ?? undefined}
                    alt={`Scan image ${i + 1}`}
                    className="w-full h-32 object-cover rounded-lg border border-border hover:opacity-80 transition-opacity"
                  />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Read-only configuration view - the doctor's own fields, gear icon on each row.
          Radiology's own actions (Mark Status, Upload, Attach images, Revert, ...) stay
          fully functional above; only these config fields are view-only here. */}
      {viewingRadiologyConfig && (
        <LabRadiologyConfigModal
          category="Radiology"
          itemName={viewingRadiologyConfig.scanType || "Scan"}
          values={{
            quantity: String(viewingRadiologyConfig.quantity),
            priority: viewingRadiologyConfig.priority,
            source: viewingRadiologyConfig.source,
            remarks: viewingRadiologyConfig.notes || "",
            bodyParts: viewingRadiologyConfig.bodyParts || "",
            price: viewingRadiologyConfig.price != null ? String(viewingRadiologyConfig.price) : "",
            uccCode: viewingRadiologyConfig.uccCode || "",
            covered: viewingRadiologyConfig.covered === true ? "Yes" : viewingRadiologyConfig.covered === false ? "No" : "",
            preAuthStatus: viewingRadiologyConfig.preAuthStatus || "Not Required",
            patientShareAmount: viewingRadiologyConfig.patientShareAmount != null ? String(viewingRadiologyConfig.patientShareAmount) : "",
            coInsurancePercent: viewingRadiologyConfig.coInsurancePercent != null ? String(viewingRadiologyConfig.coInsurancePercent) : "",
          }}
          readOnly
          submitLabel="Save changes"
          onSave={() => {}}
          onClose={() => setViewingRadiologyConfig(null)}
        />
      )}
    </div>
  );
}
