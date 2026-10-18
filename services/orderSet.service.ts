import api from "@/lib/axios";
import { OrderSetApplicationDto, OrderSetDto, OrderSetItemDto } from "@/types/orderSet.type";

const BASE = "/api/order-sets";

export async function getOrderSets(): Promise<OrderSetDto[]> {
  const res = await api.get(BASE);
  return res.data.data;
}

export async function createOrderSet(name: string): Promise<OrderSetDto> {
  const res = await api.post(BASE, { name });
  return res.data.data;
}

export async function deleteOrderSet(id: string): Promise<void> {
  await api.delete(`${BASE}/${id}`);
}

export async function getOrderSetItems(id: string): Promise<OrderSetItemDto[]> {
  const res = await api.get(`${BASE}/${id}/items`);
  return res.data.data;
}

export async function saveOrderSetItems(id: string, items: OrderSetItemDto[]): Promise<void> {
  await api.put(`${BASE}/${id}/items`, { items });
}

export async function applyOrderSet(
  id: string,
  patientId: string,
  encounterId: string,
  visitId?: string | null
): Promise<{ applicationId: string }> {
  const res = await api.post(`${BASE}/${id}/apply`, { patientId, encounterId, visitId });
  return res.data.data;
}

export async function getApplicationsForEncounter(encounterId: string): Promise<OrderSetApplicationDto[]> {
  const res = await api.get(`${BASE}/applications`, { params: { encounterId } });
  return res.data.data;
}

export async function revertApplication(applicationId: string, password: string): Promise<void> {
  await api.post(`${BASE}/applications/${applicationId}/revert`, { password });
}
