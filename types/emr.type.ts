import { MedicationAdministrationType, NurseNoteType, TreatmentType } from "./nursing.type";

export interface EmrPatientListItem {
  opId: string;
  // Hospital-assigned outpatient number - what the UI shows as "MRN". opId itself stays
  // internal (routing, FK payloads, React keys) and is never shown to a user.
  opNumber: string | null;
  name: string;
  age: number | null;
  sex: string | null;
  lastAppointmentDate: string | null;
  lastAppointmentStatus: string | null;
  assignedDoctorName: string | null;
  assignedSpecialtyName: string | null;
  chiefComplaint: string | null;
  phone: string | null;
  nationalID: string | null;
  passportNumber: string | null;
}

export interface ChronicConditionType {
  chronicConditionId: string;
  name: string;
  diagnosedYear: number | null;
  status: string;
  diabetesType: string | null; // Type1, Type2, Gestational, Other
  diagnosisDate: string | null;
  hasPcos: boolean;
  hasEsrd: boolean;
  createdAt: string;
}

export interface AllergyType {
  patientAllergyId: string;
  substance: string;
  reaction: string | null;
  recordedByRole: string | null;
  createdAt: string;
}

export interface TaperingStepType {
  medicationTaperingStepId: string;
  stepOrder: number;
  dosage: string | null;
  dosageUnit: string | null;
  frequency: string | null;
  durationDays: number | null;
}

export interface MedicationType {
  medicationId: string;
  medicineId: string | null;
  drugName: string;
  dosage: string | null;
  dosageUnit: string | null;
  frequency: string | null;
  durationDays: number | null;
  orderType: string | null;
  route: string | null;
  instructions: string | null;
  priority: string;
  drugType: string | null;
  mealTiming: string | null;
  plannedEndDate: string | null;
  totalQuantity: number | null;
  refillCount: number;
  prnReason: string | null;
  requiresCounselling: boolean;
  isHighRisk: boolean;
  status: string;
  startedAt: string;
  endedAt: string | null;
  administrations: MedicationAdministrationType[];
  taperingSteps: TaperingStepType[];
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
  examinationNotes: string | null;
  clinicalExamination: string | null;
  rosConstitutional: string | null;
  rosEyeEarNoseMouthThroat: string | null;
  rosCardiovascular: string | null;
  rosRespiratory: string | null;
  rosGastroenterology: string | null;
  rosGenitourinary: string | null;
  rosMusculoskeletal: string | null;
  rosNeurological: string | null;
  rosPsychiatric: string | null;
  rosEndocrine: string | null;
  rosHematologic: string | null;
  rosAllergicImmunologic: string | null;
  rosIntegumentary: string | null;
  status: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface DoctorConfidentialNoteType {
  doctorConfidentialNoteId: string;
  patientId: string | null;
  patientName: string | null;
  contentHtml: string;
  createdAt: string;
}

export interface EncounterDiagnosisType {
  encounterDiagnosisId: string;
  listItemId: string | null;
  diagnosisCode: string | null;
  diagnosisName: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface FollowUpType {
  followUpId: string;
  patientId: string | null;
  patientName: string | null;
  followUpDate: string;
  instructions: string | null;
  createdAt: string;
}

export interface ReferralType {
  referralId: string;
  targetSpecializationId: string | null;
  targetSpecializationName: string | null;
  priority: string;
  notes: string | null;
  cancerSiteListItemId: string | null;
  cancerSiteName: string | null;
  externalFacility: string | null;
  dateSeenBySpecialist: string | null;
  createdAt: string;
}

export interface DentalVisitExtraType {
  dentalVisitExtraId: string;
  fissureSealantApplied: boolean;
  fluorideApplied: boolean;
  sdfApplied: boolean;
  oralHygieneEducationGiven: boolean;
  lifestyleEducationGiven: boolean;
  smokingCessationEducationGiven: boolean;
  comprehensiveDentalPlanProvided: boolean;
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
  maritalStatus: string | null;
  nationality: string | null;
  chronicConditions: ChronicConditionType[];
  allergies: AllergyType[];
  currentMedications: MedicationType[];
  medicationHistory: MedicationType[];
  latestEncounter: EncounterType | null;
  referrals: ReferralType[];
  specialRemarks: SpecialRemarkType[];
  nurseNotes: NurseNoteType[];
  treatments: TreatmentType[];
  diagnoses: EncounterDiagnosisType[];
  followUps: FollowUpType[];
  documents: PatientDocumentType[];
  unviewedDocumentCount: number;
  dentalVisitExtras: DentalVisitExtraType[];
}

export interface DoctorDashboardSummaryType {
  patientsUnderCare: number;
  activeCases: number;
  todaysAppointments: number;
  pendingReports: number;
  urgentItems: number;
  isDentalSpecialty: boolean;
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
  examinationNotes?: string;
  clinicalExamination?: string;
  rosConstitutional?: string;
  rosEyeEarNoseMouthThroat?: string;
  rosCardiovascular?: string;
  rosRespiratory?: string;
  rosGastroenterology?: string;
  rosGenitourinary?: string;
  rosMusculoskeletal?: string;
  rosNeurological?: string;
  rosPsychiatric?: string;
  rosEndocrine?: string;
  rosHematologic?: string;
  rosAllergicImmunologic?: string;
  rosIntegumentary?: string;
}

export interface ProposeEncounterCorrectionPayload {
  targetUserId: string;
  chiefComplaint?: string;
  diagnosisCode?: string;
  diagnosisDescription?: string;
  plannedProcedures?: string;
  examinationNotes?: string;
  clinicalExamination?: string;
  rosConstitutional?: string;
  rosEyeEarNoseMouthThroat?: string;
  rosCardiovascular?: string;
  rosRespiratory?: string;
  rosGastroenterology?: string;
  rosGenitourinary?: string;
  rosMusculoskeletal?: string;
  rosNeurological?: string;
  rosPsychiatric?: string;
  rosEndocrine?: string;
  rosHematologic?: string;
  rosAllergicImmunologic?: string;
  rosIntegumentary?: string;
}

export interface EncounterCorrectionType {
  encounterCorrectionId: string;
  encounterId: string;
  patientId: string | null;
  patientName: string | null;
  proposedByUserId: string | null;
  proposedByName: string | null;
  status: "Pending" | "Acknowledged" | "Rejected";
  chiefComplaint: string | null;
  diagnosisCode: string | null;
  diagnosisDescription: string | null;
  plannedProcedures: string | null;
  examinationNotes: string | null;
  clinicalExamination: string | null;
  rosConstitutional: string | null;
  rosEyeEarNoseMouthThroat: string | null;
  rosCardiovascular: string | null;
  rosRespiratory: string | null;
  rosGastroenterology: string | null;
  rosGenitourinary: string | null;
  rosMusculoskeletal: string | null;
  rosNeurological: string | null;
  rosPsychiatric: string | null;
  rosEndocrine: string | null;
  rosHematologic: string | null;
  rosAllergicImmunologic: string | null;
  rosIntegumentary: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ChronicConditionPayload {
  name: string;
  diagnosedYear?: number;
  status?: string;
  diabetesType?: string; // Type1, Type2, Gestational, Other
  diagnosisDate?: string;
  hasPcos?: boolean;
  hasEsrd?: boolean;
}

export interface AllergyPayload {
  substance: string;
  reaction?: string;
}

export interface TaperingStepPayload {
  stepOrder: number;
  dosage?: string;
  dosageUnit?: string;
  frequency?: string;
  durationDays?: number;
}

export interface MedicationPayload {
  encounterId?: string;
  medicineId?: string;
  drugName: string;
  dosage?: string;
  dosageUnit?: string;
  frequency?: string;
  durationDays?: number;
  orderType?: string;
  route?: string;
  instructions?: string;
  priority?: string; // STAT, PRN, Routine
  drugType?: string;
  mealTiming?: string;
  startDate?: string;
  plannedEndDate?: string;
  totalQuantity?: number;
  refillCount?: number;
  prnReason?: string;
  requiresCounselling?: boolean;
  taperingSteps?: TaperingStepPayload[];
}

export interface InsuranceCoverageRowType {
  serviceCategory: string;
  deductible: number | null;
  deductibleAppliesTo: string | null;
  coPayPercent: number | null;
  coPayMin: number | null;
  coPayMax: number | null;
  coPayAppliesTo: string | null;
}

export interface PatientInsuranceCoverageType {
  paymentType: string;
  coverages: InsuranceCoverageRowType[];
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
  cancerSiteListItemId?: string;
  externalFacility?: string;
}

export interface ReferralOutcomePayload {
  dateSeenBySpecialist: string;
}

export interface DentalVisitExtraPayload {
  encounterId?: string;
  fissureSealantApplied?: boolean;
  fluorideApplied?: boolean;
  sdfApplied?: boolean;
  oralHygieneEducationGiven?: boolean;
  lifestyleEducationGiven?: boolean;
  smokingCessationEducationGiven?: boolean;
  comprehensiveDentalPlanProvided?: boolean;
}

export interface TreatmentPayload {
  encounterId?: string;
  listItemId?: string;
  description: string;
  instructions?: string;
  quantity?: number;
  isPackage?: boolean;
  isBillingPending?: boolean;
}

export interface DoctorConfidentialNotePayload {
  contentHtml: string;
}

export interface AddDiagnosisPayload {
  encounterId: string;
  listItemId: string;
  asPrimary?: boolean;
}

export interface FollowUpPayload {
  encounterId?: string;
  followUpDate: string;
  instructions?: string;
}
