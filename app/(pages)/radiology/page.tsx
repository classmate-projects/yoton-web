"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { ScanLine } from "lucide-react";
import { MdAdd, MdOutlineFileUpload } from "react-icons/md";
import LoadingSpinner from "@/components/LoadingSpinner";
import { RadiologyService } from "@/services/radiology.service";
import { ReceptionService } from "@/services/reception.service";
import { RadiologyRequestType, RadiologySummaryType } from "@/types/radiology.type";
import { PatientListItemType, DoctorGridType } from "@/types/appointment.type";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";

const errorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.message || fallback : fallback;

const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : "—";

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

  const [summary, setSummary] = useState<RadiologySummaryType | null>(null);
  const [requests, setRequests] = useState<RadiologyRequestType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending">("pending");

  const [patients, setPatients] = useState<PatientListItemType[]>([]);
  const [doctors, setDoctors] = useState<DoctorGridType[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientListItemType | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [scanType, setScanType] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [source, setSource] = useState("InHouse");
  const [price, setPrice] = useState("");

  const [scheduleFor, setScheduleFor] = useState<RadiologyRequestType | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // ---------------- ROLE GUARD ----------------
  useEffect(() => {
    const detail = JSON.parse(localStorage.getItem("yoton_user_detail") || "{}");
    const currentRole = (detail.role || "").toLowerCase();
    if (currentRole !== "radiology technician" && currentRole !== "admin") {
      router.replace("/");
      return;
    }
    setCheckedAuth(true);
  }, [router]);

  // ---------------- DATA ----------------
  const fetchAll = async () => {
    try {
      setIsLoading(true);
      const [summaryRes, listRes] = await Promise.all([
        RadiologyService.getSummary(),
        filter === "pending" ? RadiologyService.getPending() : RadiologyService.getAll(),
      ]);
      setSummary(summaryRes.data ?? null);
      setRequests(listRes.data ?? []);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load radiology requests"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!checkedAuth) return;
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedAuth, filter]);

  useSignalRRefetch(["radiologyRequestCreated", "radiologyStatusUpdated"], fetchAll);

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
        p.opId?.toLowerCase().includes(q)
    );
  }, [patientSearch, patients]);

  const resetForm = () => {
    setPatientSearch("");
    setSelectedPatient(null);
    setSelectedDoctorId("");
    setScanType("");
    setPriority("Normal");
    setSource("InHouse");
    setPrice("");
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !scanType.trim()) {
      toast.warning("Please select a patient and enter a scan type");
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await RadiologyService.create({
        patientId: selectedPatient.opId,
        doctorId: selectedDoctorId || undefined,
        scanType,
        priority,
        source,
        price: price ? Number(price) : undefined,
      });
      toast.success(data.message || "Radiology request created");
      closeModal();
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to create radiology request"));
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
      toast.error(errorMessage(error, "Failed to update status"));
    }
  };

  const confirmSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleFor || !scheduledDate) return;

    try {
      const data = await RadiologyService.updateStatus(
        scheduleFor.radiologyRequestId,
        "Scheduled",
        new Date(scheduledDate).toISOString()
      );
      toast.success(data.message || "Scan scheduled");
      setScheduleFor(null);
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to schedule scan"));
    }
  };

  const handleUploadResult = async (request: RadiologyRequestType, file: File | undefined) => {
    if (!file) return;
    try {
      setUploadingId(request.radiologyRequestId);
      const data = await RadiologyService.uploadResult(request.radiologyRequestId, file);
      toast.success(data.message || "Scan result uploaded");
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to upload scan result"));
    } finally {
      setUploadingId(null);
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
      <div className="flex justify-between items-center gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
            <ScanLine size={34} className="text-primary" />
            Radiology
          </h1>
          <p className="text-sm text-muted-foreground">
            Schedule and track X-Ray, MRI, CT and ultrasound requests.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="bg-primary px-4 py-2 rounded-md text-white text-lg flex gap-2 items-center cursor-pointer hover:opacity-90 transition duration-150 shrink-0"
        >
          <MdAdd size={22} />
          New Scan Request
        </button>
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
            <h2 className="text-2xl font-semibold mb-1 text-foreground">New Scan Request</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Register a new radiology scan request for a patient.
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
                  placeholder="Search by name, phone or OP ID..."
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
                          {p.opId} • {p.phone}
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
                  {isSubmitting ? "Saving..." : "Create Request"}
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
              <input
                type="datetime-local"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
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

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-foreground/90">Patient</th>
                <th className="text-foreground/90">Scan</th>
                <th className="text-foreground/90">Doctor</th>
                <th className="text-foreground/90">Priority</th>
                <th className="text-foreground/90">Requested / Scheduled</th>
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
                    <tr key={r.radiologyRequestId} className="hover:bg-muted/30 transition-colors">
                      <td className="font-semibold text-foreground">{r.patientName}</td>
                      <td className="text-foreground/80">{r.scanType}</td>
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
                      <td className="text-foreground/70 text-sm">
                        {formatDateTime(r.scheduledDate ?? r.createdAt)}
                      </td>
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadgeClass(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex justify-center items-center gap-2">
                          {nextStatus && (
                            <button
                              onClick={() => advanceStatus(r)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                            >
                              Mark {nextStatus}
                            </button>
                          )}
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
                          {r.hasResultFile && (
                            <span className="text-[11px] text-emerald-500 font-semibold">Result on file</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground">
                    No radiology requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
