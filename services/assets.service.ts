import api from "@/lib/axios";
import type { Paged, BatchQuantityLine, PatientUseItem } from "@/types/inventory.type";
import type { Asset, AssetDetail, AssetLookups, AssetOverview, SaveAssetPayload, WorkOrder, WorkOrderDetail, WorkOrderKind } from "@/types/assets.type";

const BASE = "/api/assets";
type Query = Record<string, string | number | boolean | null | undefined>;

// Drops empty filters so the API sees only what was actually chosen.
const params = (q: Query) =>
  Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== ""));

const get = async <T>(path: string, q: Query = {}) => (await api.get(`${BASE}${path}`, { params: params(q) })).data as T;
const post = async <T>(path: string, body?: unknown) => (await api.post(`${BASE}${path}`, body ?? {})).data as T;
const put = async <T>(path: string, body?: unknown) => (await api.put(`${BASE}${path}`, body ?? {})).data as T;

type Data<T> = { data: T; message?: string };
type Message = { message: string };

export const AssetsService = {
  lookups: () => get<Data<AssetLookups>>("/lookups"),
  overview: () => get<Data<AssetOverview>>("/overview"),

  // due: "maintenance" | "calibration" | "warranty"
  assets: (q: { search?: string; category?: string; status?: string; departmentId?: string; due?: string; page?: number; pageSize?: number } = {}) =>
    get<Paged<Asset>>("", q),
  asset: (id: string) => get<Data<AssetDetail>>(`/${id}`),
  scan: (code: string) => get<Data<AssetDetail>>("/scan", { code }),
  createAsset: (payload: SaveAssetPayload) => post<Data<AssetDetail>>("", payload),
  updateAsset: (id: string, payload: SaveAssetPayload) => put<Data<AssetDetail>>(`/${id}`, payload),
  moveAsset: (id: string, payload: { branchId: string | null; departmentId: string | null; location: string | null; custodianUserId: string | null; status?: string | null; note?: string | null }) =>
    post<Data<AssetDetail>>(`/${id}/move`, payload),
  reportFault: (id: string, payload: { problem: string; priority: "Normal" | "Urgent"; outOfService: boolean }) => post<Data<AssetDetail>>(`/${id}/report-fault`, payload),
  disposeAsset: (id: string, payload: { method: string; value: number | null; reason: string; disposedOn: string | null }) => post<Data<AssetDetail>>(`/${id}/dispose`, payload),

  workOrders: (q: { status?: string; kind?: string; assetId?: string; search?: string; page?: number } = {}) => get<Paged<WorkOrder>>("/work-orders", q),
  workOrder: (id: string) => get<Data<WorkOrderDetail>>(`/work-orders/${id}`),
  createWorkOrder: (payload: { assetId: string; kind: WorkOrderKind; priority: "Normal" | "Urgent"; problem: string; scheduledFor: string | null; assignedToUserId: string | null; vendorId: string | null }) =>
    post<Data<WorkOrderDetail>>("/work-orders", payload),
  startWorkOrder: (id: string) => post<Data<WorkOrderDetail>>(`/work-orders/${id}/start`),
  completeWorkOrder: (id: string, payload: { workDone: string; outcome: string; certificateNumber: string | null; serviceCost: number; completedOn: string | null; partsStoreId: string | null; parts: BatchQuantityLine[] }) =>
    post<Data<WorkOrderDetail>>(`/work-orders/${id}/complete`, payload),
  cancelWorkOrder: (id: string, reason: string) => post<Message>(`/work-orders/${id}/cancel`, { reason }),

  // Spare parts a store the caller runs has in stock.
  parts: (storeId: string, search?: string) => get<Data<PatientUseItem[]>>("/parts", { storeId, search }),

  report: <T>(name: "register" | "maintenance", q: Query = {}) => get<Data<T>>(`/reports/${name}`, q),
};
