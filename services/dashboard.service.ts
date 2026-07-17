import api from "@/lib/axios"
import { ENDPOINTS } from "@/lib/endpoints"

export const DashboardService = {
    getCounts : async () => {
        const { data } = await api.get(ENDPOINTS.DASHBOARD.GET_COUNTS)
        return data;
    },
    getWeeklyAppointments : async () => {
        const { data } = await api.get(ENDPOINTS.DASHBOARD.GET_WEEKLY_APPOINTMENTS)
        return data;
    },
    getRevenue : async () => {
        const { data } = await api.get(ENDPOINTS.DASHBOARD.GET_REVENUE)
        return data;
    },
    getTopDoctors : async () => {
        const { data } = await api.get(ENDPOINTS.DASHBOARD.GET_TOP_DOCTORS)
        return data;
    },
}