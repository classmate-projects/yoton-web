import { ENDPOINTS } from "@/lib/endpoints"
import api from "@/lib/axios"
import { BranchCreateType } from "@/types/branch.type";

export const BranchService = {
    getAll: async () => {
        const { data } = await api.get(ENDPOINTS.BRANCH.GET_ALL);
        return data;
    },
    create: async (payload: BranchCreateType) => {
        const { data } = await api.post(ENDPOINTS.BRANCH.CREATE, payload);
        return data;
    },
}
