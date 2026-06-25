import { ENDPOINTS } from "@/helpers/endpoints"
import api from "@/lib/axios"
import { UserCreateType, UserUpdateType } from "@/types/user.type";

export const UserService = {
    getAll: async () => {
        const { data } = await api.get(ENDPOINTS.USER.GET)
        return data;
    }, 

    create: async (payload: UserCreateType) => {
        const { data } = await api.post(ENDPOINTS.USER.CREATE, payload)
        return data;
    },
    update: async (id: string, payload: UserUpdateType) => {
        const { data } = await api.put(ENDPOINTS.USER.UPDATE(id), payload)
        return data;
    },
    delete: async (id: string) => {
        const { data } = await api.delete(ENDPOINTS.USER.DELETE(id))
        return data;
    }
}