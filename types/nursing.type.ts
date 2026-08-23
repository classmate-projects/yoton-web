import { SpecialRemarkType } from "./emr.type";

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

export interface TreatmentType {
  treatmentId: string;
  listItemId: string | null;
  description: string;
  instructions: string | null;
  quantity: number;
  isPackage: boolean;
  isBillingPending: boolean;
  status: string; // Pending, Done
  createdAt: string;
  doneAt: string | null;
  doneByName: string | null;
}

export interface MedicationAdministrationType {
  medicationAdministrationId: string;
  nurseId: string | null;
  nurseName: string | null;
  administeredAt: string;
  doseGiven: string | null;
  route: string | null;
  remarks: string | null;
  witnessName: string | null;
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

export interface NursingChartType {
  patientId: string | null;
  activeEncounterId: string | null;
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
