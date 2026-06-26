export const ENDPOINTS = {
    DEPARTMENT: {
        GET: `/api/department/get-all`,
        CREATE: `/api/department/create`,
        UPDATE: (id: string) => `/api/department/update/${id}`,
        DELETE: (id: string) => `/api/department/delete/${id}`,
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