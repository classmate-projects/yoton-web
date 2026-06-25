import { ENDPOINTS } from "@/helpers/endpoints"
import api from "@/lib/axios"
import { SpecializationCreateTypes, SpecializationUpdateTypes } from "@/types/specialization.type";

export const SpecializationService = {
    getAll: async () => {
        const { data } = await api.get(ENDPOINTS.SPECIALIZATION.GET)
        return data;
    },
    create: async (payload: SpecializationCreateTypes) => {
        const { data } = await api.post(ENDPOINTS.SPECIALIZATION.CREATE, payload)
        return data;
    },
    update: async (id: string, payload: SpecializationUpdateTypes) => {
        const { data } = await api.put(ENDPOINTS.SPECIALIZATION.UPDATE(id), payload)
        return data;
    },
    delete: async (id: string) => {
        const { data } = await api.delete(ENDPOINTS.SPECIALIZATION.DELETE(id))
        return data;
    }
}