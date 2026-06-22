import { ENDPOINTS } from "@/helpers/endpoints"
import api from "@/lib/axios"
import { DepartmentCreateType, DepartmentUpdateType } from "@/types/department.type";

export const DepartmentSerivce = {
    getAll: async () => {
        const { data } = await api.get(ENDPOINTS.DEPARTMENT.GET);
        return data;
    }, 
    create: async (payload: DepartmentCreateType) => {
        const { data } = await api.post(ENDPOINTS.DEPARTMENT.CREATE, payload)
        return data;
    },
    update: async (id: string, payload: DepartmentUpdateType) => {
        const { data } = await api.put(ENDPOINTS.DEPARTMENT.UPDATE(id), payload)
        return data;
    },
    delete: async (id: string) => {
        const { data } = await api.delete(ENDPOINTS.DEPARTMENT.DELETE(id))
        return data;
    }
}