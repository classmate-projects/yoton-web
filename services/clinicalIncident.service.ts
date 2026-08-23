import api from "@/lib/axios";
import { ENDPOINTS } from "@/lib/endpoints";
import { ClinicalIncidentCreatePayload, ClinicalIncidentUpdatePayload } from "@/types/clinicalIncident.type";

export const ClinicalIncidentService = {
  getAll: async (category?: string, status?: string) => {
    const { data } = await api.get(ENDPOINTS.CLINICAL_INCIDENT.GET_ALL(category, status));
    return data;
  },
  create: async (payload: ClinicalIncidentCreatePayload) => {
    const { data } = await api.post(ENDPOINTS.CLINICAL_INCIDENT.CREATE(), payload);
    return data;
  },
  update: async (id: string, payload: ClinicalIncidentUpdatePayload) => {
    const { data } = await api.put(ENDPOINTS.CLINICAL_INCIDENT.UPDATE(id), payload);
    return data;
  },
};
