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
};
