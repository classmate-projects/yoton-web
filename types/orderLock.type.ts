// Filled by the backend's OrderLockHelper on every Lab/Radiology/Treatment/Medication order -
// whether the doctor can still edit it and, if not, who has it.
export interface OrderLockFields {
  locked: boolean;
  // The team that can release the lock (Lab, Radiology, Nursing, Pharmacy), or "Visit" when
  // the order's encounter is finalized.
  lockedBy: string | null;
  lockAction: string | null; // e.g. "Sample collected", "Administered", "Prepared"
  lockedByUserId: string | null;
  lockedByName: string | null;
  lockedAt: string | null;
  lockMessage: string | null;
}
