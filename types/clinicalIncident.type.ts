export type ClinicalIncidentCategory = "SentinelEvent" | "MedicationError" | "DentalError";

export interface ClinicalIncidentType {
  clinicalIncidentReportId: string;
  category: ClinicalIncidentCategory;
  patientId: string | null;
  patientName: string | null;
  encounterId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  reportedByUserId: string | null;
  reportedByName: string | null;
  eventDateTime: string;
  reportedAt: string;
  description: string | null;
  rootCauseAnalysis: string | null;
  correctiveActions: string | null;
  status: string; // Open, UnderInvestigation, Closed
  closedAt: string | null;

  // SentinelEvent only
  proximateFactors: string | null;
  systemsAndProcesses: string | null;

  // MedicationError only
  locationText: string | null;
  errorStageCode: string | null;
  errorTypeCode: string | null;
  errorTypeOtherText: string | null;
  errorProneAbbreviationCode: string | null;
  medicineId: string | null;
  drugName: string | null;

  // DentalError only
  stageCode: string | null;
  stageOtherText: string | null;
  errorTypeText: string | null;

  // Shared between MedicationError and DentalError
  staffCategoryCode: string | null;
  staffCategoryOtherText: string | null;
  levelOfHarmCode: string | null;
  contributingFactorCode: string | null;
  contributingFactorOtherText: string | null;
}

export interface ClinicalIncidentCreatePayload {
  category: ClinicalIncidentCategory;
  patientId?: string;
  encounterId?: string;
  departmentId?: string;
  eventDateTime: string;
  description?: string;
  rootCauseAnalysis?: string;
  correctiveActions?: string;

  proximateFactors?: string;
  systemsAndProcesses?: string;

  locationText?: string;
  errorStageCode?: string;
  errorTypeCode?: string;
  errorTypeOtherText?: string;
  errorProneAbbreviationCode?: string;
  medicineId?: string;
  drugName?: string;

  stageCode?: string;
  stageOtherText?: string;
  errorTypeText?: string;

  staffCategoryCode?: string;
  staffCategoryOtherText?: string;
  levelOfHarmCode?: string;
  contributingFactorCode?: string;
  contributingFactorOtherText?: string;
}

export interface ClinicalIncidentUpdatePayload {
  rootCauseAnalysis?: string;
  correctiveActions?: string;
  status?: string;
}
