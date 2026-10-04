import api from "@/lib/axios";
import { ENDPOINTS } from "@/lib/endpoints";
import { compressImageForUpload } from "@/lib/resizeImage";
import {
  EncounterUpsertPayload,
  ChronicConditionPayload,
  AllergyPayload,
  MedicationPayload,
  ReferralPayload,
  DentalVisitExtraPayload,
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
  updatePatientAlert: async (patientId: string, alert: string | null, doctorId?: string) => {
    const { data } = await api.patch(ENDPOINTS.EMR.UPDATE_PATIENT_ALERT(patientId, doctorId), { alert });
    return data;
  },
  updateMedicalHistory: async (
    patientId: string,
    payload: { pastMedicalHistory: string | null; pastSurgicalHistory: string | null; pastTreatmentHistory: string | null },
    doctorId?: string
  ) => {
    const { data } = await api.patch(ENDPOINTS.EMR.UPDATE_MEDICAL_HISTORY(patientId, doctorId), payload);
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
  getTodaySchedule: async (doctorId?: string, date?: string) => {
    const { data } = await api.get(ENDPOINTS.EMR.GET_TODAY_SCHEDULE(doctorId, date));
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
  requestEncounterUnlock: async (patientId: string, encounterId: string, reason?: string) => {
    const { data } = await api.post(ENDPOINTS.EMR.REQUEST_ENCOUNTER_UNLOCK(patientId, encounterId), { reason });
    return data;
  },
  getMyUnlockRequestStatus: async (patientId: string, encounterId: string) => {
    const { data } = await api.get(ENDPOINTS.EMR.GET_MY_UNLOCK_REQUEST_STATUS(patientId, encounterId));
    return data;
  },
  getEncounterUnlockRequests: async () => {
    const { data } = await api.get(ENDPOINTS.EMR.GET_ENCOUNTER_UNLOCK_REQUESTS());
    return data;
  },
  approveEncounterUnlock: async (requestId: string) => {
    const { data } = await api.post(ENDPOINTS.EMR.APPROVE_ENCOUNTER_UNLOCK(requestId));
    return data;
  },
  denyEncounterUnlock: async (requestId: string) => {
    const { data } = await api.post(ENDPOINTS.EMR.DENY_ENCOUNTER_UNLOCK(requestId));
    return data;
  },
  addChronicCondition: async (patientId: string, payload: ChronicConditionPayload, doctorId?: string) => {
    const { data } = await api.post(ENDPOINTS.EMR.ADD_CHRONIC_CONDITION(patientId, doctorId), payload);
    return data;
  },
  updateChronicCondition: async (chronicConditionId: string, payload: ChronicConditionPayload, doctorId?: string) => {
    const { data } = await api.put(ENDPOINTS.EMR.UPDATE_CHRONIC_CONDITION(chronicConditionId, doctorId), payload);
    return data;
  },
  removeChronicCondition: async (chronicConditionId: string, doctorId?: string) => {
    const { data } = await api.delete(ENDPOINTS.EMR.REMOVE_CHRONIC_CONDITION(chronicConditionId, doctorId));
    return data;
  },
  addAllergy: async (patientId: string, payload: AllergyPayload, doctorId?: string) => {
    const { data } = await api.post(ENDPOINTS.EMR.ADD_ALLERGY(patientId, doctorId), payload);
    return data;
  },
  updateAllergy: async (patientAllergyId: string, payload: AllergyPayload, doctorId?: string) => {
    const { data } = await api.put(ENDPOINTS.EMR.UPDATE_ALLERGY(patientAllergyId, doctorId), payload);
    return data;
  },
  removeAllergy: async (patientAllergyId: string, doctorId?: string) => {
    const { data } = await api.delete(ENDPOINTS.EMR.REMOVE_ALLERGY(patientAllergyId, doctorId));
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
  updateMedication: async (medicationId: string, payload: MedicationPayload, doctorId?: string) => {
    const { data } = await api.put(ENDPOINTS.EMR.UPDATE_MEDICATION(medicationId, doctorId), payload);
    return data;
  },
  removeMedication: async (medicationId: string, doctorId?: string) => {
    const { data } = await api.delete(ENDPOINTS.EMR.REMOVE_MEDICATION(medicationId, doctorId));
    return data;
  },
  addReferral: async (patientId: string, payload: ReferralPayload, doctorId?: string) => {
    const { data } = await api.post(ENDPOINTS.EMR.ADD_REFERRAL(patientId, doctorId), payload);
    return data;
  },
  updateReferral: async (referralId: string, payload: ReferralPayload, doctorId?: string) => {
    const { data } = await api.put(ENDPOINTS.EMR.UPDATE_REFERRAL(referralId, doctorId), payload);
    return data;
  },
  removeReferral: async (referralId: string, doctorId?: string) => {
    const { data } = await api.delete(ENDPOINTS.EMR.REMOVE_REFERRAL(referralId, doctorId));
    return data;
  },
  saveDentalExtras: async (patientId: string, payload: DentalVisitExtraPayload, doctorId?: string) => {
    const { data } = await api.post(ENDPOINTS.EMR.SAVE_DENTAL_EXTRAS(patientId, doctorId), payload);
    return data;
  },
  // addTreatment moved to services/treatment.service.ts::TreatmentService.create (treatments
  // now have a real Update/Start/Revert workflow, see Controllers/TreatmentController.cs).
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
  uploadDocument: async (patientId: string, payload: { documentType: string; file: File; visitId?: string }) => {
    const compressedFile = await compressImageForUpload(payload.file);
    const form = new FormData();
    form.append("DocumentType", payload.documentType);
    if (payload.visitId) form.append("VisitId", payload.visitId);
    form.append("File", compressedFile);
    const { data } = await api.post(ENDPOINTS.RECEPTION.UPLOAD_DOCUMENT(patientId), form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
  addConfidentialNote: async (patientId: string, payload: DoctorConfidentialNotePayload) => {
    const { data } = await api.post(ENDPOINTS.EMR.ADD_CONFIDENTIAL_NOTE(patientId), payload);
    return data;
  },
  updateConfidentialNote: async (doctorConfidentialNoteId: string, payload: DoctorConfidentialNotePayload) => {
    const { data } = await api.put(ENDPOINTS.EMR.UPDATE_CONFIDENTIAL_NOTE(doctorConfidentialNoteId), payload);
    return data;
  },
  removeConfidentialNote: async (doctorConfidentialNoteId: string) => {
    const { data } = await api.delete(ENDPOINTS.EMR.REMOVE_CONFIDENTIAL_NOTE(doctorConfidentialNoteId));
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
  updateFollowUp: async (followUpId: string, payload: FollowUpPayload, doctorId?: string) => {
    const { data } = await api.put(ENDPOINTS.EMR.UPDATE_FOLLOW_UP(followUpId, doctorId), payload);
    return data;
  },
  removeFollowUp: async (followUpId: string, doctorId?: string) => {
    const { data } = await api.delete(ENDPOINTS.EMR.REMOVE_FOLLOW_UP(followUpId, doctorId));
    return data;
  },
  getFollowUps: async (doctorId?: string) => {
    const { data } = await api.get(ENDPOINTS.EMR.GET_FOLLOW_UPS(doctorId));
    return data;
  },
};
