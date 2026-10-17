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

    // Requires the caller's own password - see AttendanceController.CheckOut's own comment.
    checkOut: async (password: string) => {
        const { data } = await api.post(ENDPOINTS.ATTENDANCE.CHECK_OUT, { password });
        return data;
    },

    getHistory: async (days?: number) => {
        const { data } = await api.get(ENDPOINTS.ATTENDANCE.GET_HISTORY(days));
        return data;
    },

    // Admin only - every staff member's check-in/out for one "yyyy-MM-dd" day.
    getStaffForDate: async (date: string) => {
        const { data } = await api.get(ENDPOINTS.ATTENDANCE.GET_STAFF(date));
        return data;
    },
}
