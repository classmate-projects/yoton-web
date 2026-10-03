import { ENDPOINTS } from "@/lib/endpoints"
import api from "@/lib/axios"
import { compressImageForUpload } from "@/lib/resizeImage"

export const CompanyService = {
    uploadLogo: async (file: File) => {
        const compressed = await compressImageForUpload(file, 800);
        const form = new FormData();
        form.append("file", compressed);
        const { data } = await api.post(ENDPOINTS.COMPANY.UPLOAD_LOGO, form, {
            headers: { "Content-Type": "multipart/form-data" },
        })
        return data;
    },

    updateSettings: async (payload: {
        name?: string;
        maxDiscountPercent?: number | null;
        country?: string;
        currencyCode?: string;
        pediatricMaxAgeYears?: number;
        geriatricMinAgeYears?: number;
        idleTimeoutMinutes?: number;
        includeLoginCredentialsInPatientEmail?: boolean;
        patientEmailCredentialsSubject?: string;
        patientEmailCredentialsBody?: string;
        patientEmailSimpleSubject?: string;
        patientEmailSimpleBody?: string;
        displayName?: string;
        address?: string;
        contactEmail?: string;
        contactPhone?: string;
        website?: string;
        faxNumber?: string;
        facilityId?: string;
        eclaimlinkUsername?: string;
        eclaimlinkPassword?: string;
    }) => {
        const { data } = await api.put(ENDPOINTS.COMPANY.UPDATE_SETTINGS, payload);
        return data;
    },

    previewPatientEmail: async (payload: { includeLoginCredentials: boolean; subject?: string; body?: string }) => {
        const { data } = await api.post(ENDPOINTS.COMPANY.PREVIEW_PATIENT_EMAIL, payload);
        return data as { subject: string; html: string };
    },
}
