import api from "@/lib/axios";
import { ENDPOINTS } from "@/lib/endpoints";
import { HandHygieneSessionCreatePayload } from "@/types/handHygiene.type";

export const HandHygieneService = {
  getSessions: async () => {
    const { data } = await api.get(ENDPOINTS.HAND_HYGIENE.GET_SESSIONS());
    return data;
  },
  createSession: async (payload: HandHygieneSessionCreatePayload) => {
    const { data } = await api.post(ENDPOINTS.HAND_HYGIENE.CREATE_SESSION(), payload);
    return data;
  },
};
