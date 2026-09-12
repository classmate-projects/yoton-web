export interface StaffFteType {
  userId: string;
  name: string;
  role: string | null;
  userDesignation: string | null;
  departmentName: string | null;
  fteValue: number | null;
}

export interface PatientComplianceFlagType {
  chronicConditionId: string;
  patientId: string | null;
  patientName: string;
  patientOPNumber: string | null;
  conditionName: string;
  isHypertension: boolean;
  isDiabetes: boolean;
  hasNonacuteAdmission: boolean;
  diabetesType: string | null;
  createdAt: string;
}
