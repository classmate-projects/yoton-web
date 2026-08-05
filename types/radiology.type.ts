export interface RadiologyRequestType {
  radiologyRequestId: string;
  patientId: string | null;
  patientName: string;
  doctorId: string | null;
  doctorName: string | null;
  visitId: string | null;
  scanType: string | null;
  listItemId: string | null;
  quantity: number;
  priority: string;
  source: string;
  price: number | null;
  status: string;
  createdAt: string;
  scheduledDate: string | null;
  completedDate: string | null;
  notes: string | null;
  hasResultFile: boolean;
  resultFilePath: string | null;
  scanFilePath: string | null;
}

export interface RadiologySummaryType {
  totalPending: number;
  urgent: number;
  completedToday: number;
}

export interface CreateRadiologyRequestPayload {
  patientId: string;
  doctorId?: string;
  visitId?: string;
  scanType: string;
  listItemId?: string;
  quantity?: number;
  remarks?: string;
  priority: string;
  source?: string; // InHouse, External
  price?: number;
}
