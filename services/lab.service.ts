import api from "@/lib/axios";
import { ENDPOINTS } from "@/lib/endpoints";
import { CreateLabRequestPayload } from "@/types/lab.type";

export const LabService = {
  getAll: async () => {
    const { data } = await api.get(ENDPOINTS.LAB.GET_ALL);
    return data;
  },
  getPending: async () => {
    const { data } = await api.get(ENDPOINTS.LAB.GET_PENDING);
    return data;
  },
  getSummary: async () => {
    const { data } = await api.get(ENDPOINTS.LAB.GET_SUMMARY);
    return data;
  },
  create: async (payload: CreateLabRequestPayload) => {
    const { data } = await api.post(ENDPOINTS.LAB.CREATE, payload);
    return data;
  },
  updateStatus: async (labRequestId: string, status: string) => {
    const { data } = await api.post(ENDPOINTS.LAB.UPDATE_STATUS, {
      labRequestId,
      status,
    });
    return data;
  },
  collectSample: async (labRequestId: string, nurseId?: string) => {
    const { data } = await api.put(ENDPOINTS.LAB.COLLECT_SAMPLE, { labRequestId, nurseId });
    return data;
  },
  uploadResult: async (labRequestId: string, file: File) => {
    const form = new FormData();
    form.append("LabRequestId", labRequestId);
    form.append("File", file);
    const { data } = await api.post(ENDPOINTS.LAB.UPLOAD_RESULT, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
};
