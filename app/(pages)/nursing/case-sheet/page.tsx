"use client";

import { useEffect, useState } from "react";
import EmptyState from "@/components/EmptyState";
import { toast } from "sonner";
import { FileText, Search } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import PatientEmrModal from "@/components/PatientEmrModal";
import { EmrService } from "@/services/emr.service";
import { EmrPatientListItem } from "@/types/emr.type";
import { apiErrorMessage } from "@/lib/apiError";

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

  const [emrPatient, setEmrPatient] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    EmrService.getPatients()
      .then((res) => setPatients(res.data || []))
      .catch((error) => toast.error(apiErrorMessage(error, "Failed to load patients")))
      .finally(() => setIsLoadingPatients(false));
  }, []);

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
                          onClick={() => setEmrPatient({ id: p.opId, name: p.name })}
                          className="text-sm font-semibold text-primary hover:underline"
                        >
                          View Record
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState size="compact" illustration="patients" title="No patients found" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PatientEmrModal
        patientId={emrPatient?.id ?? ""}
        patientName={emrPatient?.name ?? ""}
        isOpen={!!emrPatient}
        onClose={() => setEmrPatient(null)}
      />
    </div>
  );
}
