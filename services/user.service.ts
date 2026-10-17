import { ENDPOINTS } from "@/lib/endpoints"
import api from "@/lib/axios"
import { UserAssignedDoctorCreateType, UserCreateType, UserUpdateType, TerminateUserPayload } from "@/types/user.type";

export const UserService = {
    getAll: async () => {
        const { data } = await api.get(ENDPOINTS.USER.GET)
        return data;
    },
    getAllByRole: async (role: string) => {
        const { data } = await api.get(ENDPOINTS.USER.GET_BY_ROLE(role))
        return data;
    },

    create: async (payload: UserCreateType) => {
        const { data } = await api.post(ENDPOINTS.USER.CREATE, payload)
        return data;
    },
    update: async (id: string, payload: UserUpdateType) => {
        const { data } = await api.put(ENDPOINTS.USER.UPDATE(id), payload)
        return data;
    },
    delete: async (id: string) => {
        const { data } = await api.delete(ENDPOINTS.USER.DELETE(id))
        return data;
    },
    restore: async (id: string, adminPassword: string) => {
        const { data } = await api.post(ENDPOINTS.USER.RESTORE(id), { adminPassword })
        return data;
    },
    rehire: async (id: string, adminPassword: string) => {
        const { data } = await api.put(ENDPOINTS.USER.REHIRE(id), { adminPassword })
        return data;
    },
    updateStatus: async (id: string, isActive: boolean, adminPassword: string) => {
        const { data } = await api.put(ENDPOINTS.USER.UPDATE_STATUS(id), { isActive, adminPassword })
        return data;
    },
    get_assigned_doctors : async () => {
        const { data } = await api.get(ENDPOINTS.USER.GET_ASSIGNED_DOCTORS)
        return data;
    },
    get_scheduled_doctors: async (doctorId: string) => {
        const { data } = await api.get(ENDPOINTS.USER.GET_SCHEDULED_DOCTOR(doctorId))
        return data;
    },
    create_assign_doctor: async (payload: UserAssignedDoctorCreateType) => {
        const { data } = await api.post(ENDPOINTS.USER.CREATE_ASSIGN_DOCTOR, payload)
        return data;
    },
    terminate: async (id: string, payload: TerminateUserPayload) => {
        const { data } = await api.put(ENDPOINTS.USER.TERMINATE(id), payload)
        return data;
    },
    getEmploymentHistory: async (id: string) => {
        const { data } = await api.get(ENDPOINTS.USER.GET_EMPLOYMENT_HISTORY(id))
        return data;
    },
    uploadSignature: async (id: string, file: File) => {
        const form = new FormData();
        form.append("file", file);
        const { data } = await api.post(ENDPOINTS.USER.UPLOAD_SIGNATURE(id), form, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return data;
    },
}