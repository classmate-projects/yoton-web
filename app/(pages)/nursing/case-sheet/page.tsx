"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, FileText, Search, Stethoscope } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { EmrService } from "@/services/emr.service";
import { EmrPatientListItem, PatientSummaryType } from "@/types/emr.type";
import PatientMedicalFormsSection from "@/components/medicalForms/PatientMedicalFormsSection";

const errorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.message || fallback : fallback;

const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : "—";

// Fully read-only render of a patient's record — reuses the same EMR summary endpoint
// the Doctor Workbench and Nurse Workbench's "Clinical Snapshot" already call. No inputs,
// no save actions: nobody can modify doctor notes, diagnosis, or treatment plans from
// here, so it's safe for every role granted this module to see (see
// EmrController.GetPatients/GetPatientSummary for the matching backend access). No
// client-side role check either - the (pages)/layout.tsx route guard already gates access
// centrally off this page's own allowedModules entry ("/nursing/case-sheet").
export default function ElectronicMedicalRecordPage() {
  const [patients, setPatients] = useState<EmrPatientListItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [summary, setSummary] = useState<PatientSummaryType | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  useEffect(() => {
    EmrService.getPatients()
      .then((res) => setPatients(res.data || []))
      .catch((error) => toast.error(errorMessage(error, "Failed to load patients")))
      .finally(() => setIsLoadingPatients(false));
  }, []);

  const openPatient = async (patientId: string) => {
    setSelectedPatientId(patientId);
    setIsLoadingSummary(true);
    try {
      const res = await EmrService.getPatientSummary(patientId);
      setSummary(res.data);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load case sheet"));
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const filteredPatients = patients.filter(
    (p) =>
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.opNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.opId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.assignedDoctorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.nationalID?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.passportNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (selectedPatientId) {
    return (
      <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
        <button
          onClick={() => {
            setSelectedPatientId(null);
            setSummary(null);
          }}
          className="mb-6 flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"
        >
          <ArrowLeft size={16} /> Back to patient list
        </button>

        {isLoadingSummary || !summary ? (
          <LoadingSpinner />
        ) : (
          <div className="flex flex-col gap-6">
            <div className="card p-6 flex flex-col gap-1 border-l-4 border-l-primary">
              <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                <FileText className="text-primary" /> {summary.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                MRN {summary.opNumber || summary.opId} · {summary.sex || "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Read-only — doctor notes, diagnosis, and treatment plans cannot be edited here.
              </p>
            </div>

            <div className="card p-6 flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Stethoscope size={18} className="text-primary" /> Chief Complaint &amp; Diagnosis
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Chief Complaint</p>
                  <p className="text-foreground">{summary.latestEncounter?.chiefComplaint || "Not recorded"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Diagnosis</p>
                  <p className="text-foreground">
                    {summary.latestEncounter?.diagnosisCode || "—"} {summary.latestEncounter?.diagnosisDescription || ""}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Planned Procedures</p>
                  <p className="text-foreground">{summary.latestEncounter?.plannedProcedures || "Not recorded"}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-6 flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-foreground">Current Medications</h2>
                {summary.currentMedications.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {summary.currentMedications.map((m) => (
                      <div key={m.medicationId} className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm">
                        <span className="font-medium">{m.drugName}</span>
                        <span className="text-xs text-muted-foreground ml-2">{m.dosage} {m.frequency}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No active prescriptions.</p>
                )}
              </div>

              <div className="card p-6 flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-foreground">Treatments</h2>
                {summary.treatments.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {summary.treatments.map((t) => (
                      <div key={t.treatmentId} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm">
                        <span className="font-medium">{t.description}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${t.status === "Done" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                          {t.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No treatments ordered.</p>
                )}
              </div>

              <div className="card p-6 flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-foreground">Referrals</h2>
                {summary.referrals.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {summary.referrals.map((r) => (
                      <div key={r.referralId} className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm">
                        <span className="font-medium">{r.targetSpecializationName || "Specialist"}</span>
                        <span className="text-xs text-muted-foreground ml-2">{r.priority}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No referrals.</p>
                )}
              </div>

              <div className="card p-6 flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-foreground">Special Remarks</h2>
                {summary.specialRemarks.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {summary.specialRemarks.map((r) => (
                      <div key={r.specialRemarkId} className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm">
                        <span className="font-medium">{r.remarkType}:</span> <span>{r.description}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">None recorded.</p>
                )}
              </div>
            </div>

            <div className="card p-6 flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-foreground">Nurse Notes</h2>
              {summary.nurseNotes.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {summary.nurseNotes.map((n) => (
                    <div key={n.nurseNoteId} className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                      <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: n.contentHtml }} />
                      <span className="text-xs text-muted-foreground">{n.nurseName || "Nurse"} · {formatDateTime(n.createdAt)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No nurse notes recorded.</p>
              )}
            </div>

            <PatientMedicalFormsSection patientId={selectedPatientId} visitId={null} readOnly />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
      <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground mb-1">
        <FileText className="text-primary" /> Electronic Medical Record
      </h1>
      <p className="text-sm text-muted-foreground mb-6">Read-only view of the doctor&apos;s notes, diagnosis, and treatment plan.</p>

      {isLoadingPatients ? (
        <LoadingSpinner />
      ) : (
        <div className="card p-6">
          <div className="relative w-64 mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, phone, MRN, doctor, national ID, or passport..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-9 text-sm"
            />
          </div>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>MRN</th>
                  <th>Name</th>
                  <th>Assigned Doctor</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.length > 0 ? (
                  filteredPatients.map((p) => (
                    <tr key={p.opId}>
                      <td className="font-mono text-xs">{p.opNumber || p.opId}</td>
                      <td className="font-semibold">{p.name}</td>
                      <td>{p.assignedDoctorName || "—"}</td>
                      <td>
                        <button
                          onClick={() => openPatient(p.opId)}
                          className="text-sm font-semibold text-primary hover:underline"
                        >
                          View Record
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center text-muted-foreground py-8">
                      No patients found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
