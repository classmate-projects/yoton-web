export const ENDPOINTS = {
    DASHBOARD: {
        GET_COUNTS: `/api/dashboard/counts`,
        GET_WEEKLY_APPOINTMENTS: `/api/dashboard/appointments/weekly`,
        GET_REVENUE: `/api/dashboard/revenue`,
        GET_TOP_DOCTORS: `/api/dashboard/top-doctors`
    },
    DEPARTMENT: {
        GET: `/api/department/get-all`,
        CREATE: `/api/department/create`,
        UPDATE: (id: string) => `/api/department/update/${id}`,
        DELETE: (id: string) => `/api/department/delete/${id}`,
    },
    RECEPTION: {
        GET_ALL_PATIENTS: `/api/reception/get-all/patient`,
        CREATE_PATIENT: `/api/reception/create-patient`,
        UPDATE_SCEDULE: `/api/reception/update-schedule`,
        GET_DOCTOR_AVAILABILITY: `/api/reception/doctor-availability`,
        GET_ALL_APPOINTMENTS: `/api/reception/get-all/appointment`,
        CREATE_APPOINTMENT: `/api/reception/create-appointment`,
        GET_SPECIALIZATIONS_DOCTORS: `/api/reception/specializations-doctors`,
        GET_DOCTOR_SLOTS: (doctorId: string, date: string) => `/api/reception/doctor-slots/${doctorId}?date=${date}`,
        UPDATE_PATIENT_AND_APPOINTMENT: (patientId: string) => `/api/reception/update-patient-and-appointment/${patientId}`,
        UPLOAD_PROFILE: (id: string) => `/api/reception/${id}/upload-profile`,
        SOFT_DELETE: (id: string) => `/api/reception/soft-delete/${id}`,
        UPDATE_STATUS: `/api/reception/update-status`,
        GET_DOCTOR_BY_ID: (doctorId: string) => `/api/reception/get-all/doctor/${doctorId}`,
        GET_PATIENT_BY_ID: (patientId: string) => `/api/reception/get-all/patient/${patientId}`,
        CANCEL: (id: string) => `/api/reception/cancel/${id}`
    },
    ROLE: {
        GET: `/api/role/get-all`,
        CREATE: `/api/role/create-role`,
        UPDATE: (id: string) => `/api/role/update/${id}`,
        DELETE: (id: string) => `/api/role/delete/${id}`,
    },
    SPECIALIZATION: {
        GET: `/api/specialization/get-all`,
        CREATE: `/api/specialization/create`,
        UPDATE: (id: string) => `/api/specialization/update/${id}`,
        DELETE: (id: string) => `/api/specialization/delete/${id}`
    },
    USER: {
        GET: `/api/user/get-all`,
        CREATE: `/api/user/create`,
        UPDATE: (id: string) => `/api/user/update/${id}`,
        DELETE: (id: string) => `/api/user/delete/${id}`,
        GET_ASSIGNED_DOCTORS: `/api/user/assigned-doctors`,
        CREATE_ASSIGN_DOCTOR: `/api/user/assign-doctor`,
        GET_SCHEDULED_DOCTOR: (doctorId: string) => `/api/user/${doctorId}/schedule`
    }
}