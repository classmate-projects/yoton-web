import api from "@/lib/axios";
import { ENDPOINTS } from "@/lib/endpoints";
import {
  AdministerVaccinePayload,
  RecordPastDosePayload,
  SaveVaccinePayload,
  ScheduleVaccinationPayload,
  UpdateVaccinationOrderPayload,
} from "@/types/immunization.type";

// Every write carries the browser's timezone offset, so the API judges "today" (past dates,
// expired batches, overdue doses) on the user's own calendar day rather than UTC's.
const tz = () => ({ tzOffsetMinutes: new Date().getTimezoneOffset() });

export const ImmunizationService = {
  getVaccines: async (includeInactive?: boolean) => {
    const { data } = await api.get(ENDPOINTS.IMMUNIZATION.GET_VACCINES(includeInactive));
    return data;
  },
  createVaccine: async (payload: SaveVaccinePayload) => {
    const { data } = await api.post(ENDPOINTS.IMMUNIZATION.CREATE_VACCINE, payload);
    return data;
  },
  updateVaccine: async (vaccineId: string, payload: SaveVaccinePayload) => {
    const { data } = await api.put(ENDPOINTS.IMMUNIZATION.UPDATE_VACCINE(vaccineId), payload);
    return data;
  },
  deleteVaccine: async (vaccineId: string) => {
    const { data } = await api.delete(ENDPOINTS.IMMUNIZATION.DELETE_VACCINE(vaccineId));
    return data;
  },
  getSchedule: async (patientId: string) => {
    const { data } = await api.get(ENDPOINTS.IMMUNIZATION.GET_SCHEDULE(patientId));
    return data;
  },
  scheduleVaccination: async (patientId: string, payload: ScheduleVaccinationPayload, doctorId?: string) => {
    const { data } = await api.post(ENDPOINTS.IMMUNIZATION.SCHEDULE_VACCINATION(patientId, doctorId), { ...payload, ...tz() });
    return data;
  },
  updateOrder: async (orderId: string, payload: UpdateVaccinationOrderPayload, doctorId?: string) => {
    const { data } = await api.put(ENDPOINTS.IMMUNIZATION.UPDATE_ORDER(orderId, doctorId), { ...payload, ...tz() });
    return data;
  },
  cancelOrder: async (orderId: string, reason: string, doctorId?: string) => {
    const { data } = await api.put(ENDPOINTS.IMMUNIZATION.CANCEL_ORDER(orderId, doctorId), { reason, ...tz() });
    return data;
  },
  recordMissedDose: async (patientId: string, payload: { vaccineId: string; doseNumber: number; reason: string }, doctorId?: string) => {
    const { data } = await api.post(ENDPOINTS.IMMUNIZATION.RECORD_MISSED_DOSE(patientId, doctorId), { ...payload, ...tz() });
    return data;
  },
  administer: async (orderId: string, payload: AdministerVaccinePayload) => {
    const { data } = await api.post(ENDPOINTS.IMMUNIZATION.ADMINISTER(orderId), { ...payload, ...tz() });
    return data;
  },
  undoAdministration: async (orderId: string, reason: string, password: string) => {
    const { data } = await api.put(ENDPOINTS.IMMUNIZATION.UNDO_ADMINISTRATION(orderId), { reason, password, ...tz() });
    return data;
  },
  markMissed: async (orderId: string, reason: string) => {
    const { data } = await api.put(ENDPOINTS.IMMUNIZATION.MARK_MISSED(orderId), { reason, ...tz() });
    return data;
  },
  recordPastDose: async (patientId: string, payload: RecordPastDosePayload) => {
    const { data } = await api.post(ENDPOINTS.IMMUNIZATION.RECORD_PAST_DOSE(patientId), { ...payload, ...tz() });
    return data;
  },
  recordPrint: async (patientId: string) => {
    const { data } = await api.post(ENDPOINTS.IMMUNIZATION.RECORD_PRINT(patientId));
    return data;
  },
  getReminders: async (doctorId?: string) => {
    const { data } = await api.get(ENDPOINTS.IMMUNIZATION.GET_REMINDERS(doctorId));
    return data;
  },
};
