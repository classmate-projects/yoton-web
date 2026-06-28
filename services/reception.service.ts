import api from "@/lib/axios"
import { ENDPOINTS } from "@/lib/endpoints"
import { ReceptionCreatePatientType } from "@/types/reception.type";

export const ReceptionService = {
    getAllPatients: async () => {
        const { data } = await api.get(ENDPOINTS.RECEPTION.GET_ALL_PATIENTS)
        return data;
    },
    createPatinet: async (payload: ReceptionCreatePatientType) => {
        const { data } = await api.post(ENDPOINTS.RECEPTION.CREATE_PATIENT, payload)
        return data;
    }, 
    softDelete: async (id: string) => {
        const { data } = await api.delete(ENDPOINTS.RECEPTION.SOFT_DELETE(id))
        return data;
    }
}