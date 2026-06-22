import { ENDPOINTS } from "@/helpers/endpoints"
import api from "@/lib/axios"
import { CreateRoleProps, UpdateRoleProps } from "@/types/role.type";

export const RoleService = {
    getAll: async () => {
        const { data } = await api.get(ENDPOINTS.ROLE.GET);
        return data;
    },

    create: async (payload: CreateRoleProps) => {
        const { data } = await api.post(ENDPOINTS.ROLE.CREATE, payload);
        return data;
    },

    update: async (id: string, payload: UpdateRoleProps) => {
        const { data } = await api.put(ENDPOINTS.ROLE.UPDATE(id), payload)
        return data;
    }, 

    delete: async (id: string) => {
        console.log(ENDPOINTS.ROLE.DELETE(id));
        const { data } = await api.delete(ENDPOINTS.ROLE.DELETE(id))
        return data;
    }
}