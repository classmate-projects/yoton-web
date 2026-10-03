import api from "@/lib/axios";
import { DentalChartType, ToothRecord, PerioRecord } from "@/types/dental.type";

export interface SaveChartPayload {
  encounterId: string;
  patientId: string;
  chartType: "Adult" | "Pediatric";
  generalNotes?: string;
  occlusionNotes?: string;
  softTissueNotes?: string;
  radioGraphicFindings?: string;
  toothRecords: ToothRecord[];
  periodontalRecords: PerioRecord[];
}

export const DentalService = {
  getChart: async (encounterId: string, chartType: "Adult" | "Pediatric"): Promise<DentalChartType | null> => {
    const { data } = await api.get(
      `/api/DentalChart?encounterId=${encounterId}&chartType=${chartType}`
    );
    return data.data ?? null;
  },

  saveChart: async (payload: SaveChartPayload): Promise<DentalChartType> => {
    const { data } = await api.post("/api/DentalChart", payload);
    return data.data;
  },
};
