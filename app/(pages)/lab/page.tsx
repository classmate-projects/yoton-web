"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { FlaskConical } from "lucide-react";
import { MdAdd, MdOutlineFileUpload } from "react-icons/md";
import LoadingSpinner from "@/components/LoadingSpinner";
import { LabService } from "@/services/lab.service";
import { ReceptionService } from "@/services/reception.service";
import { LabRequestType, LabSummaryType } from "@/types/lab.type";
import { PatientListItemType, DoctorGridType } from "@/types/appointment.type";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";

const errorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.message || fallback : fallback;

const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : "—";

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
  const [priority, setPriority] = useState("Normal");
  const [source, setSource] = useState("InHouse");
  const [price, setPrice] = useState("");

  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // ---------------- ROLE GUARD ----------------
  useEffect(() => {
    const detail = JSON.parse(localStorage.getItem("yoton_user_detail") || "{}");
    const currentRole = (detail.role || "").toLowerCase();
    if (currentRole !== "lab technician" && currentRole !== "admin") {
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
        p.opId?.toLowerCase().includes(q)
    );
  }, [patientSearch, patients]);

  const resetForm = () => {
    setPatientSearch("");
    setSelectedPatient(null);
    setSelectedDoctorId("");
    setTestType("");
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
    if (!selectedPatient || !testType.trim()) {
      toast.warning("Please select a patient and enter a test type");
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await LabService.create({
        patientId: selectedPatient.opId,
        doctorId: selectedDoctorId || undefined,
        testType,
        priority,
        source,
        price: price ? Number(price) : undefined,
      });
      toast.success(data.message || "Lab request created");
      closeModal();
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to create lab request"));
    } finally {
      setIsSubmitting(false);
    }
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
            <FlaskConical size={34} className="text-primary" />
            Laboratory
          </h1>
          <p className="text-sm text-muted-foreground">
            Track sample collection, processing, and delivery of lab test requests.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="bg-primary px-4 py-2 rounded-md text-white text-lg flex gap-2 items-center cursor-pointer hover:opacity-90 transition duration-150 shrink-0"
        >
          <MdAdd size={22} />
          New Lab Request
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
            <h2 className="text-2xl font-semibold mb-1 text-foreground">New Lab Request</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Register a new laboratory test request for a patient.
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
                <label className="text-sm font-bold text-foreground/90 required">Test Type</label>
                <input
                  type="text"
                  required
                  value={testType}
                  onChange={(e) => setTestType(e.target.value)}
                  placeholder="e.g. Complete Blood Count"
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
                      <td className="text-foreground/80">{r.testType}</td>
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
                    No lab requests found.
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
