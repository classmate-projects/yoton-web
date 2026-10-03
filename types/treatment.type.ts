export interface TreatmentType {
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
  // Whether the doctor can still edit this order right now - see OrderLockHelper on the
  // backend. lockedBy is "Nursing" (already started) or "Visit" (encounter finalized).
  locked: boolean;
  lockedBy: string | null;
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
