import { ENDPOINTS } from "@/lib/endpoints";
import api from "@/lib/axios";

export const FormTemplateService = {
  getAll: async () => {
    const { data } = await api.get(ENDPOINTS.FORM_TEMPLATE.GET_ALL);
    return data;
  },
  create: async (payload: { name: string; fieldsJson: string; supportsHandover: boolean }) => {
    const { data } = await api.post(ENDPOINTS.FORM_TEMPLATE.CREATE, payload);
    return data;
  },
  update: async (id: string, payload: { name: string; fieldsJson: string; supportsHandover: boolean }) => {
    const { data } = await api.put(ENDPOINTS.FORM_TEMPLATE.UPDATE(id), payload);
    return data;
  },
  setActive: async (id: string, isActive: boolean) => {
    const { data } = await api.put(ENDPOINTS.FORM_TEMPLATE.SET_ACTIVE(id, isActive));
    return data;
  },
  setDepartments: async (id: string, departmentIds: string[]) => {
    const { data } = await api.put(ENDPOINTS.FORM_TEMPLATE.SET_DEPARTMENTS(id), { departmentIds });
    return data;
  },
  setSpecialties: async (id: string, specializationIds: string[]) => {
    const { data } = await api.put(ENDPOINTS.FORM_TEMPLATE.SET_SPECIALTIES(id), { specializationIds });
    return data;
  },
  getAvailable: async (doctorId?: string) => {
    const { data } = await api.get(ENDPOINTS.FORM_TEMPLATE.GET_AVAILABLE(doctorId));
    return data;
  },
  uploadImage: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await api.post(ENDPOINTS.FORM_TEMPLATE.UPLOAD_IMAGE, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
};

export const SavedMedicalFormService = {
  create: async (payload: { patientId: string; visitId: string; formTemplateId: string; valuesJson: string }) => {
    const { data } = await api.post(ENDPOINTS.SAVED_MEDICAL_FORM.CREATE, payload);
    return data;
  },
  update: async (id: string, valuesJson: string) => {
    const { data } = await api.put(ENDPOINTS.SAVED_MEDICAL_FORM.UPDATE(id), { valuesJson });
    return data;
  },
  remove: async (id: string, password?: string) => {
    const { data } = await api.delete(ENDPOINTS.SAVED_MEDICAL_FORM.DELETE(id, password));
    return data;
  },
  getByPatient: async (patientId: string) => {
    const { data } = await api.get(ENDPOINTS.SAVED_MEDICAL_FORM.GET_BY_PATIENT(patientId));
    return data;
  },
  handover: async (id: string, toUserId: string) => {
    const { data } = await api.post(ENDPOINTS.SAVED_MEDICAL_FORM.HANDOVER(id), { toUserId });
    return data;
  },
  getMyPendingHandovers: async () => {
    const { data } = await api.get(ENDPOINTS.SAVED_MEDICAL_FORM.GET_MY_PENDING_HANDOVERS);
    return data;
  },
  acknowledgeHandover: async (id: string) => {
    const { data } = await api.put(ENDPOINTS.SAVED_MEDICAL_FORM.ACKNOWLEDGE_HANDOVER(id));
    return data;
  },
};
