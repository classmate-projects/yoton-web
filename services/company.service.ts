import { ENDPOINTS } from "@/lib/endpoints"
import api from "@/lib/axios"

export const CompanyService = {
    uploadLogo: async (file: File) => {
        const form = new FormData();
        form.append("file", file);
        const { data } = await api.post(ENDPOINTS.COMPANY.UPLOAD_LOGO, form, {
            headers: { "Content-Type": "multipart/form-data" },
        })
        return data;
    },
}
