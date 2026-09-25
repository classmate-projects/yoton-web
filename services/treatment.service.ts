import api from "@/lib/axios";
import { ENDPOINTS } from "@/lib/endpoints";
import { CreateTreatmentPayload } from "@/types/treatment.type";

// Mirrors LabService/RadiologyService's shape - see Controllers/TreatmentController.cs.
// Replaces the old EmrService.addTreatment/NursingService.markTreatmentDone now that
// treatments have a real Update/Start/Revert workflow alongside Lab/Radiology.
export const TreatmentService = {
  create: async (payload: CreateTreatmentPayload, doctorId?: string) => {
    const { data } = await api.post(ENDPOINTS.TREATMENTS.CREATE(doctorId), payload);
    return data;
  },
  update: async (id: string, payload: CreateTreatmentPayload) => {
    const { data } = await api.put(ENDPOINTS.TREATMENTS.UPDATE(id), payload);
    return data;
  },
  remove: async (id: string) => {
    const { data } = await api.delete(ENDPOINTS.TREATMENTS.REMOVE(id));
    return data;
  },
  start: async (id: string, nurseId?: string) => {
    const { data } = await api.put(ENDPOINTS.TREATMENTS.START(id), { nurseId });
    return data;
  },
  revert: async (id: string) => {
    const { data } = await api.put(ENDPOINTS.TREATMENTS.REVERT(id));
    return data;
  },
  markDone: async (id: string, nurseId?: string) => {
    const { data } = await api.put(ENDPOINTS.TREATMENTS.MARK_DONE(id), { nurseId });
    return data;
  },
};
