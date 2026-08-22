import { ENDPOINTS } from "@/lib/endpoints"
import api from "@/lib/axios"

export const AuthService = {
    getMe: async () => {
        const { data } = await api.get(ENDPOINTS.AUTH.ME);
        return data;
    },
    uploadAvatar: async (file: File) => {
        const form = new FormData();
        form.append("file", file);
        const { data } = await api.post(ENDPOINTS.AUTH.UPLOAD_AVATAR, form, {
            headers: { "Content-Type": "multipart/form-data" },
        })
        return data;
    },
    deleteAvatar: async () => {
        const { data } = await api.delete(ENDPOINTS.AUTH.DELETE_AVATAR);
        return data;
    },
}
