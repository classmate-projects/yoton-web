import api from "@/lib/axios";
import { ENDPOINTS } from "@/lib/endpoints";
import { AuditLogFilters } from "@/types/auditLog.type";

export const AuditLogService = {
  getAll: async (filters: AuditLogFilters) => {
    const { data } = await api.get(ENDPOINTS.AUDIT_LOG.GET_ALL(filters));
    return data;
  },
  getModules: async () => {
    const { data } = await api.get(ENDPOINTS.AUDIT_LOG.GET_MODULES());
    return data;
  },
};
