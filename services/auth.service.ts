import { ENDPOINTS } from "@/lib/endpoints"
import api from "@/lib/axios"
import { compressImageForUpload } from "@/lib/resizeImage"

export const AuthService = {
    getMe: async () => {
        const { data } = await api.get(ENDPOINTS.AUTH.ME);
        return data;
    },
    uploadAvatar: async (file: File) => {
        const compressed = await compressImageForUpload(file, 800);
        const form = new FormData();
        form.append("file", compressed);
        const { data } = await api.post(ENDPOINTS.AUTH.UPLOAD_AVATAR, form, {
            headers: { "Content-Type": "multipart/form-data" },
        })
        return data;
    },
    deleteAvatar: async () => {
        const { data } = await api.delete(ENDPOINTS.AUTH.DELETE_AVATAR);
        return data;
    },
    changePassword: async (currentPassword: string, newPassword: string) => {
        const { data } = await api.post(ENDPOINTS.AUTH.CHANGE_PASSWORD, { currentPassword, newPassword });
        return data as { message: string };
    },
}
