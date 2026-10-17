import type { OrderLockFields } from "./orderLock.type";

export interface TreatmentType extends OrderLockFields {
  treatmentId: string;
  patientId: string | null;
  encounterId: string | null;
  listItemId: string | null;
  description: string;
  instructions: string | null;
  quantity: number;
  isPackage: boolean;
  isBillingPending: boolean;
  status: string; // Pending, InProgress, Done
  createdAt: string;
  startedAt: string | null;
  startedByName: string | null;
  doneAt: string | null;
  doneByName: string | null;
}

export interface CreateTreatmentPayload {
  patientId: string;
  encounterId?: string;
  listItemId?: string;
  description: string;
  instructions?: string;
  quantity?: number;
  isPackage?: boolean;
  isBillingPending?: boolean;
}
