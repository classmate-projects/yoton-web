import api from "@/lib/axios";
import { ENDPOINTS } from "@/lib/endpoints";
import { CreateRadiologyRequestPayload } from "@/types/radiology.type";
import { compressImageForUpload } from "@/lib/resizeImage";

export const RadiologyService = {
  getAll: async (date?: string) => {
    const { data } = await api.get(ENDPOINTS.RADIOLOGY.GET_ALL(date));
    return data;
  },
  getPending: async (date?: string) => {
    const { data } = await api.get(ENDPOINTS.RADIOLOGY.GET_PENDING(date));
    return data;
  },
  getSummary: async () => {
    const { data } = await api.get(ENDPOINTS.RADIOLOGY.GET_SUMMARY);
    return data;
  },
  create: async (payload: CreateRadiologyRequestPayload) => {
    const { data } = await api.post(ENDPOINTS.RADIOLOGY.CREATE, payload);
    return data;
  },
  update: async (id: string, payload: CreateRadiologyRequestPayload) => {
    const { data } = await api.put(ENDPOINTS.RADIOLOGY.UPDATE(id), payload);
    return data;
  },
  remove: async (id: string) => {
    const { data } = await api.delete(ENDPOINTS.RADIOLOGY.REMOVE(id));
    return data;
  },
  updateStatus: async (radiologyRequestId: string, status: string, scheduledDate?: string) => {
    const { data } = await api.post(ENDPOINTS.RADIOLOGY.UPDATE_STATUS, {
      radiologyRequestId,
      status,
      scheduledDate,
    });
    return data;
  },
  uploadResult: async (radiologyRequestId: string, file: File) => {
    const compressed = await compressImageForUpload(file);
    const form = new FormData();
    form.append("RadiologyRequestId", radiologyRequestId);
    form.append("File", compressed);
    const { data } = await api.post(ENDPOINTS.RADIOLOGY.UPLOAD_RESULT, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
  uploadImages: async (radiologyRequestId: string, files: File[]) => {
    const compressed = await Promise.all(files.map((f) => compressImageForUpload(f)));
    const form = new FormData();
    form.append("RadiologyRequestId", radiologyRequestId);
    compressed.forEach((f) => form.append("Files", f));
    const { data } = await api.post(ENDPOINTS.RADIOLOGY.UPLOAD_IMAGES, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
  // Undoes Scheduled (or any later status) back to Requested, handing editing control back
  // to the doctor - see OrderLockHelper on the backend.
  revert: async (id: string) => {
    const { data } = await api.put(ENDPOINTS.RADIOLOGY.REVERT(id));
    return data;
  },
};
