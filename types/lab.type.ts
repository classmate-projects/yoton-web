export interface LabRequestType {
  labRequestId: string;
  patientId: string | null;
  patientName: string;
  doctorId: string | null;
  doctorName: string | null;
  visitId: string | null;
  testType: string | null;
  listItemId: string | null;
  quantity: number;
  remarks: string | null;
  priority: string;
  source: string;
  price: number | null;
  status: string;
  requestedDate: string;
  completedDate: string | null;
  hasResultFile: boolean;
  resultFilePath: string | null;
  sampleCollectedByName: string | null;
  sampleCollectedAt: string | null;
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
  listItemId?: string;
  quantity?: number;
  remarks?: string;
  priority: string;
  source?: string; // InHouse, External
  price?: number;
}
