import api from "@/lib/axios";
import { ENDPOINTS } from "@/lib/endpoints";
import { ListItemPayload, ListItemBulkUploadPayload } from "@/types/configList.type";

export const ConfigListService = {
  get: async (listType: string, search?: string) => {
    const { data } = await api.get(ENDPOINTS.CONFIG_LIST.GET(listType, search));
    return data;
  },
  create: async (listType: string, payload: ListItemPayload) => {
    const { data } = await api.post(ENDPOINTS.CONFIG_LIST.CREATE(listType), payload);
    return data;
  },
  bulkUpload: async (listType: string, payload: ListItemBulkUploadPayload) => {
    const { data } = await api.post(ENDPOINTS.CONFIG_LIST.BULK_UPLOAD(listType), payload);
    return data;
  },
  update: async (id: string, payload: ListItemPayload) => {
    const { data } = await api.put(ENDPOINTS.CONFIG_LIST.UPDATE(id), payload);
    return data;
  },
  setActive: async (id: string, isActive: boolean) => {
    const { data } = await api.put(ENDPOINTS.CONFIG_LIST.SET_ACTIVE(id, isActive));
    return data;
  },
  remove: async (id: string) => {
    const { data } = await api.delete(ENDPOINTS.CONFIG_LIST.DELETE(id));
    return data;
  },
};
