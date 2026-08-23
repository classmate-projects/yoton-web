import api from "@/lib/axios";
import { ENDPOINTS } from "@/lib/endpoints";

export const KpiReportService = {
  getCatalog: async () => {
    const { data } = await api.get(ENDPOINTS.KPI_REPORT.GET_CATALOG());
    return data;
  },
  // Returns the raw blob response so the caller can turn it into a download - there's no
  // existing file-download precedent elsewhere in the app, this is the first one.
  download: async (reportKey: string, start: string, end: string) => {
    return api.get(ENDPOINTS.KPI_REPORT.DOWNLOAD(reportKey, start, end), { responseType: "blob" });
  },
};
