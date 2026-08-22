import { ENDPOINTS } from "@/lib/endpoints"
import api from "@/lib/axios"

export const AttendanceService = {
    getToday: async () => {
        const { data } = await api.get(ENDPOINTS.ATTENDANCE.GET_TODAY);
        return data;
    },

    checkIn: async () => {
        const { data } = await api.post(ENDPOINTS.ATTENDANCE.CHECK_IN);
        return data;
    },

    checkOut: async () => {
        const { data } = await api.post(ENDPOINTS.ATTENDANCE.CHECK_OUT);
        return data;
    },

    getHistory: async (days?: number) => {
        const { data } = await api.get(ENDPOINTS.ATTENDANCE.GET_HISTORY(days));
        return data;
    },
}
