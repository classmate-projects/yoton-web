export interface LabRequestType {
  labRequestId: string;
  patientId: string | null;
  patientName: string;
  doctorId: string | null;
  doctorName: string | null;
  visitId: string | null;
  testType: string | null;
  priority: string;
  source: string;
  price: number | null;
  status: string;
  requestedDate: string;
  completedDate: string | null;
  hasResultFile: boolean;
}

export interface LabSummaryType {
  totalPending: number;
  urgent: number;
  completedToday: number;
}

export interface CreateLabRequestPayload {
  patientId: string;
  doctorId?: string;
  visitId?: string;
  testType: string;
  priority: string;
  source?: string; // InHouse, External
  price?: number;
}
