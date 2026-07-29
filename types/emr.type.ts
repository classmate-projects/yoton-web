export interface EmrPatientListItem {
  opId: string;
  name: string;
  age: number | null;
  sex: string | null;
  lastAppointmentDate: string | null;
  lastAppointmentStatus: string | null;
  assignedDoctorName: string | null;
}

export interface ChronicConditionType {
  chronicConditionId: string;
  name: string;
  diagnosedYear: number | null;
  status: string;
  createdAt: string;
}

export interface AllergyType {
  patientAllergyId: string;
  substance: string;
  reaction: string | null;
  recordedByRole: string | null;
  createdAt: string;
}

export interface MedicationType {
  medicationId: string;
  drugName: string;
  dosage: string | null;
  frequency: string | null;
  durationDays: number | null;
  priority: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
}

export interface SpecialRemarkType {
  specialRemarkId: string;
  remarkType: string;
  description: string;
  recordedByRole: string | null;
  createdAt: string;
}

export interface PatientDocumentType {
  patientDocumentId: string;
  patientId: string | null;
  visitId: string | null;
  documentType: string;
  linkedLabRequestId: string | null;
  linkedRadiologyRequestId: string | null;
  viewedByDoctor: boolean;
  viewedByNurse: boolean;
  createdAt: string;
}

export interface EncounterType {
  encounterId: string;
  appointmentId: string | null;
  visitId: string | null;
  chiefComplaint: string | null;
  diagnosisCode: string | null;
  diagnosisDescription: string | null;
  plannedProcedures: string | null;
  status: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface ReferralType {
  referralId: string;
  targetSpecializationId: string | null;
  targetSpecializationName: string | null;
  priority: string;
  notes: string | null;
  createdAt: string;
}

export interface PatientSummaryType {
  opId: string;
  opNumber: string | null;
  name: string;
  sex: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  chronicConditions: ChronicConditionType[];
  allergies: AllergyType[];
  currentMedications: MedicationType[];
  medicationHistory: MedicationType[];
  latestEncounter: EncounterType | null;
  referrals: ReferralType[];
  specialRemarks: SpecialRemarkType[];
  documents: PatientDocumentType[];
  unviewedDocumentCount: number;
}

export interface DoctorDashboardSummaryType {
  patientsUnderCare: number;
  activeCases: number;
  todaysAppointments: number;
  pendingReports: number;
  urgentItems: number;
}

export interface TodayScheduleItemType {
  appointmentId: string;
  patientId: string;
  patientName: string;
  appointmentDate: string;
  status: string;
}

export interface ActiveCaseItemType {
  patientId: string;
  patientName: string;
  encounterId: string;
  chiefComplaint: string | null;
  updatedAt: string | null;
}

export interface QuickNoteType {
  consultationNoteId: string;
  patientId: string;
  patientName: string | null;
  notes: string | null;
  createdAt: string;
}

export interface EncounterUpsertPayload {
  appointmentId?: string;
  visitId?: string;
  chiefComplaint?: string;
  diagnosisCode?: string;
  diagnosisDescription?: string;
  plannedProcedures?: string;
}

export interface ChronicConditionPayload {
  name: string;
  diagnosedYear?: number;
  status?: string;
}

export interface AllergyPayload {
  substance: string;
  reaction?: string;
}

export interface MedicationPayload {
  encounterId?: string;
  drugName: string;
  dosage?: string;
  frequency?: string;
  durationDays?: number;
  priority?: string; // STAT, PRN, Routine
}

export interface SpecialRemarkPayload {
  remarkType: string; // Refusal, ClinicalConcern, Other
  description: string;
}

export interface ReferralPayload {
  encounterId?: string;
  targetSpecializationId: string;
  priority?: string;
  notes?: string;
}
