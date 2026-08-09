"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { FlaskConical, ScanLine, Search } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import SampleBarcodeLabel from "@/components/SampleBarcodeLabel";
import { LabService } from "@/services/lab.service";
import { RadiologyService } from "@/services/radiology.service";
import { UserService } from "@/services/user.service";
import { backendAssetUrl } from "@/lib/backendAsset";
import { LabRequestType } from "@/types/lab.type";
import { RadiologyRequestType } from "@/types/radiology.type";
import { UserType } from "@/types/user.type";

const errorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.message || fallback : fallback;

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString() : "—";

export default function DoctorInvestigationsPage() {
  const router = useRouter();
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [role, setRole] = useState("");
  const isAdmin = role === "admin";

  const [nurses, setNurses] = useState<UserType[]>([]);
  const [selectedNurseId, setSelectedNurseId] = useState("");

  const [labs, setLabs] = useState<LabRequestType[]>([]);
  const [radiology, setRadiology] = useState<RadiologyRequestType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [barcodeLabId, setBarcodeLabId] = useState<string | null>(null);

  useEffect(() => {
    const detail = JSON.parse(localStorage.getItem("yoton_user_detail") || "{}");
    const currentRole = (detail.role || "").toLowerCase();
    if (currentRole !== "nurse" && currentRole !== "admin") {
      router.replace("/");
      return;
    }
    setRole(currentRole);
    setCheckedAuth(true);
  }, [router]);

  const fetchAll = async () => {
    try {
      setIsLoading(true);
      const [labsRes, radRes] = await Promise.all([LabService.getAll(), RadiologyService.getAll()]);
      setLabs(labsRes.data || []);
      setRadiology(radRes.data || []);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load investigations"));
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
  }, [checkedAuth]);

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

  const viewReport = (path: string | null) => {
    const url = backendAssetUrl(path);
    if (url) window.open(url, "_blank");
  };

  const filteredLabs = labs.filter(
    (l) =>
      l.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.testType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.doctorName?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredRadiology = radiology.filter(
    (r) =>
      r.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.scanType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.doctorName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const barcodeLab = labs.find((l) => l.labRequestId === barcodeLabId);

  if (!checkedAuth) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
            <FlaskConical className="text-primary" /> Doctor Investigations
          </h1>
          <p className="text-sm text-muted-foreground">
            Lab and radiology orders — collect samples, print labels, and view dispatched reports.
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
          <div className="relative w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by patient, test, or doctor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-9 text-sm"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="flex flex-col gap-6">
          {barcodeLab && (
            <div className="card p-6 flex flex-col items-start gap-2">
              <h2 className="text-lg font-semibold text-foreground">Sample Label — {barcodeLab.testType}</h2>
              <SampleBarcodeLabel
                label={{
                  labRequestId: barcodeLab.labRequestId,
                  testName: barcodeLab.testType || "Lab Test",
                  doctorName: barcodeLab.doctorName || "Unassigned",
                  date: formatDate(barcodeLab.sampleCollectedAt || barcodeLab.requestedDate),
                  mrn: barcodeLab.patientId || "—",
                  collectedByName: barcodeLab.sampleCollectedByName || "—",
                  visitId: barcodeLab.visitId,
                }}
              />
            </div>
          )}

          <div className="card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <FlaskConical size={18} className="text-primary" /> Lab Requests
            </h2>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Test</th>
                    <th>Doctor</th>
                    <th>Status</th>
                    <th>Sample</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLabs.length > 0 ? (
                    filteredLabs.map((l) => (
                      <tr key={l.labRequestId}>
                        <td className="font-semibold">{l.patientName}</td>
                        <td>{l.testType}</td>
                        <td>{l.doctorName || "—"}</td>
                        <td>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{l.status}</span>
                        </td>
                        <td className="text-xs text-muted-foreground">
                          {l.sampleCollectedByName ? `${l.sampleCollectedByName} · ${formatDate(l.sampleCollectedAt)}` : "—"}
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            {l.status === "Requested" && (
                              <button
                                onClick={() => collectSample(l.labRequestId)}
                                disabled={collectingId === l.labRequestId}
                                className="text-sm font-semibold text-primary hover:underline disabled:opacity-50"
                              >
                                Collect Sample
                              </button>
                            )}
                            {l.sampleCollectedByName && (
                              <button
                                onClick={() => setBarcodeLabId(l.labRequestId)}
                                className="text-sm font-semibold text-muted-foreground hover:underline"
                              >
                                Barcode
                              </button>
                            )}
                            {l.hasResultFile && (
                              <button
                                onClick={() => viewReport(l.resultFilePath)}
                                className="text-sm font-semibold text-primary hover:underline"
                              >
                                View Report
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center text-muted-foreground py-8">No lab requests found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <ScanLine size={18} className="text-primary" /> Radiology Requests
            </h2>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Scan</th>
                    <th>Doctor</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRadiology.length > 0 ? (
                    filteredRadiology.map((r) => (
                      <tr key={r.radiologyRequestId}>
                        <td className="font-semibold">{r.patientName}</td>
                        <td>{r.scanType}</td>
                        <td>{r.doctorName || "—"}</td>
                        <td>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{r.status}</span>
                        </td>
                        <td>
                          {r.hasResultFile ? (
                            <button
                              onClick={() => viewReport(r.resultFilePath || r.scanFilePath)}
                              className="text-sm font-semibold text-primary hover:underline"
                            >
                              View Report
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not yet dispatched</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center text-muted-foreground py-8">No radiology requests found.</td>
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
