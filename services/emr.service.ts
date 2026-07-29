import api from "@/lib/axios";
import { ENDPOINTS } from "@/lib/endpoints";
import {
  EncounterUpsertPayload,
  ChronicConditionPayload,
  AllergyPayload,
  MedicationPayload,
  ReferralPayload,
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
  getQuickNotes: async (doctorId?: string, patientId?: string) => {
    const { data } = await api.get(ENDPOINTS.EMR.GET_QUICK_NOTES(doctorId, patientId));
    return data;
  },
  addQuickNote: async (patientId: string, notes: string, doctorId?: string) => {
    const { data } = await api.post(ENDPOINTS.EMR.ADD_QUICK_NOTE(patientId, doctorId), { notes });
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
};
