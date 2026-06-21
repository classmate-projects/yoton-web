export const ENDPOINTS = {
    Role: {
        LIST: `/api/role/get-all`,
        CREATE: `/api/role/create-role`,
        UPDATE: (id: number) => `/api/role/update/${id}`,
        DELETE: (id: number) => `/api/role/delete/${id}`
    }
}