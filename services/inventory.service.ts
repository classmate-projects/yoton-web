import api from "@/lib/axios";
import type {
  Adjustment,
  AdjustmentSummary,
  BatchQuantityLine,
  CatalogMedicine,
  CreateAdjustmentPayload,
  CreateGoodsReceiptPayload,
  GoodsReceipt,
  GoodsReceiptSummary,
  InventoryDashboard,
  InventoryItem,
  InventoryLookups,
  InventoryStore,
  InventoryVendor,
  Issue,
  IssueSummary,
  LedgerRow,
  Paged,
  PatientUseItem,
  PatientUseRecord,
  PatientUseStore,
  PurchaseOrder,
  PurchaseOrderSummary,
  RecordPatientUsePayload,
  ReorderSuggestion,
  Requisition,
  RequisitionSummary,
  SaveInventoryItemPayload,
  SaveInventoryStorePayload,
  SaveInventoryVendorPayload,
  SavePurchaseOrderPayload,
  ServiceUsage,
  ServiceUsageSummary,
  StockCount,
  StockCountSummary,
  StockLot,
  StockRow,
  StockShortfall,
  Transfer,
  TransferSummary,
  VendorReturn,
  VendorReturnSummary,
} from "@/types/inventory.type";

const BASE = "/api/inventory";
type Query = Record<string, string | number | boolean | null | undefined>;

// Drops empty filters so the API sees only what was actually chosen.
const params = (q: Query) =>
  Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== ""));

const get = async <T>(path: string, q: Query = {}) => (await api.get(`${BASE}${path}`, { params: params(q) })).data as T;
const post = async <T>(path: string, body?: unknown) => (await api.post(`${BASE}${path}`, body ?? {})).data as T;
const put = async <T>(path: string, body?: unknown) => (await api.put(`${BASE}${path}`, body ?? {})).data as T;

type Data<T> = { data: T; message?: string };
type Message = { message: string };

export const InventoryService = {
  // ---------------- masters ----------------
  lookups: () => get<Data<InventoryLookups>>("/lookups"),

  // includeMedicines: also offer Pharmacy catalog medicines that aren't inventory items yet.
  items: (q: { search?: string; itemType?: string; category?: string; includeInactive?: boolean; includeMedicines?: boolean; page?: number; pageSize?: number } = {}) =>
    get<Paged<InventoryItem> & { catalogMedicines: CatalogMedicine[] | null }>("/items", q),
  item: (id: string) => get<Data<InventoryItem>>(`/items/${id}`),
  itemFromMedicine: (medicineId: string) => post<Data<InventoryItem>>(`/items/from-medicine/${medicineId}`),
  createItem: (payload: SaveInventoryItemPayload) => post<Data<InventoryItem>>("/items", payload),
  updateItem: (id: string, payload: SaveInventoryItemPayload) => put<Data<InventoryItem>>(`/items/${id}`, payload),
  deleteItem: async (id: string) => (await api.delete(`${BASE}/items/${id}`)).data as Message,
  scan: (code: string) =>
    get<Data<{ item: InventoryItem; batch: { batchId: string; storeId: string; batchNumber: string | null; expiryDate: string | null; unitCost: number; quantity: number } | null }>>("/scan", { code }),

  stores: (q: { includeInactive?: boolean; operableOnly?: boolean } = {}) => get<Data<InventoryStore[]>>("/stores", q),
  createStore: (payload: SaveInventoryStorePayload) => post<Data<{ storeId: string }>>("/stores", payload),
  updateStore: (id: string, payload: SaveInventoryStorePayload) => put<Data<{ storeId: string }>>(`/stores/${id}`, payload),
  levels: (storeId: string) =>
    get<Data<{ itemId: string; itemName: string; code: string; unit: string; reorderLevel: number; reorderQuantity: number }[]>>(`/stores/${storeId}/levels`),
  saveLevel: (storeId: string, itemId: string, reorderLevel: number, reorderQuantity: number) =>
    put<Message>(`/stores/${storeId}/levels/${itemId}`, { reorderLevel, reorderQuantity }),

  vendors: (q: { includeInactive?: boolean; search?: string } = {}) => get<Data<InventoryVendor[]>>("/vendors", q),
  createVendor: (payload: SaveInventoryVendorPayload) => post<Data<InventoryVendor>>("/vendors", payload),
  updateVendor: (id: string, payload: SaveInventoryVendorPayload) => put<Data<InventoryVendor>>(`/vendors/${id}`, payload),

  // ---------------- stock ----------------
  stock: (q: { storeId: string; search?: string; itemType?: string; category?: string; filter?: string; expiryDays?: number }) =>
    get<{ data: StockRow[]; totalValue: number }>("/stock", q),
  itemStock: (itemId: string) => get<Data<{ item: InventoryItem; lots: StockLot[] }>>(`/stock/items/${itemId}`),
  lots: (storeId: string, itemId: string, includeExpired = true) => get<Data<StockLot[]>>("/stock/lots", { storeId, itemId, includeExpired }),
  ledger: (q: { itemId?: string; storeId?: string; from?: string; to?: string; txnType?: string; page?: number; pageSize?: number }) =>
    get<Paged<LedgerRow>>("/ledger", q),
  dashboard: (q: { storeId?: string; expiryDays?: number } = {}) => get<Data<InventoryDashboard>>("/dashboard", q),
  reorder: (storeId: string) => get<Data<ReorderSuggestion[]>>("/reorder", { storeId }),

  // ---------------- purchasing ----------------
  purchaseOrders: (q: { status?: string; vendorId?: string; storeId?: string; search?: string; page?: number } = {}) =>
    get<Paged<PurchaseOrderSummary>>("/purchase-orders", q),
  purchaseOrder: (id: string) => get<Data<PurchaseOrder>>(`/purchase-orders/${id}`),
  createPurchaseOrder: (payload: SavePurchaseOrderPayload) => post<Data<PurchaseOrder>>("/purchase-orders", payload),
  updatePurchaseOrder: (id: string, payload: SavePurchaseOrderPayload) => put<Data<PurchaseOrder>>(`/purchase-orders/${id}`, payload),
  submitPurchaseOrder: (id: string) => post<Message>(`/purchase-orders/${id}/submit`),
  approvePurchaseOrder: (id: string) => post<Message>(`/purchase-orders/${id}/approve`),
  sendBackPurchaseOrder: (id: string, reason: string) => post<Message>(`/purchase-orders/${id}/send-back`, { reason }),
  cancelPurchaseOrder: (id: string, reason: string) => post<Message>(`/purchase-orders/${id}/cancel`, { reason }),
  closePurchaseOrder: (id: string, reason: string) => post<Message>(`/purchase-orders/${id}/close`, { reason }),
  purchaseOrdersFromReorder: (storeId: string, itemIds?: string[]) =>
    post<Data<{ created: { purchaseOrderId: string; number: string; vendorName: string; lineCount: number }[]; skipped: string[] }>>("/purchase-orders/from-reorder", { storeId, itemIds }),

  goodsReceipts: (q: { vendorId?: string; storeId?: string; search?: string; from?: string; to?: string; page?: number } = {}) =>
    get<Paged<GoodsReceiptSummary>>("/goods-receipts", q),
  goodsReceipt: (id: string) => get<Data<GoodsReceipt>>(`/goods-receipts/${id}`),
  createGoodsReceipt: (payload: CreateGoodsReceiptPayload) => post<Data<GoodsReceipt>>("/goods-receipts", payload),

  vendorReturns: (q: { vendorId?: string; storeId?: string; page?: number } = {}) => get<Paged<VendorReturnSummary>>("/vendor-returns", q),
  vendorReturn: (id: string) => get<Data<VendorReturn>>(`/vendor-returns/${id}`),
  createVendorReturn: (payload: { vendorId: string; storeId: string; goodsReceiptId?: string | null; reason: string; notes?: string | null; lines: BatchQuantityLine[] }) =>
    post<Data<VendorReturn>>("/vendor-returns", payload),

  // ---------------- movements ----------------
  requisitions: (q: { storeId?: string; status?: string; direction?: "incoming" | "outgoing"; page?: number } = {}) =>
    get<Paged<RequisitionSummary>>("/requisitions", q),
  requisition: (id: string) => get<Data<Requisition>>(`/requisitions/${id}`),
  createRequisition: (payload: { requestingStoreId: string; supplyingStoreId?: string | null; priority?: string; requiredDate?: string | null; notes?: string | null; lines: { itemId: string; quantity: number }[] }) =>
    post<Data<Requisition>>("/requisitions", payload),
  cancelRequisition: (id: string, reason: string) => post<Message>(`/requisitions/${id}/cancel`, { reason }),
  declineRequisition: (id: string, reason: string) => post<Message>(`/requisitions/${id}/decline`, { reason }),

  transfers: (q: { storeId?: string; status?: string; direction?: "incoming" | "outgoing"; page?: number } = {}) =>
    get<Paged<TransferSummary>>("/transfers", q),
  transfer: (id: string) => get<Data<Transfer>>(`/transfers/${id}`),
  createTransfer: (payload: { fromStoreId: string; toStoreId: string; requisitionId?: string | null; isReturn?: boolean; notes?: string | null; lines: (BatchQuantityLine & { requisitionLineId?: string | null })[] }) =>
    post<Data<Transfer>>("/transfers", payload),
  receiveTransfer: (id: string) => post<Message>(`/transfers/${id}/receive`),
  cancelTransfer: (id: string, reason: string) => post<Message>(`/transfers/${id}/cancel`, { reason }),

  issues: (q: { storeId?: string; departmentId?: string; kind?: "department" | "patient"; from?: string; to?: string; page?: number } = {}) =>
    get<Paged<IssueSummary>>("/issues", q),
  issue: (id: string) => get<Data<Issue>>(`/issues/${id}`),
  createIssue: (payload: { storeId: string; departmentId?: string | null; issuedTo?: string | null; purpose?: string | null; lines: BatchQuantityLine[] }) =>
    post<Data<Issue>>("/issues", payload),
  returnIssue: (id: string, lines: { issueLineId: string; quantity: number }[], reason?: string) => post<Data<Issue>>(`/issues/${id}/return`, { reason, lines }),

  // ---------------- control ----------------
  adjustments: (q: { storeId?: string; status?: string; kind?: string; page?: number } = {}) => get<Paged<AdjustmentSummary>>("/adjustments", q),
  adjustment: (id: string) => get<Data<Adjustment>>(`/adjustments/${id}`),
  createAdjustment: (payload: CreateAdjustmentPayload) => post<Data<Adjustment>>("/adjustments", payload),
  approveAdjustment: (id: string) => post<Message>(`/adjustments/${id}/approve`),
  declineAdjustment: (id: string, reason: string) => post<Message>(`/adjustments/${id}/decline`, { reason }),
  cancelAdjustment: (id: string, reason: string) => post<Message>(`/adjustments/${id}/cancel`, { reason }),

  counts: (q: { storeId?: string; status?: string; page?: number } = {}) => get<Paged<StockCountSummary>>("/counts", q),
  count: (id: string) => get<Data<StockCount>>(`/counts/${id}`),
  createCount: (payload: { storeId: string; itemType?: string | null; category?: string | null; notes?: string | null }) => post<Data<StockCount>>("/counts", payload),
  saveCountLines: (id: string, lines: { stockCountLineId: string; countedQuantity: number | null; remarks?: string | null }[]) =>
    put<Data<StockCount>>(`/counts/${id}/lines`, { lines }),
  submitCount: (id: string) => post<Message>(`/counts/${id}/submit`),
  approveCount: (id: string) => post<Message>(`/counts/${id}/approve`),
  sendBackCount: (id: string, reason: string) => post<Message>(`/counts/${id}/send-back`, { reason }),
  cancelCount: (id: string, reason: string) => post<Message>(`/counts/${id}/cancel`, { reason }),

  // ---------------- clinical use ----------------
  patientUseStores: () => get<Data<PatientUseStore[]>>("/patient-use/stores"),
  patientUseItems: (storeId: string, search?: string) => get<Data<PatientUseItem[]>>("/patient-use/items", { storeId, search }),
  patientUse: (patientId: string, visitId?: string | null) => get<Data<PatientUseRecord[]>>("/patient-use", { patientId, visitId }),
  recordPatientUse: (payload: RecordPatientUsePayload) => post<Data<PatientUseRecord>>("/patient-use", payload),
  returnPatientUse: (id: string, lines: { issueLineId: string; quantity: number }[], reason?: string) =>
    post<Data<PatientUseRecord>>(`/patient-use/${id}/return`, { reason, lines }),

  serviceUsages: (q: { search?: string; category?: string; configuredOnly?: boolean; page?: number; pageSize?: number } = {}) =>
    get<Paged<ServiceUsageSummary>>("/usage/services", q),
  serviceUsage: (listItemId: string) => get<Data<ServiceUsage>>(`/usage/services/${listItemId}`),
  saveServiceUsage: (listItemId: string, lines: { itemId: string; quantity: number }[]) =>
    put<Data<ServiceUsage>>(`/usage/services/${listItemId}`, { lines }),
  shortfalls: (q: { status?: "open" | "checked" | "all"; storeId?: string; page?: number } = {}) => get<Paged<StockShortfall>>("/usage/shortfalls", q),
  resolveShortfall: (id: string, note?: string) => post<Message>(`/usage/shortfalls/${id}/resolve`, { note }),

  // ---------------- reports ----------------
  report: <T>(name: "valuation" | "expiry" | "consumption" | "purchases" | "movement" | "non-moving", q: Query = {}) =>
    get<Data<T>>(`/reports/${name}`, q),
};
