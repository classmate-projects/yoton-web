import { ENDPOINTS } from "@/helpers/endpoints"
import api from "@/lib/axios"

export const RoleService = {
    getAll: async () => {
        const { data } = await api.get(ENDPOINTS.ROLE.LIST);
        return data;
    }
}