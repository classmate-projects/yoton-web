import api from "@/lib/axios"
import { ENDPOINTS } from "@/lib/endpoints"
import { ReceptionCreatePatientType } from "@/types/reception.type";
import { compressImageForUpload } from "@/lib/resizeImage";
import { CreateAppointmentPayload } from "@/types/appointment.type";
import { UpdateDoctorSchedulePayload } from "@/types/doctorAvailability.type";
import { CheckInPayload, WalkInPayload, ReassignVisitPayload, UploadPatientDocumentPayload } from "@/types/visit.type";

export const ReceptionService = {
    getAllPatients: async () => {
        const { data } = await api.get(ENDPOINTS.RECEPTION.GET_ALL_PATIENTS)
        return data;
    },
    getVisitList: async (from?: string, to?: string) => {
        const { data } = await api.get(ENDPOINTS.RECEPTION.GET_VISIT_LIST(from, to))
        return data;
    },
    createPatinet: async (payload: ReceptionCreatePatientType) => {
        const { data } = await api.post(ENDPOINTS.RECEPTION.CREATE_PATIENT, payload)
        return data;
    },
    getPatientById: async (id: string) => {
        const { data } = await api.get(ENDPOINTS.RECEPTION.GET_PATIENT_BY_ID(id))
        return data;
    },
    updatePatient: async (id: string, payload: Omit<ReceptionCreatePatientType, "password">) => {
        const { data } = await api.put(ENDPOINTS.RECEPTION.UPDATE_PATIENT(id), payload)
        return data;
    },
    softDelete: async (id: string) => {
        const { data } = await api.delete(ENDPOINTS.RECEPTION.SOFT_DELETE(id))
        return data;
    },
    resendWelcomeEmail: async (patientId: string) => {
        const { data } = await api.post(ENDPOINTS.RECEPTION.RESEND_WELCOME_EMAIL(patientId))
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
    updateDoctorSchedule: async (payload: UpdateDoctorSchedulePayload) => {
        const { data } = await api.put(ENDPOINTS.RECEPTION.UPDATE_SCEDULE, {
            DoctorId: payload.doctorId,
            UpdatedBy: payload.updatedBy,
            Schedules: payload.schedules.map((s) => ({
                Day: s.day,
                StartTime: s.startTime,
                EndTime: s.endTime,
                SlotDurationMinutes: s.slotDurationMinutes,
                MaxConcurrentBookings: s.maxConcurrentBookings,
                Breaks: s.breaks.map((b) => ({
                    StartTime: b.startTime,
                    EndTime: b.endTime,
                    Reason: b.reason,
                })),
            })),
            AdminOverride: payload.adminOverride
                ? {
                      Username: payload.adminOverride.username,
                      Password: payload.adminOverride.password,
                  }
                : undefined,
        })
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
            IsFollowUp: payload.isFollowUp,
            UrgencyLevel: payload.urgencyLevel,
        })
        return data;
    },
    overlapAppointment: async (payload: Pick<CreateAppointmentPayload, "patientId" | "doctorId" | "appointmentDate" | "notes" | "userId">) => {
        const { data } = await api.post(ENDPOINTS.RECEPTION.OVERLAP_APPOINTMENT, {
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
    getAppointmentRequests: async () => {
        const { data } = await api.get(ENDPOINTS.RECEPTION.GET_APPOINTMENT_REQUESTS)
        return data;
    },
    getPendingFollowUps: async () => {
        const { data } = await api.get(ENDPOINTS.RECEPTION.GET_PENDING_FOLLOW_UPS)
        return data;
    },
    confirmFollowUp: async (id: string, appointmentDate: string) => {
        const { data } = await api.put(ENDPOINTS.RECEPTION.CONFIRM_FOLLOW_UP(id), { appointmentDate })
        return data;
    },
    dismissFollowUp: async (id: string) => {
        const { data } = await api.delete(ENDPOINTS.RECEPTION.DISMISS_FOLLOW_UP(id))
        return data;
    },
    updateAppointmentStatus: async (appointmentId: string, status: string) => {
        const { data } = await api.post(ENDPOINTS.RECEPTION.UPDATE_STATUS, {
            AppointmentId: appointmentId,
            Status: status,
        })
        return data;
    },
    getScheduledAppointments: async (date?: string) => {
        const { data } = await api.get(ENDPOINTS.RECEPTION.GET_SCHEDULED_APPOINTMENTS(date))
        return data;
    },
    checkIn: async (payload: CheckInPayload) => {
        const { data } = await api.post(ENDPOINTS.RECEPTION.CHECK_IN, payload)
        return data;
    },
    walkIn: async (payload: WalkInPayload) => {
        const { data } = await api.post(ENDPOINTS.RECEPTION.WALK_IN, payload)
        return data;
    },
    getVisit: async (id: string) => {
        const { data } = await api.get(ENDPOINTS.RECEPTION.GET_VISIT(id))
        return data;
    },
    reassignVisit: async (id: string, payload: ReassignVisitPayload) => {
        const { data } = await api.put(ENDPOINTS.RECEPTION.REASSIGN_VISIT(id), payload)
        return data;
    },
    cancelVisit: async (id: string, password: string) => {
        const { data } = await api.post(ENDPOINTS.RECEPTION.CANCEL_VISIT(id), { password })
        return data;
    },
    getVisitQueue: async (status?: string) => {
        const { data } = await api.get(ENDPOINTS.RECEPTION.GET_VISIT_QUEUE(status))
        return data;
    },
    getPendingReferrals: async () => {
        const { data } = await api.get(ENDPOINTS.RECEPTION.GET_PENDING_REFERRALS);
        return data;
    },
    registerFromReferral: async (referralId: string, payload: { doctorId?: string; appointmentDate?: string; notes?: string }) => {
        const { data } = await api.post(ENDPOINTS.RECEPTION.REGISTER_FROM_REFERRAL(referralId), payload);
        return data;
    },
    uploadDocument: async (patientId: string, payload: UploadPatientDocumentPayload) => {
        const compressedFile = await compressImageForUpload(payload.file);
        const form = new FormData();
        form.append("DocumentType", payload.documentType);
        if (payload.visitId) form.append("VisitId", payload.visitId);
        if (payload.linkedLabRequestId) form.append("LinkedLabRequestId", payload.linkedLabRequestId);
        if (payload.linkedRadiologyRequestId) form.append("LinkedRadiologyRequestId", payload.linkedRadiologyRequestId);
        form.append("File", compressedFile);
        const { data } = await api.post(ENDPOINTS.RECEPTION.UPLOAD_DOCUMENT(patientId), form, {
            headers: { "Content-Type": "multipart/form-data" },
        })
        return data;
    },

}