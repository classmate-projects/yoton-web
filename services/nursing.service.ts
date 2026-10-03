import api from "@/lib/axios";
import { ENDPOINTS } from "@/lib/endpoints";
import {
  VitalsPayload,
  InjectionPayload,
  DressingPayload,
  BloodSugarPayload,
  IVFluidsPayload,
  EnsureEncounterPayload,
  NurseNotePayload,
  ExaminationNotePayload,
  AdministerMedicationPayload,
  NurseShiftInput,
  TriagePayload,
} from "@/types/nursing.type";
import { SpecialRemarkPayload } from "@/types/emr.type";

export const NursingService = {
  getDashboardSummary: async () => {
    const { data } = await api.get(ENDPOINTS.NURSING.GET_DASHBOARD_SUMMARY);
    return data;
  },
  getTasks: async (status?: string) => {
    const { data } = await api.get(ENDPOINTS.NURSING.GET_TASKS(status));
    return data;
  },
  updateTaskStatus: async (taskId: string, status: string, notes?: string) => {
    const { data } = await api.post(ENDPOINTS.NURSING.UPDATE_TASK_STATUS, { taskId, status, notes });
    return data;
  },
  getPatientChart: async (patientId: string) => {
    const { data } = await api.get(ENDPOINTS.NURSING.GET_PATIENT_CHART(patientId));
    return data;
  },
  getVitalsHistory: async (patientId: string) => {
    const { data } = await api.get(ENDPOINTS.NURSING.GET_VITALS_HISTORY(patientId));
    return data;
  },
  ensureActiveEncounter: async (patientId: string, payload?: EnsureEncounterPayload) => {
    const { data } = await api.post(ENDPOINTS.NURSING.ENSURE_ENCOUNTER(patientId), payload ?? {});
    return data;
  },
  endEncounter: async (encounterId: string) => {
    const { data } = await api.put(ENDPOINTS.NURSING.END_ENCOUNTER(encounterId));
    return data;
  },
  addSpecialRemark: async (patientId: string, payload: SpecialRemarkPayload) => {
    const { data } = await api.post(ENDPOINTS.NURSING.ADD_SPECIAL_REMARK(patientId), payload);
    return data;
  },
  updateSpecialRemark: async (specialRemarkId: string, payload: SpecialRemarkPayload) => {
    const { data } = await api.put(ENDPOINTS.NURSING.UPDATE_SPECIAL_REMARK(specialRemarkId), payload);
    return data;
  },
  removeSpecialRemark: async (specialRemarkId: string) => {
    const { data } = await api.delete(ENDPOINTS.NURSING.REMOVE_SPECIAL_REMARK(specialRemarkId));
    return data;
  },
  saveVitals: async (payload: VitalsPayload) => {
    const { data } = await api.post(ENDPOINTS.NURSING.SAVE_VITALS, payload);
    return data;
  },
  updateVitals: async (vitalsRecordId: string, payload: VitalsPayload) => {
    const { data } = await api.put(ENDPOINTS.NURSING.UPDATE_VITALS(vitalsRecordId), payload);
    return data;
  },
  removeVitals: async (vitalsRecordId: string, nurseId?: string, password?: string) => {
    const { data } = await api.delete(ENDPOINTS.NURSING.REMOVE_VITALS(vitalsRecordId, nurseId, password));
    return data;
  },
  saveInjection: async (payload: InjectionPayload) => {
    const { data } = await api.post(ENDPOINTS.NURSING.SAVE_INJECTION, payload);
    return data;
  },
  updateInjection: async (injectionRecordId: string, payload: InjectionPayload) => {
    const { data } = await api.put(ENDPOINTS.NURSING.UPDATE_INJECTION(injectionRecordId), payload);
    return data;
  },
  removeInjection: async (injectionRecordId: string, nurseId?: string, password?: string) => {
    const { data } = await api.delete(ENDPOINTS.NURSING.REMOVE_INJECTION(injectionRecordId, nurseId, password));
    return data;
  },
  saveDressing: async (payload: DressingPayload) => {
    const { data } = await api.post(ENDPOINTS.NURSING.SAVE_DRESSING, payload);
    return data;
  },
  updateDressing: async (dressingTaskId: string, payload: DressingPayload) => {
    const { data } = await api.put(ENDPOINTS.NURSING.UPDATE_DRESSING(dressingTaskId), payload);
    return data;
  },
  removeDressing: async (dressingTaskId: string) => {
    const { data } = await api.delete(ENDPOINTS.NURSING.REMOVE_DRESSING(dressingTaskId));
    return data;
  },
  saveBloodSugar: async (payload: BloodSugarPayload) => {
    const { data } = await api.post(ENDPOINTS.NURSING.SAVE_BLOOD_SUGAR, payload);
    return data;
  },
  updateBloodSugar: async (bloodSugarTaskId: string, payload: BloodSugarPayload) => {
    const { data } = await api.put(ENDPOINTS.NURSING.UPDATE_BLOOD_SUGAR(bloodSugarTaskId), payload);
    return data;
  },
  removeBloodSugar: async (bloodSugarTaskId: string) => {
    const { data } = await api.delete(ENDPOINTS.NURSING.REMOVE_BLOOD_SUGAR(bloodSugarTaskId));
    return data;
  },
  saveIVFluids: async (payload: IVFluidsPayload) => {
    const { data } = await api.post(ENDPOINTS.NURSING.SAVE_IV_FLUIDS, payload);
    return data;
  },
  updateIVFluids: async (ivFluidsTaskId: string, payload: IVFluidsPayload) => {
    const { data } = await api.put(ENDPOINTS.NURSING.UPDATE_IV_FLUIDS(ivFluidsTaskId), payload);
    return data;
  },
  removeIVFluids: async (ivFluidsTaskId: string) => {
    const { data } = await api.delete(ENDPOINTS.NURSING.REMOVE_IV_FLUIDS(ivFluidsTaskId));
    return data;
  },
  addNote: async (patientId: string, payload: NurseNotePayload) => {
    const { data } = await api.post(ENDPOINTS.NURSING.ADD_NOTE(patientId), payload);
    return data;
  },
  updateNote: async (nurseNoteId: string, payload: NurseNotePayload) => {
    const { data } = await api.put(ENDPOINTS.NURSING.UPDATE_NOTE(nurseNoteId), payload);
    return data;
  },
  removeNote: async (nurseNoteId: string) => {
    const { data } = await api.delete(ENDPOINTS.NURSING.REMOVE_NOTE(nurseNoteId));
    return data;
  },
  getNotes: async (patientId: string) => {
    const { data } = await api.get(ENDPOINTS.NURSING.GET_NOTES(patientId));
    return data;
  },
  addConfidentialNote: async (patientId: string, payload: NurseNotePayload) => {
    const { data } = await api.post(ENDPOINTS.NURSING.ADD_CONFIDENTIAL_NOTE(patientId), payload);
    return data;
  },
  updateConfidentialNote: async (confidentialNoteId: string, payload: NurseNotePayload) => {
    const { data } = await api.put(ENDPOINTS.NURSING.UPDATE_CONFIDENTIAL_NOTE(confidentialNoteId), payload);
    return data;
  },
  removeConfidentialNote: async (confidentialNoteId: string) => {
    const { data } = await api.delete(ENDPOINTS.NURSING.REMOVE_CONFIDENTIAL_NOTE(confidentialNoteId));
    return data;
  },
  getConfidentialNotes: async (patientId?: string) => {
    const { data } = await api.get(ENDPOINTS.NURSING.GET_CONFIDENTIAL_NOTES(patientId));
    return data;
  },
  addExaminationNote: async (patientId: string, payload: ExaminationNotePayload) => {
    const { data } = await api.post(ENDPOINTS.NURSING.ADD_EXAMINATION_NOTE(patientId), payload);
    return data;
  },
  // markTreatmentDone moved to services/treatment.service.ts::TreatmentService.markDone
  // (treatments now have a real Update/Start/Revert workflow, see Controllers/TreatmentController.cs).
  administerMedication: async (medicationId: string, payload: AdministerMedicationPayload) => {
    const { data } = await api.post(ENDPOINTS.NURSING.ADMINISTER_MEDICATION(medicationId), payload);
    return data;
  },
  getWorkQueue: async () => {
    const { data } = await api.get(ENDPOINTS.NURSING.GET_WORK_QUEUE);
    return data;
  },
  getUntouchedPatients: async () => {
    const { data } = await api.get(ENDPOINTS.NURSING.GET_UNTOUCHED_PATIENTS);
    return data;
  },
  saveTriage: async (patientId: string, payload: TriagePayload) => {
    const { data } = await api.post(ENDPOINTS.NURSING.SAVE_TRIAGE(patientId), payload);
    return data;
  },
  getNurseShifts: async (nurseId: string) => {
    const { data } = await api.get(ENDPOINTS.NURSING.GET_NURSE_SHIFTS(nurseId));
    return data;
  },
  setNurseShifts: async (nurseId: string, shifts: NurseShiftInput[]) => {
    const { data } = await api.put(ENDPOINTS.NURSING.SET_NURSE_SHIFTS(nurseId), { shifts });
    return data;
  },
  getOnDutyNow: async () => {
    const { data } = await api.get(ENDPOINTS.NURSING.GET_ON_DUTY_NOW);
    return data;
  },
};
