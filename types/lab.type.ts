export interface LabResultValueType {
  parameterName: string;
  unit: string | null;
  normalLow: number | null;
  normalHigh: number | null;
  value: string;
  isAbnormal: boolean | null;
}

export interface LabRequestType {
  labRequestId: string;
  patientId: string | null;
  patientName: string;
  patientOPNumber: string | null;
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
  covered: boolean | null;
  patientShareAmount: number | null;
  coInsurancePercent: number | null;
  preAuthStatus: string | null;
  uccCode: string | null;
  status: string;
  requestedDate: string;
  completedDate: string | null;
  hasResultFile: boolean;
  resultFilePath: string | null;
  sampleCollectedByName: string | null;
  sampleCollectedAt: string | null;
  printCount: number;
  lastPrintedAt: string | null;
  lastPrintedByName: string | null;
  resultValues: LabResultValueType[];
  correctedFromId: string | null;
  correctedFrom: LabRequestType | null;
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
  covered?: boolean;
  patientShareAmount?: number;
  coInsurancePercent?: number;
  preAuthStatus?: string;
  uccCode?: string;
}
