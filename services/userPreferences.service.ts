import { ENDPOINTS } from "@/lib/endpoints"
import api from "@/lib/axios"

export const UserPreferencesService = {
    get: async (key: string) => {
        const { data } = await api.get(ENDPOINTS.USER_PREFERENCES.GET(key));
        return data;
    },
    set: async (key: string, value: string) => {
        const { data } = await api.put(ENDPOINTS.USER_PREFERENCES.SET(key), { value });
        return data;
    },
}
