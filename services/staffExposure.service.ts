import api from "@/lib/axios";
import { ENDPOINTS } from "@/lib/endpoints";
import { StaffExposureCreatePayload, StaffExposureUpdatePayload } from "@/types/staffExposure.type";

export const StaffExposureService = {
  getAll: async (status?: string) => {
    const { data } = await api.get(ENDPOINTS.STAFF_EXPOSURE.GET_ALL(status));
    return data;
  },
  create: async (payload: StaffExposureCreatePayload) => {
    const { data } = await api.post(ENDPOINTS.STAFF_EXPOSURE.CREATE(), payload);
    return data;
  },
  update: async (id: string, payload: StaffExposureUpdatePayload) => {
    const { data } = await api.put(ENDPOINTS.STAFF_EXPOSURE.UPDATE(id), payload);
    return data;
  },
  reopen: async (id: string) => {
    const { data } = await api.put(ENDPOINTS.STAFF_EXPOSURE.REOPEN(id));
    return data;
  },
  remove: async (id: string) => {
    const { data } = await api.delete(ENDPOINTS.STAFF_EXPOSURE.REMOVE(id));
    return data;
  },
};
