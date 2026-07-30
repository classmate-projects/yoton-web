import api from "@/lib/axios";
import { ENDPOINTS } from "@/lib/endpoints";
import { AddBillItemPayload, AddBillItemFromSourcePayload, CreateBillPayload } from "@/types/billing.type";

export const BillingService = {
  getAll: async () => {
    const { data } = await api.get(ENDPOINTS.BILLING.GET_ALL);
    return data;
  },
  getPending: async () => {
    const { data } = await api.get(ENDPOINTS.BILLING.GET_PENDING);
    return data;
  },
  getSummary: async () => {
    const { data } = await api.get(ENDPOINTS.BILLING.GET_SUMMARY);
    return data;
  },
  getById: async (id: string) => {
    const { data } = await api.get(ENDPOINTS.BILLING.GET_BY_ID(id));
    return data;
  },
  getByPatient: async (patientId: string) => {
    const { data } = await api.get(ENDPOINTS.BILLING.GET_BY_PATIENT(patientId));
    return data;
  },
  create: async (payload: CreateBillPayload) => {
    const { data } = await api.post(ENDPOINTS.BILLING.CREATE, payload);
    return data;
  },
  addItem: async (payload: AddBillItemPayload) => {
    const { data } = await api.post(ENDPOINTS.BILLING.ADD_ITEM, payload);
    return data;
  },
  pay: async (billId: string, paymentMethod: string) => {
    const { data } = await api.post(ENDPOINTS.BILLING.PAY, { billId, paymentMethod });
    return data;
  },
  cancel: async (id: string) => {
    const { data } = await api.post(ENDPOINTS.BILLING.CANCEL(id));
    return data;
  },
  getChargeableItems: async (visitId: string) => {
    const { data } = await api.get(ENDPOINTS.BILLING.GET_CHARGEABLE_ITEMS(visitId));
    return data;
  },
  addItemFromSource: async (payload: AddBillItemFromSourcePayload) => {
    const { data } = await api.post(ENDPOINTS.BILLING.ADD_ITEM_FROM_SOURCE, payload);
    return data;
  },
};
