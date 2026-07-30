export interface VisitType {
  visitId: string;
  patientId: string | null;
  patientName: string | null;
  appointmentId: string | null;
  appointmentDate: string | null;
  visitType: string; // Appointment, WalkIn
  status: string; // CheckedIn, WithNurse, WithDoctor, Investigations, Pharmacy, Billing, Completed
  checkedInAt: string;
  completedAt: string | null;
  notes: string | null;
}

export interface CheckInPayload {
  appointmentId: string;
}

export interface WalkInPayload {
  patientId: string;
  doctorId?: string;
  appointmentDate?: string;
  notes?: string;
}

export interface UploadPatientDocumentPayload {
  documentType: string; // ExternalLabReport, ExternalRadiologyReport, Other
  visitId?: string;
  linkedLabRequestId?: string;
  linkedRadiologyRequestId?: string;
  file: File;
}
