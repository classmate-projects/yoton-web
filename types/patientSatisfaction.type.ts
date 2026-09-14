export interface PatientSatisfactionType {
  patientSatisfactionResponseId: string;
  patientId: string | null;
  patientName: string | null;
  specialty: string | null;
  collectedDate: string;
  genderCode: string | null;
  ageBandCode: string | null;
  nationalityCode: string | null;
  q1Score: number | null;
  q2Score: number | null;
  q3Score: number | null;
  q4Score: number | null;
  q5Score: number | null;
  q6Score: number | null;
  q7Score: number | null;
  q8Score: number | null;
  q9Score: number | null;
  q10Score: number | null;
  q11Score: number | null;
  whatWorkedWell: string | null;
  whatNeededImprovement: string | null;
  createdAt: string;
}

export interface PatientSatisfactionCreatePayload {
  patientId?: string;
  specialty?: string;
  collectedDate: string;
  genderCode?: string;
  ageBandCode?: string;
  nationalityCode?: string;
  q1Score?: number;
  q2Score?: number;
  q3Score?: number;
  q4Score?: number;
  q5Score?: number;
  q6Score?: number;
  q7Score?: number;
  q8Score?: number;
  q9Score?: number;
  q10Score?: number;
  q11Score?: number;
  whatWorkedWell?: string;
  whatNeededImprovement?: string;
}
