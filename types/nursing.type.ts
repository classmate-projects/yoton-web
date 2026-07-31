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
  notes: string | null;
  recordedAt: string;
  isCritical: boolean;
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
  notes?: string;
  nurseId?: string;
}

export interface InjectionPayload {
  encounterId: string;
  medicineName: string;
  dose: string;
  route: string;
  notes?: string;
  nurseId?: string;
}

export interface DressingPayload {
  encounterId: string;
  woundType: string;
  dressingMaterial: string;
  infectionSigns: boolean;
  notes?: string;
  nurseId?: string;
}

export interface BloodSugarPayload {
  encounterId: string;
  sugarLevel: number;
  type: string;
  notes?: string;
  nurseId?: string;
}

export interface IVFluidsPayload {
  encounterId: string;
  fluidType: string;
  volume: number;
  rate: number;
  notes?: string;
  nurseId?: string;
}
