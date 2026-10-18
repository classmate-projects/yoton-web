// "External" = a walk-in registered with minimal details from Pharmacy/Lab/Radiology/Billing
// for an outside prescription or order. Same patient table and MRN as everyone else - it
// becomes "Full" once reception completes the registration.
export type PatientRegistrationType = "Full" | "External";

// Mirrors Yoton-API's PatientSummaryDto - what every patient picker shows and returns.
export interface PatientSummaryType {
  opId: string;
  opNumber: string | null;
  name: string;
  sex: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  phoneCode: string | null;
  nationalID: string | null;
  passportNumber: string | null;
  registrationType: PatientRegistrationType;
}

// An existing patient who shares an identifier with the one being entered.
export interface PatientMatchType extends PatientSummaryType {
  matchedOn: string[]; // e.g. ["Emirates ID", "Mobile number"]
  // An ID match (National ID / passport) is certainly the same person; a shared mobile or
  // email only suggests it, so the user may still create a new record.
  isStrongMatch: boolean;
}

export interface PatientMatchPayload {
  nationalID?: string;
  passportNumber?: string;
  phone?: string;
  phoneCode?: string;
  email?: string;
  excludePatientId?: string;
}

export interface CreateExternalPatientPayload {
  name: string;
  phone?: string;
  phoneCode?: string;
  nationalID?: string;
  passportNumber?: string;
  sex?: string;
  dateOfBirth?: string;
  nationality?: string;
  confirmNewDespiteMatches?: boolean;
}

// Shared by lab requests, radiology requests and walk-in prescriptions: walk-in orders have
// no visit and are usually paid up front, so departments see whether they're billed yet.
export interface WalkInOrderFields {
  visitId: string | null;
  patientRegistrationType?: PatientRegistrationType | null;
  externalProvider?: string | null;
  billId?: string | null;
  billStatus?: string | null; // Pending, Paid - null while not on a bill
}

// Which identifiers count as "the same person" (Settings > Duplicate patient check).
export const PATIENT_MATCH_FIELDS = ["NationalID", "Passport", "Phone", "Email"] as const;
export type PatientMatchField = (typeof PATIENT_MATCH_FIELDS)[number];
// ID numbers are always checked - one ID can only ever belong to one person.
export const ALWAYS_MATCHED_FIELDS: PatientMatchField[] = ["NationalID", "Passport"];
