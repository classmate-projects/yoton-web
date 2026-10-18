import api from "@/lib/axios";
import { ENDPOINTS } from "@/lib/endpoints";
import { TestParameterPayload } from "@/types/testParameter.type";

export const TestParameterService = {
  get: async (listItemId: string) => {
    const { data } = await api.get(ENDPOINTS.TEST_PARAMETERS.GET(listItemId));
    return data;
  },
  create: async (payload: TestParameterPayload) => {
    const { data } = await api.post(ENDPOINTS.TEST_PARAMETERS.CREATE, payload);
    return data;
  },
  remove: async (id: string) => {
    const { data } = await api.delete(ENDPOINTS.TEST_PARAMETERS.DELETE(id));
    return data;
  },
};
