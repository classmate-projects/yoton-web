import { ENDPOINTS } from "@/lib/endpoints"
import api from "@/lib/axios"
import type { Region, SystemStatus } from "@/types/region.type"

// The super administrator's system setup - choosing the installation's country/region.
export const SystemService = {
    getStatus: async () => {
        const { data } = await api.get(ENDPOINTS.SYSTEM.STATUS);
        return data.data as SystemStatus;
    },
    getRegions: async () => {
        const { data } = await api.get(ENDPOINTS.SYSTEM.REGIONS);
        return data.data as Region[];
    },
    // Needs the super administrator's own password again - switching the country changes
    // how the whole system behaves.
    applyRegion: async (regionCode: string, password: string) => {
        const { data } = await api.put(ENDPOINTS.SYSTEM.APPLY_REGION, { regionCode, password });
        return data as { message: string; data: Region };
    },
}
