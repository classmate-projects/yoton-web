import { ENDPOINTS } from "@/lib/endpoints"
import api from "@/lib/axios"

export const RecentModulesService = {
    get: async () => {
        const { data } = await api.get(ENDPOINTS.RECENT_MODULES.GET);
        return data;
    },
    record: async (navLink: string) => {
        const { data } = await api.post(ENDPOINTS.RECENT_MODULES.RECORD, { navLink });
        return data;
    },
}
