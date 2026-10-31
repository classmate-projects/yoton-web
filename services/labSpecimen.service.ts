import api from "@/lib/axios";
import { ENDPOINTS } from "@/lib/endpoints";
import type { SaveLabTestSpecimenRow, SaveSpecimenContainerPayload } from "@/types/labSpecimen.type";

export const LabSpecimenService = {
  getContainers: async (includeInactive = false) => {
    const { data } = await api.get(ENDPOINTS.LAB_SPECIMENS.CONTAINERS(includeInactive));
    return data;
  },
  createContainer: async (payload: SaveSpecimenContainerPayload) => {
    const { data } = await api.post(ENDPOINTS.LAB_SPECIMENS.CREATE_CONTAINER, payload);
    return data;
  },
  updateContainer: async (id: string, payload: SaveSpecimenContainerPayload) => {
    const { data } = await api.put(ENDPOINTS.LAB_SPECIMENS.CONTAINER(id), payload);
    return data;
  },
  deleteContainer: async (id: string) => {
    const { data } = await api.delete(ENDPOINTS.LAB_SPECIMENS.CONTAINER(id));
    return data;
  },
  // Configured containers for a page of catalog rows, keyed by listItemId.
  getForTests: async (listItemIds: string[]) => {
    const { data } = await api.get(ENDPOINTS.LAB_SPECIMENS.TESTS(listItemIds));
    return data;
  },
  getTestSetup: async (listItemId: string) => {
    const { data } = await api.get(ENDPOINTS.LAB_SPECIMENS.TEST(listItemId));
    return data;
  },
  saveTestSpecimens: async (listItemId: string, specimens: SaveLabTestSpecimenRow[]) => {
    const { data } = await api.put(ENDPOINTS.LAB_SPECIMENS.TEST(listItemId), { specimens });
    return data;
  },
  resetTestSpecimens: async (listItemId: string) => {
    const { data } = await api.post(ENDPOINTS.LAB_SPECIMENS.RESET_TEST(listItemId));
    return data;
  },
  getCoverage: async () => {
    const { data } = await api.get(ENDPOINTS.LAB_SPECIMENS.COVERAGE);
    return data;
  },
  applyDefaults: async () => {
    const { data } = await api.post(ENDPOINTS.LAB_SPECIMENS.APPLY_DEFAULTS);
    return data;
  },
};
