import api from "@/lib/axios";
import { ENDPOINTS } from "@/lib/endpoints";

export const ComplianceDataService = {
  getStaffFte: async () => {
    const { data } = await api.get(ENDPOINTS.COMPLIANCE_DATA.GET_STAFF_FTE());
    return data;
  },
  updateStaffFte: async (userId: string, fteValue: number | null) => {
    const { data } = await api.put(ENDPOINTS.COMPLIANCE_DATA.UPDATE_STAFF_FTE(userId), { fteValue });
    return data;
  },
  getPatientFlags: async () => {
    const { data } = await api.get(ENDPOINTS.COMPLIANCE_DATA.GET_PATIENT_FLAGS());
    return data;
  },
  updatePatientFlags: async (
    chronicConditionId: string,
    updates: { hasNonacuteAdmission?: boolean; diabetesType?: string }
  ) => {
    const { data } = await api.put(ENDPOINTS.COMPLIANCE_DATA.UPDATE_PATIENT_FLAGS(chronicConditionId), updates);
    return data;
  },
};
