export interface HandHygieneObservationInput {
  professionalCode?: string;
  indicationCode?: string;
  actionCode?: string;
}

export interface HandHygieneObservationType {
  handHygieneObservationId: string;
  professionalCode: string | null;
  indicationCode: string | null;
  actionCode: string | null;
  observedAt: string;
}

export interface HandHygieneSessionCreatePayload {
  departmentId?: string;
  ward?: string;
  observationDate: string;
  startTime?: string;
  endTime?: string;
  observations: HandHygieneObservationInput[];
}

export interface HandHygieneSessionType {
  handHygieneAuditSessionId: string;
  auditorUserId: string | null;
  auditorName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  ward: string | null;
  observationDate: string;
  startTime: string | null;
  endTime: string | null;
  observationCount: number;
  observations: HandHygieneObservationType[];
  createdAt: string;
}
