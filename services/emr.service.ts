import api from "@/lib/axios";
import { ENDPOINTS } from "@/lib/endpoints";
import {
  EncounterUpsertPayload,
  ChronicConditionPayload,
  AllergyPayload,
  MedicationPayload,
  ReferralPayload,
  ReferralOutcomePayload,
  DentalVisitExtraPayload,
  TreatmentPayload,
  DoctorConfidentialNotePayload,
  AddDiagnosisPayload,
  FollowUpPayload,
  ProposeEncounterCorrectionPayload,
} from "@/types/emr.type";

export const EmrService = {
  getPatients: async (doctorId?: string) => {
    const { data } = await api.get(ENDPOINTS.EMR.GET_PATIENTS(doctorId));
    return data;
  },
  getPatientSummary: async (patientId: string, doctorId?: string) => {
    const { data } = await api.get(ENDPOINTS.EMR.GET_PATIENT_SUMMARY(patientId, doctorId));
    return data;
  },
  getInsuranceCoverage: async (patientId: string, doctorId?: string) => {
    const { data } = await api.get(ENDPOINTS.EMR.GET_INSURANCE_COVERAGE(patientId, doctorId));
    return data;
  },
  getDashboardSummary: async (doctorId?: string) => {
    const { data } = await api.get(ENDPOINTS.EMR.GET_DASHBOARD_SUMMARY(doctorId));
    return data;
  },
  getTodaySchedule: async (doctorId?: string) => {
    const { data } = await api.get(ENDPOINTS.EMR.GET_TODAY_SCHEDULE(doctorId));
    return data;
  },
  getActiveCases: async (doctorId?: string) => {
    const { data } = await api.get(ENDPOINTS.EMR.GET_ACTIVE_CASES(doctorId));
    return data;
  },
  upsertEncounter: async (patientId: string, payload: EncounterUpsertPayload, doctorId?: string) => {
    const { data } = await api.post(ENDPOINTS.EMR.UPSERT_ENCOUNTER(patientId, doctorId), payload);
    return data;
  },
  finishEncounter: async (encounterId: string, doctorId?: string) => {
    const { data } = await api.put(ENDPOINTS.EMR.FINISH_ENCOUNTER(encounterId, doctorId));
    return data;
  },
  proposeEncounterCorrection: async (patientId: string, encounterId: string, payload: ProposeEncounterCorrectionPayload) => {
    const { data } = await api.post(ENDPOINTS.EMR.PROPOSE_ENCOUNTER_CORRECTION(patientId, encounterId), payload);
    return data;
  },
  getEncounterCorrections: async (patientId: string, encounterId: string) => {
    const { data } = await api.get(ENDPOINTS.EMR.GET_ENCOUNTER_CORRECTIONS(patientId, encounterId));
    return data;
  },
  getMyPendingCorrections: async () => {
    const { data } = await api.get(ENDPOINTS.EMR.GET_MY_PENDING_CORRECTIONS());
    return data;
  },
  acknowledgeCorrection: async (correctionId: string) => {
    const { data } = await api.post(ENDPOINTS.EMR.ACKNOWLEDGE_CORRECTION(correctionId));
    return data;
  },
  rejectCorrection: async (correctionId: string) => {
    const { data } = await api.post(ENDPOINTS.EMR.REJECT_CORRECTION(correctionId));
    return data;
  },
  addChronicCondition: async (patientId: string, payload: ChronicConditionPayload, doctorId?: string) => {
    const { data } = await api.post(ENDPOINTS.EMR.ADD_CHRONIC_CONDITION(patientId, doctorId), payload);
    return data;
  },
  addAllergy: async (patientId: string, payload: AllergyPayload, doctorId?: string) => {
    const { data } = await api.post(ENDPOINTS.EMR.ADD_ALLERGY(patientId, doctorId), payload);
    return data;
  },
  addMedication: async (patientId: string, payload: MedicationPayload, doctorId?: string) => {
    const { data } = await api.post(ENDPOINTS.EMR.ADD_MEDICATION(patientId, doctorId), payload);
    return data;
  },
  discontinueMedication: async (medicationId: string, doctorId?: string) => {
    const { data } = await api.put(ENDPOINTS.EMR.DISCONTINUE_MEDICATION(medicationId, doctorId));
    return data;
  },
  addReferral: async (patientId: string, payload: ReferralPayload, doctorId?: string) => {
    const { data } = await api.post(ENDPOINTS.EMR.ADD_REFERRAL(patientId, doctorId), payload);
    return data;
  },
  setReferralOutcome: async (referralId: string, payload: ReferralOutcomePayload, doctorId?: string) => {
    const { data } = await api.put(ENDPOINTS.EMR.SET_REFERRAL_OUTCOME(referralId, doctorId), payload);
    return data;
  },
  saveDentalExtras: async (patientId: string, payload: DentalVisitExtraPayload, doctorId?: string) => {
    const { data } = await api.post(ENDPOINTS.EMR.SAVE_DENTAL_EXTRAS(patientId, doctorId), payload);
    return data;
  },
  addTreatment: async (patientId: string, payload: TreatmentPayload, doctorId?: string) => {
    const { data } = await api.post(ENDPOINTS.EMR.ADD_TREATMENT(patientId, doctorId), payload);
    return data;
  },
  getQuickNotes: async (doctorId?: string, patientId?: string) => {
    const { data } = await api.get(ENDPOINTS.EMR.GET_QUICK_NOTES(doctorId, patientId));
    return data;
  },
  addQuickNote: async (patientId: string, notes: string, doctorId?: string) => {
    const { data } = await api.post(ENDPOINTS.EMR.ADD_QUICK_NOTE(patientId, doctorId), { notes });
    return data;
  },
  updateQuickNote: async (consultationNoteId: string, notes: string, doctorId?: string) => {
    const { data } = await api.put(ENDPOINTS.EMR.UPDATE_QUICK_NOTE(consultationNoteId, doctorId), { notes });
    return data;
  },
  removeQuickNote: async (consultationNoteId: string, doctorId?: string) => {
    const { data } = await api.delete(ENDPOINTS.EMR.REMOVE_QUICK_NOTE(consultationNoteId, doctorId));
    return data;
  },
  getDocuments: async (patientId: string) => {
    const { data } = await api.get(ENDPOINTS.EMR.GET_DOCUMENTS(patientId));
    return data;
  },
  markDocumentViewed: async (patientId: string, id: string) => {
    const { data } = await api.post(ENDPOINTS.EMR.MARK_DOCUMENT_VIEWED(patientId, id));
    return data;
  },
  addConfidentialNote: async (patientId: string, payload: DoctorConfidentialNotePayload) => {
    const { data } = await api.post(ENDPOINTS.EMR.ADD_CONFIDENTIAL_NOTE(patientId), payload);
    return data;
  },
  getConfidentialNotes: async (patientId?: string) => {
    const { data } = await api.get(ENDPOINTS.EMR.GET_CONFIDENTIAL_NOTES(patientId));
    return data;
  },
  addDiagnosis: async (patientId: string, payload: AddDiagnosisPayload, doctorId?: string) => {
    const { data } = await api.post(ENDPOINTS.EMR.ADD_DIAGNOSIS(patientId, doctorId), payload);
    return data;
  },
  setPrimaryDiagnosis: async (encounterDiagnosisId: string, doctorId?: string) => {
    const { data } = await api.put(ENDPOINTS.EMR.SET_PRIMARY_DIAGNOSIS(encounterDiagnosisId, doctorId));
    return data;
  },
  removeDiagnosis: async (encounterDiagnosisId: string, doctorId?: string) => {
    const { data } = await api.delete(ENDPOINTS.EMR.REMOVE_DIAGNOSIS(encounterDiagnosisId, doctorId));
    return data;
  },
  addFollowUp: async (patientId: string, payload: FollowUpPayload, doctorId?: string) => {
    const { data } = await api.post(ENDPOINTS.EMR.ADD_FOLLOW_UP(patientId, doctorId), payload);
    return data;
  },
  getFollowUps: async (doctorId?: string) => {
    const { data } = await api.get(ENDPOINTS.EMR.GET_FOLLOW_UPS(doctorId));
    return data;
  },
};
