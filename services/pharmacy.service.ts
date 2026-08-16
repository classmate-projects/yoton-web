import api from "@/lib/axios";
import { ENDPOINTS } from "@/lib/endpoints";
import { AddMedicinePayload, CreatePrescriptionPayload, DispenseMedicationPayload, IssueMedicinePayload } from "@/types/pharmacy.type";

export const PharmacyService = {
  getMedicines: async () => {
    const { data } = await api.get(ENDPOINTS.PHARMACY.GET_MEDICINES);
    return data;
  },
  getLowStock: async () => {
    const { data } = await api.get(ENDPOINTS.PHARMACY.GET_LOW_STOCK);
    return data;
  },
  addMedicine: async (payload: AddMedicinePayload) => {
    const { data } = await api.post(ENDPOINTS.PHARMACY.ADD_MEDICINE, payload);
    return data;
  },
  updateStock: async (medicineId: string, quantity: number) => {
    const { data } = await api.post(ENDPOINTS.PHARMACY.UPDATE_STOCK, {
      medicineId,
      quantity,
    });
    return data;
  },
  getPrescriptions: async () => {
    const { data } = await api.get(ENDPOINTS.PHARMACY.GET_PRESCRIPTIONS);
    return data;
  },
  getPendingPrescriptions: async () => {
    const { data } = await api.get(ENDPOINTS.PHARMACY.GET_PENDING_PRESCRIPTIONS);
    return data;
  },
  createPrescription: async (payload: CreatePrescriptionPayload) => {
    const { data } = await api.post(ENDPOINTS.PHARMACY.CREATE_PRESCRIPTION, payload);
    return data;
  },
  issue: async (prescriptionId: string, payload: IssueMedicinePayload) => {
    const { data } = await api.post(ENDPOINTS.PHARMACY.ISSUE, { prescriptionId, ...payload });
    return data;
  },
  getSummary: async () => {
    const { data } = await api.get(ENDPOINTS.PHARMACY.GET_SUMMARY);
    return data;
  },
  getMedicationQueue: async (status: "pending" | "all") => {
    const { data } = await api.get(ENDPOINTS.PHARMACY.GET_MEDICATION_QUEUE(status));
    return data;
  },
  prepareMedication: async (medicationId: string) => {
    const { data } = await api.post(ENDPOINTS.PHARMACY.PREPARE_MEDICATION(medicationId));
    return data;
  },
  dispenseMedication: async (medicationId: string, payload: DispenseMedicationPayload) => {
    const { data } = await api.post(ENDPOINTS.PHARMACY.DISPENSE_MEDICATION(medicationId), payload);
    return data;
  },
};
