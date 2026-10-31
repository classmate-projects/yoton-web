import type { OrderLockFields } from "./orderLock.type";
import type { WalkInOrderFields } from "./patient.type";

export interface RadiologyRequestType extends OrderLockFields, WalkInOrderFields {
  radiologyRequestId: string;
  patientId: string | null;
  patientName: string;
  patientOPNumber?: string | null;
  doctorId: string | null;
  doctorName: string | null;
  visitId: string | null;
  scanType: string | null;
  listItemId: string | null;
  quantity: number;
  priority: string;
  source: string;
  price: number | null;
  covered: boolean | null;
  patientShareAmount: number | null;
  coInsurancePercent: number | null;
  preAuthStatus: string | null;
  uccCode: string | null;
  bodyParts: string | null;
  status: string;
  createdAt: string;
  scheduledDate: string | null;
  completedDate: string | null;
  notes: string | null;
  hasResultFile: boolean;
  resultFilePath: string | null;
  scanFilePath: string | null;
  imageUrls: string[];
  correctedFromId: string | null;
  correctedFrom: RadiologyRequestType | null;
}

export interface RadiologySummaryType {
  totalPending: number;
  urgent: number;
  completedToday: number;
}

export interface CreateRadiologyRequestPayload {
  patientId?: string;
  doctorId?: string;
  visitId?: string;
  scanType: string;
  listItemId?: string;
  quantity?: number;
  remarks?: string;
  priority: string;
  source?: string; // InHouse, External
  externalProvider?: string; // outside doctor/facility on a walk-in's order
  price?: number;
  covered?: boolean;
  patientShareAmount?: number;
  coInsurancePercent?: number;
  preAuthStatus?: string;
  uccCode?: string;
  bodyParts?: string;
}
