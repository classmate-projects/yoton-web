// Mirrors Yoton-API's ImmunizationDTO.cs - the Pediatric Immunization Schedule.

export type VaccineCategory = "Routine" | "Optional" | "Travel" | "COVID-19" | "Organization-specific";
export type VaccineAgeUnit = "Days" | "Weeks" | "Months" | "Years";

// Stored on the order: Scheduled, Administered, Missed, Cancelled. "Due"/"Overdue" are a
// Scheduled order on/after its date; "Upcoming" is a recommended dose nobody has scheduled yet.
export type ImmunizationStatus = "Scheduled" | "Administered" | "Missed" | "Cancelled" | "Due" | "Overdue" | "Upcoming";

export interface VaccineScheduleDoseType {
  vaccineScheduleDoseId: string | null;
  doseNumber: number;
  label: string | null;
  doseLabel: string; // label, or "Dose N"
  ageValue: number;
  ageUnit: VaccineAgeUnit;
  // Optional end of the age window ("4-6 years") - the dose counts as due, not overdue, until then.
  dueUntilValue: number | null;
  dueUntilUnit: VaccineAgeUnit | null;
  ageLabel: string; // "Birth", "4 months", "4-6 years", ...
}

export interface VaccineType {
  vaccineId: string;
  name: string;
  code: string | null;
  description: string | null;
  category: VaccineCategory;
  defaultRoute: string | null;
  defaultSite: string | null;
  defaultDose: string | null;
  isSystemDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  orderCount: number;
  doses: VaccineScheduleDoseType[];
}

export interface SaveVaccinePayload {
  name: string;
  code?: string | null;
  description?: string | null;
  category: VaccineCategory;
  defaultRoute?: string | null;
  defaultSite?: string | null;
  defaultDose?: string | null;
  isActive: boolean;
  sortOrder?: number;
  doses: {
    doseNumber: number;
    label?: string | null;
    ageValue: number;
    ageUnit: VaccineAgeUnit;
    dueUntilValue?: number | null;
    dueUntilUnit?: VaccineAgeUnit | null;
  }[];
}

export interface ImmunizationOrderEventType {
  immunizationOrderEventId: string;
  action: string;
  details: string | null;
  reason: string | null;
  userName: string | null;
  userRole: string | null;
  createdAt: string;
}

export interface ImmunizationOrderType {
  immunizationOrderId: string;
  patientId: string;
  vaccineId: string;
  vaccineName: string;
  vaccineDescription: string | null;
  doseNumber: number;
  doseLabel: string;
  scheduledDate: string; // yyyy-MM-dd
  remarks: string | null;
  status: "Scheduled" | "Administered" | "Missed" | "Cancelled";
  displayStatus: ImmunizationStatus;
  orderedByDoctorId: string | null;
  orderedByName: string | null;
  createdAt: string;
  updatedAt: string | null;
  administeredAt: string | null;
  administeredByUserId: string | null;
  administeredByName: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  route: string | null;
  injectionSite: string | null;
  adverseReactions: string | null;
  administrationNotes: string | null;
  isExternal: boolean;
  externalFacility: string | null;
  statusReason: string | null;
  statusChangedAt: string | null;
  statusChangedByName: string | null;
  defaultRoute: string | null;
  defaultSite: string | null;
  defaultDose: string | null;
  events: ImmunizationOrderEventType[];
}

export interface RecommendedDoseType {
  vaccineId: string;
  vaccineName: string;
  vaccineDescription: string | null;
  doseNumber: number;
  doseLabel: string;
  ageLabel: string;
  ageDays: number;
  recommendedDate: string;
  dueUntilDate: string | null; // end of the age window, when the dose has one
  status: ImmunizationStatus;
  immunizationOrderId: string | null;
}

export interface ImmunizationPatientType {
  patientId: string;
  name: string;
  opNumber: string | null;
  sex: string | null;
  dateOfBirth: string | null;
  ageText: string | null;
  ageCategory: string | null;
  isPediatric: boolean;
  pediatricMaxAgeYears: number;
}

export interface ImmunizationCountsType {
  completed: number;
  scheduled: number;
  due: number;
  overdue: number;
  missed: number;
  notYetScheduled: number;
}

export interface ImmunizationScheduleType {
  patient: ImmunizationPatientType;
  recommended: RecommendedDoseType[];
  orders: ImmunizationOrderType[];
  counts: ImmunizationCountsType;
  canSchedule: boolean;
  today: string;
}

export interface ScheduleVaccinationPayload {
  vaccineId: string;
  doseNumber: number;
  scheduledDate: string;
  remarks?: string | null;
  encounterId?: string | null;
  visitId?: string | null;
}

export interface UpdateVaccinationOrderPayload {
  vaccineId: string;
  doseNumber: number;
  scheduledDate: string;
  remarks?: string | null;
  reason?: string | null;
}

export interface AdministerVaccinePayload {
  administeredAt: string; // ISO (UTC)
  batchNumber: string;
  expiryDate: string;
  route: string;
  injectionSite: string;
  adverseReactions?: string | null;
  notes?: string | null;
  nurseId?: string;
  password: string;
}

export interface RecordPastDosePayload {
  vaccineId: string;
  doseNumber: number;
  administeredDate: string;
  facility?: string | null;
  batchNumber?: string | null;
  remarks?: string | null;
}

export interface ImmunizationReminderType {
  immunizationOrderId: string;
  patientId: string;
  patientName: string;
  opNumber: string | null;
  vaccineName: string;
  doseLabel: string;
  scheduledDate: string;
  displayStatus: "Overdue" | "Due" | "Scheduled";
  daysFromToday: number;
  orderedByName: string | null;
}

export interface ImmunizationRemindersType {
  windowDays: number;
  overdue: number;
  dueToday: number;
  upcoming: number;
  items: ImmunizationReminderType[];
}
