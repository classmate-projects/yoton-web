import api from "@/lib/axios";
import { ENDPOINTS } from "@/lib/endpoints";
import { PatientSatisfactionCreatePayload } from "@/types/patientSatisfaction.type";

export const PatientSatisfactionService = {
  getAll: async () => {
    const { data } = await api.get(ENDPOINTS.PATIENT_SATISFACTION.GET_ALL());
    return data;
  },
  create: async (payload: PatientSatisfactionCreatePayload) => {
    const { data } = await api.post(ENDPOINTS.PATIENT_SATISFACTION.CREATE(), payload);
    return data;
  },
  update: async (id: string, payload: PatientSatisfactionCreatePayload) => {
    const { data } = await api.put(ENDPOINTS.PATIENT_SATISFACTION.UPDATE(id), payload);
    return data;
  },
  remove: async (id: string) => {
    const { data } = await api.delete(ENDPOINTS.PATIENT_SATISFACTION.REMOVE(id));
    return data;
  },
};
