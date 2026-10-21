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
        // Removes the discount cap (a plain null maxDiscountPercent means "unchanged").
        clearMaxDiscountPercent?: boolean;
        pediatricMaxAgeYears?: number;
        geriatricMinAgeYears?: number;
        immunizationReminderDays?: number;
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
        // Only where the installation's region has tax (TRN in the UAE, GSTIN in India).
        taxRegistrationNumber?: string;
        eclaimlinkUsername?: string;
        eclaimlinkPassword?: string;
        staffCheckInRequired?: boolean;
        patientMatchFields?: string[];
    }) => {
        const { data } = await api.put(ENDPOINTS.COMPANY.UPDATE_SETTINGS, payload);
        return data;
    },

    previewPatientEmail: async (payload: { includeLoginCredentials: boolean; subject?: string; body?: string }) => {
        const { data } = await api.post(ENDPOINTS.COMPANY.PREVIEW_PATIENT_EMAIL, payload);
        return data as { subject: string; html: string };
    },
}
