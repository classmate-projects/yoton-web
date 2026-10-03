import { ENDPOINTS } from "@/lib/endpoints"
import api from "@/lib/axios"
import { BranchCreateType, BranchUpdateType } from "@/types/branch.type";

export const BranchService = {
    getAll: async () => {
        const { data } = await api.get(ENDPOINTS.BRANCH.GET_ALL);
        return data;
    },
    create: async (payload: BranchCreateType) => {
        const { data } = await api.post(ENDPOINTS.BRANCH.CREATE, payload);
        return data;
    },
    update: async (id: string, payload: BranchUpdateType) => {
        const { data } = await api.put(ENDPOINTS.BRANCH.UPDATE(id), payload);
        return data;
    },
    uploadLogo: async (id: string, file: File) => {
        const form = new FormData();
        form.append("file", file);
        const { data } = await api.post(ENDPOINTS.BRANCH.UPLOAD_LOGO(id), form, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return data;
    },
    delete: async (id: string) => {
        const { data } = await api.delete(ENDPOINTS.BRANCH.DELETE(id));
        return data;
    },
    migrateAndDelete: async (id: string, targetBranchId: string) => {
        const { data } = await api.post(ENDPOINTS.BRANCH.MIGRATE_AND_DELETE(id), { targetBranchId });
        return data;
    },
}
