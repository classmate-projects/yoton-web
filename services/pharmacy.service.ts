import api from "@/lib/axios";
import { ENDPOINTS } from "@/lib/endpoints";
import {
  AddMedicinePayload,
  CreatePrescriptionPayload,
  DispenseMedicationPayload,
  IssueMedicinePayload,
  MedicineBulkUploadPayload,
} from "@/types/pharmacy.type";

export const PharmacyService = {
  getMedicines: async (params?: { search?: string; source?: string; page?: number; pageSize?: number }) => {
    const { data } = await api.get(ENDPOINTS.PHARMACY.GET_MEDICINES, { params });
    return data;
  },
  bulkUploadMedicines: async (payload: MedicineBulkUploadPayload) => {
    const { data } = await api.post(ENDPOINTS.PHARMACY.BULK_UPLOAD_MEDICINES, payload);
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
  updateMedicine: async (medicineId: string, payload: AddMedicinePayload) => {
    const { data } = await api.put(ENDPOINTS.PHARMACY.UPDATE_MEDICINE(medicineId), payload);
    return data;
  },
  removeMedicine: async (medicineId: string) => {
    const { data } = await api.delete(ENDPOINTS.PHARMACY.REMOVE_MEDICINE(medicineId));
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
  updatePrescription: async (prescriptionId: string, payload: CreatePrescriptionPayload) => {
    const { data } = await api.put(ENDPOINTS.PHARMACY.UPDATE_PRESCRIPTION(prescriptionId), payload);
    return data;
  },
  removePrescription: async (prescriptionId: string) => {
    const { data } = await api.delete(ENDPOINTS.PHARMACY.REMOVE_PRESCRIPTION(prescriptionId));
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
  getAlternatives: async (medicineId: string) => {
    const { data } = await api.get(ENDPOINTS.PHARMACY.GET_ALTERNATIVES(medicineId));
    return data;
  },
  addAlternative: async (medicineId: string, alternativeMedicineId: string) => {
    const { data } = await api.post(ENDPOINTS.PHARMACY.ADD_ALTERNATIVE(medicineId), { alternativeMedicineId });
    return data;
  },
  removeAlternative: async (medicineId: string, alternativeId: string) => {
    const { data } = await api.delete(ENDPOINTS.PHARMACY.REMOVE_ALTERNATIVE(medicineId, alternativeId));
    return data;
  },
  setHighRisk: async (medicineId: string, isHighRisk: boolean) => {
    const { data } = await api.put(ENDPOINTS.PHARMACY.SET_HIGH_RISK(medicineId), { isHighRisk });
    return data;
  },
};
