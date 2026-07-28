import api from "@/lib/axios"
import { ENDPOINTS } from "@/lib/endpoints"
import { ReceptionCreatePatientType, UpdateScheduleTypes } from "@/types/reception.type";
import { CreateAppointmentPayload } from "@/types/appointment.type";

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
    },
    getDoctorAvailability: async () => {
        const { data } = await api.get(ENDPOINTS.RECEPTION.GET_DOCTOR_AVAILABILITY)
        return data;
    },
    getAllAppointments: async () => {
        const { data } = await api.get(ENDPOINTS.RECEPTION.GET_ALL_APPOINTMENTS)
        return data;
    },
    getDoctorById: async (id: string) => {
        const { data } = await api.get(ENDPOINTS.RECEPTION.GET_DOCTOR_BY_ID(id))
        return data;
    },
    updateSchedule: async (payload: UpdateScheduleTypes) => {
        const { data } = await api.put(ENDPOINTS.RECEPTION.UPDATE_SCEDULE, payload)
        return data;
    },
    getSpecializationsWithDoctors: async () => {
        const { data } = await api.get(ENDPOINTS.RECEPTION.GET_SPECIALIZATIONS_DOCTORS)
        return data;
    },
    getDoctorSlots: async (doctorId: string, date: string) => {
        const { data } = await api.get(ENDPOINTS.RECEPTION.GET_DOCTOR_SLOTS(doctorId, date))
        return data;
    },
    createAppointment: async (payload: CreateAppointmentPayload) => {
        const { data } = await api.post(ENDPOINTS.RECEPTION.CREATE_APPOINTMENT, {
            PatientId: payload.patientId,
            DoctorId: payload.doctorId,
            AppointmentDate: payload.appointmentDate,
            Notes: payload.notes,
            UserId: payload.userId,
        })
        return data;
    },
    cancelAppointment: async (appointmentId: string) => {
        const { data } = await api.post(ENDPOINTS.RECEPTION.CANCEL(appointmentId))
        return data;
    },

}