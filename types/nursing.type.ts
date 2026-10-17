import { SpecialRemarkType } from "./emr.type";
import type { TreatmentType } from "./treatment.type";

export interface NurseDashboardSummaryType {
  patientsUnderCare: number;
  pendingTasks: number;
  criticalAlerts: number;
  completedToday: number;
}

export interface NursingTaskType {
  nursingTaskId: string;
  patientId: string | null;
  patientName: string | null;
  encounterId: string | null;
  nurseId: string | null;
  nurseName: string | null;
  taskType: string | null;
  status: string | null;
  notes: string | null;
  assignedAt: string;
  completedAt: string | null;
}

export type VitalsVitalField =
  | "Systolic"
  | "Diastolic"
  | "HeartRate"
  | "Temperature"
  | "RespiratoryRate"
  | "OxygenSaturation"
  | "HeightCm"
  | "WeightKg";

export interface VitalsRefusalType {
  vitalField: string;
  reason: string;
  refusedAt: string;
  nurseName: string | null;
}

export interface VitalsType {
  vitalsRecordId: string;
  encounterId: string | null;
  nurseId: string | null;
  nurseName: string | null;
  systolic: number;
  diastolic: number;
  heartRate: number;
  temperature: number;
  respiratoryRate: number;
  oxygenSaturation: number;
  heightCm: number;
  weightKg: number;
  bmi: number;
  consciousnessLevel: string | null; // Alert, Voice, Pain, Unresponsive
  supplementalOxygen: boolean;
  bmiExclusionReason: string | null; // Pregnant, PalliativeCare, MedicalReason
  ewsScore: number;
  ewsBand: "Low" | "Medium" | "High";
  notes: string | null;
  recordedAt: string;
  isCritical: boolean;
  correctedFromId: string | null;
  correctedFrom: VitalsType | null;
  refusals: VitalsRefusalType[];
}

// One normalized reading from GET .../vitals-history - merges VitalsRecord's own
// accumulating history with Triage's single per-encounter reading (see that endpoint's own
// comment on NursingController for why the two needed combining).
export interface VitalsHistoryEntryType {
  source: "Triage" | "Nursing";
  recordedAt: string;
  recordedByName: string | null;
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  temperature: number | null;
  heartRate: number | null;
  systolic: number | null;
  diastolic: number | null;
  respiratory: number | null;
  oxygenSaturation: number | null;
  bloodSugar: number | null;
}

export interface NurseNoteType {
  nurseNoteId: string;
  nurseId: string | null;
  nurseName: string | null;
  contentHtml: string;
  createdAt: string;
}

export interface ConfidentialNoteType {
  confidentialNoteId: string;
  patientId: string | null;
  patientName: string | null;
  contentHtml: string;
  createdAt: string;
}

export interface ExaminationNoteType {
  examinationNoteId: string;
  nurseId: string | null;
  nurseName: string | null;
  generalAppearance: string | null;
  painLevel: number;
  mobility: string | null;
  clinicalChecks: string | null;
  createdAt: string;
}

// Moved to types/treatment.type.ts alongside the rest of Treatment ordering (see
// services/treatment.service.ts) - re-exported here so nothing importing it from this file
// needs to change (it's also imported at the top of this file for local use below).
export type { TreatmentType } from "./treatment.type";

export interface MedicationAdministrationType {
  medicationAdministrationId: string;
  nurseId: string | null;
  nurseName: string | null;
  administeredAt: string;
  doseGiven: string | null;
  route: string | null;
  remarks: string | null;
  witnessName: string | null;
  // A cancelled entry stays visible in the log but no longer locks the medication for the doctor.
  isCancelled: boolean;
  cancelledAt: string | null;
  cancelledByName: string | null;
  cancellationReason: string | null;
}

export interface InjectionType {
  injectionRecordId: string;
  encounterId: string | null;
  nurseId: string | null;
  nurseName: string | null;
  medicineName: string;
  dose: string;
  route: string;
  notes: string | null;
  givenAt: string;
  correctedFromId: string | null;
  correctedFrom: InjectionType | null;
}

export interface DressingType {
  dressingTaskId: string;
  nursingTaskId: string | null;
  woundType: string | null;
  dressingMaterial: string | null;
  infectionSigns: boolean;
  notes: string | null;
  createdAt: string;
}

export interface BloodSugarType {
  bloodSugarTaskId: string;
  nursingTaskId: string | null;
  sugarLevel: number;
  type: string | null;
  notes: string | null;
  createdAt: string;
}

export interface IVFluidsType {
  ivFluidsTaskId: string;
  nursingTaskId: string | null;
  fluidType: string | null;
  volume: number;
  rate: number;
  notes: string | null;
  createdAt: string;
}

export interface VitalRefusalType {
  triageVitalRefusalId: string;
  vitalField: string;
  reason: string;
  refusedAt: string;
  nurseName: string | null;
}

// One field key per refusable "Vital Signs in Triage" input - shared between the form's
// per-row refusal toggle and TriagePayload.refusals[].vitalField / TriageType's own fields.
export type TriageVitalField =
  | "Height"
  | "Weight"
  | "Temperature"
  | "HeartRate"
  | "BPSystolic"
  | "BPDiastolic"
  | "BPMean"
  | "Chest"
  | "Waist"
  | "Respiratory"
  | "OxygenSaturation"
  | "BloodSugar"
  | "Hip"
  | "Edd"
  | "Para"
  | "Gravida"
  | "Lmp";

export interface TriageType {
  triageId: string;
  patientId: string | null;
  visitId: string | null;
  encounterId: string | null;
  nurseId: string | null;
  nurseName: string | null;

  chiefComplaint: string | null;
  priorityLevel: number | null; // 1 (Resuscitation) .. 5 (Non Urgent)

  burnOrTrauma: string | null; // Yes, No, Unknown
  burnOrTraumaDetail: string | null;
  cardiacRespiratoryDigestive: string | null;
  cardiacRespiratoryDigestiveDetail: string | null;
  otherEmergencySymptoms: string | null;
  otherEmergencySymptomsDetail: string | null;

  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  temperature: number | null;
  tempSite: string | null;
  heartRate: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  bpMean: number | null;
  chest: number | null;
  waist: number | null;
  respiratory: number | null;
  oxygenSaturation: number | null;
  bloodSugar: number | null;
  hip: number | null;

  edd: string | null;
  para: number | null;
  gravida: number | null;
  lmp: string | null;

  patientRefused: boolean;
  actionDateTime: string;
  createdAt: string;

  refusals: VitalRefusalType[];
}

export interface TriagePayload {
  encounterId: string;
  visitId?: string;
  chiefComplaint?: string;
  priorityLevel?: number;

  burnOrTrauma?: string;
  burnOrTraumaDetail?: string;
  cardiacRespiratoryDigestive?: string;
  cardiacRespiratoryDigestiveDetail?: string;
  otherEmergencySymptoms?: string;
  otherEmergencySymptomsDetail?: string;

  heightCm?: number;
  weightKg?: number;
  temperature?: number;
  tempSite?: string;
  heartRate?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  bpMean?: number;
  chest?: number;
  waist?: number;
  respiratory?: number;
  oxygenSaturation?: number;
  bloodSugar?: number;
  hip?: number;

  edd?: string;
  para?: number;
  gravida?: number;
  lmp?: string;

  patientRefused: boolean;
  actionDateTime?: string;

  // One entry per vital toggled "refused" - every entry must carry a non-empty reason
  // (enforced both client-side and by NursingController.SaveTriage).
  refusals: { vitalField: TriageVitalField; reason: string }[];

  nurseId?: string;
  password?: string;
}

export interface UntouchedPatientType {
  visitId: string;
  patientId: string | null;
  patientName: string | null;
  age: number | null;
  sex: string | null;
  visitType: string;
  checkedInAt: string;
}

export interface NursingChartType {
  patientId: string | null;
  activeEncounterId: string | null;
  triage: TriageType | null;
  vitals: VitalsType[];
  injections: InjectionType[];
  dressings: DressingType[];
  bloodSugarChecks: BloodSugarType[];
  ivFluids: IVFluidsType[];
  tasks: NursingTaskType[];
  specialRemarks: SpecialRemarkType[];
  nurseNotes: NurseNoteType[];
  examinationNotes: ExaminationNoteType[];
  treatments: TreatmentType[];
}

export interface PatientEncounterType {
  patientEncounterId: string;
  patientId: string | null;
  nurseId: string | null;
  visitId: string | null;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
}

export interface EnsureEncounterPayload {
  visitId?: string;
  notes?: string;
  // Ignored server-side for a real nurse (resolved from their own JWT); admin callers
  // must supply this explicitly or every write 400s with "NurseId is required".
  nurseId?: string;
}

export interface VitalsPayload {
  encounterId: string;
  systolic: number;
  diastolic: number;
  heartRate: number;
  temperature: number;
  respiratoryRate: number;
  oxygenSaturation: number;
  heightCm: number;
  weightKg: number;
  consciousnessLevel?: string;
  supplementalOxygen?: boolean;
  bmiExclusionReason?: string;
  notes?: string;
  refusals?: { vitalField: string; reason: string }[];
  nurseId?: string;
  // Required only if the encounter has already been closed (sent to the doctor) - the API
  // returns 423 with requiresPassword:true when this is missing, so the caller can prompt.
  password?: string;
}

export interface NurseNotePayload {
  encounterId?: string;
  contentHtml: string;
  isConfidential: boolean;
  nurseId?: string;
}

export interface ExaminationNotePayload {
  encounterId?: string;
  generalAppearance?: string;
  painLevel: number;
  mobility?: string;
  clinicalChecks?: string;
  nurseId?: string;
}

export interface AdministerMedicationPayload {
  doseGiven?: string;
  route?: string;
  remarks?: string;
  nurseId?: string;
  nursePassword?: string;
  witnessUserId?: string;
  witnessPassword?: string;
}

export interface InjectionPayload {
  encounterId: string;
  medicineName: string;
  dose: string;
  route: string;
  notes?: string;
  nurseId?: string;
  password?: string;
}

export interface DressingPayload {
  encounterId: string;
  woundType: string;
  dressingMaterial: string;
  infectionSigns: boolean;
  notes?: string;
  nurseId?: string;
  password?: string;
}

export interface BloodSugarPayload {
  encounterId: string;
  sugarLevel: number;
  type: string;
  notes?: string;
  nurseId?: string;
  password?: string;
}

export interface IVFluidsPayload {
  encounterId: string;
  fluidType: string;
  volume: number;
  rate: number;
  notes?: string;
  nurseId?: string;
  password?: string;
}

export interface WorkQueueItemType {
  itemType: "Task" | "Treatment" | "LabSample" | "RadiologySample" | "Medication";
  sourceId: string;
  patientId: string | null;
  patientName: string | null;
  description: string;
  priority: string | null;
  createdAt: string;
}

export interface NurseShiftType {
  nurseShiftId: string;
  day: number; // 0=Sunday .. 6=Saturday, matches .NET DayOfWeek
  startTime: string; // "HH:MM:SS"
  endTime: string;
  isActive: boolean;
}

export interface NurseShiftInput {
  day: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface NurseOnDutyType {
  nurseId: string | null;
  nurseName: string | null;
}
