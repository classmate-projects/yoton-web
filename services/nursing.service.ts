import api from "@/lib/axios";
import { ENDPOINTS } from "@/lib/endpoints";
import {
  VitalsPayload,
  InjectionPayload,
  DressingPayload,
  BloodSugarPayload,
  IVFluidsPayload,
  EnsureEncounterPayload,
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
  saveVitals: async (payload: VitalsPayload) => {
    const { data } = await api.post(ENDPOINTS.NURSING.SAVE_VITALS, payload);
    return data;
  },
  saveInjection: async (payload: InjectionPayload) => {
    const { data } = await api.post(ENDPOINTS.NURSING.SAVE_INJECTION, payload);
    return data;
  },
  saveDressing: async (payload: DressingPayload) => {
    const { data } = await api.post(ENDPOINTS.NURSING.SAVE_DRESSING, payload);
    return data;
  },
  saveBloodSugar: async (payload: BloodSugarPayload) => {
    const { data } = await api.post(ENDPOINTS.NURSING.SAVE_BLOOD_SUGAR, payload);
    return data;
  },
  saveIVFluids: async (payload: IVFluidsPayload) => {
    const { data } = await api.post(ENDPOINTS.NURSING.SAVE_IV_FLUIDS, payload);
    return data;
  },
};
