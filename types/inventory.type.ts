// Mirrors the Inventory API (yoton-api/Controllers/Inventory*Controller.cs). Quantities are in
// the item's base unit except on purchase orders and goods receipts, which use its purchase
// unit (e.g. Box of 100).

export type InventoryItemType = "Medicine" | "Consumable" | "Laboratory" | "Radiology" | "Surgical" | "General";
export type InventoryStoreType = "Main" | "Pharmacy" | "Laboratory" | "Radiology" | "Ward" | "OperatingTheatre" | "Department";

export interface InventoryLookups {
  departments: { departmentId: string; name: string }[];
  branches: { branchId: string; name: string; isMain: boolean }[];
  staff: { userId: string; name: string; role: string; departmentId: string | null }[];
  categories: string[];
  itemTypes: InventoryItemType[];
  storeTypes: InventoryStoreType[];
  // Store team = admin or the Inventory module (every store, purchasing, approvals).
  isStoreTeam: boolean;
  isAdmin: boolean;
  myDepartmentId: string | null;
  taxApplies: boolean;
}

export interface InventoryItem {
  itemId: string;
  code: string;
  name: string;
  itemType: InventoryItemType;
  category: string | null;
  description: string | null;
  unit: string;
  purchaseUnit: string | null;
  unitsPerPurchaseUnit: number;
  trackBatch: boolean;
  trackExpiry: boolean;
  barcode: string | null;
  reorderLevel: number;
  reorderQuantity: number;
  defaultVendorId: string | null;
  defaultVendorName: string | null;
  lastPurchaseCost: number;
  sellingPrice: number;
  taxPercent: number;
  isBillable: boolean;
  serviceCode: string | null;
  medicineId: string | null;
  isActive: boolean;
  totalStock: number;
  createdAt: string;
}

export type SaveInventoryItemPayload = Omit<
  InventoryItem,
  "itemId" | "defaultVendorName" | "lastPurchaseCost" | "medicineId" | "totalStock" | "createdAt"
>;

export interface InventoryStore {
  storeId: string;
  name: string;
  storeType: InventoryStoreType;
  branchId: string | null;
  branchName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  supplyingStoreId: string | null;
  supplyingStoreName: string | null;
  managerUserId: string | null;
  managerName: string | null;
  isActive: boolean;
  stockValue: number;
  canOperate: boolean;
  canApprove: boolean;
}

export interface SaveInventoryStorePayload {
  name: string;
  storeType: InventoryStoreType;
  branchId: string | null;
  departmentId: string | null;
  supplyingStoreId: string | null;
  managerUserId: string | null;
  isActive: boolean;
}

export interface InventoryVendor {
  vendorId: string;
  name: string;
  code: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxRegistrationNumber: string | null;
  paymentTermsDays: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export type SaveInventoryVendorPayload = Omit<InventoryVendor, "vendorId" | "createdAt">;

export interface StockRow {
  storeId: string;
  storeName: string;
  itemId: string;
  code: string;
  name: string;
  itemType: InventoryItemType;
  category: string | null;
  unit: string;
  // The pack it's bought in (a Box of 10) - stock reads as whole packs plus loose units.
  packUnit: string | null;
  packSize: number;
  quantity: number;
  value: number;
  reorderLevel: number;
  reorderQuantity: number;
  isLow: boolean;
  nextExpiry: string | null;
  expiringQuantity: number;
  expiredQuantity: number;
  lotCount: number;
}

export interface StockLot {
  batchId: string;
  storeId: string;
  storeName: string | null;
  itemId: string;
  batchNumber: string | null;
  expiryDate: string | null;
  unitCost: number;
  quantity: number;
  value: number;
  receivedAt: string;
  isExpired: boolean;
  daysToExpiry: number | null;
}

export type StockTxnType =
  | "Opening" | "Receipt" | "VendorReturn" | "TransferOut" | "TransferIn" | "Issue" | "IssueReturn"
  | "AdjustmentIn" | "AdjustmentOut" | "WriteOff" | "CountGain" | "CountLoss" | "Dispense" | "PatientUse";

export interface LedgerRow {
  transactionId: string;
  createdAt: string;
  storeId: string;
  storeName: string | null;
  itemId: string;
  itemName: string | null;
  unit: string | null;
  batchId: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  txnType: StockTxnType;
  quantity: number;
  unitCost: number;
  value: number;
  balanceAfter: number;
  documentType: string;
  documentId: string;
  documentNumber: string;
  departmentName: string | null;
  counterpartStoreName: string | null;
  vendorName: string | null;
  reason: string | null;
  userName: string | null;
}

export interface PendingApproval {
  kind: "purchaseOrder" | "adjustment" | "stockCount";
  id: string;
  number: string;
  storeName: string | null;
  raisedBy: string | null;
  raisedAt: string;
  total: number | null;
  detail: string | null;
  canApprove: boolean;
}

export interface InventoryDashboard {
  stockValue: number;
  itemsInStock: number;
  lowStockCount: number;
  expiringCount: number;
  expiredCount: number;
  pendingApprovals: number;
  openRequisitions: number;
  inTransitTransfers: number;
  // Stock used on patients that a store didn't have on record (store team only).
  openShortfalls: number;
  expiryDays: number;
  lowStock: StockRow[];
  expiring: { lot: StockLot; itemName: string | null; unit: string | null }[];
  approvals: PendingApproval[];
  recent: LedgerRow[];
}

export interface ReorderSuggestion {
  itemId: string;
  code: string;
  name: string;
  unit: string;
  purchaseUnit: string | null;
  unitsPerPurchaseUnit: number;
  quantity: number;
  reorderLevel: number;
  reorderQuantity: number;
  suggestedQuantity: number;
  suggestedPurchaseQuantity: number;
  defaultVendorId: string | null;
  defaultVendorName: string | null;
  lastPurchaseCost: number;
}

// ---------------- purchasing ----------------

export type PurchaseOrderStatus = "Draft" | "PendingApproval" | "Approved" | "PartiallyReceived" | "Received" | "Closed" | "Cancelled";

export interface PurchaseOrderSummary {
  purchaseOrderId: string;
  number: string;
  vendorId: string;
  vendorName: string;
  storeId: string;
  storeName: string | null;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDate: string | null;
  total: number;
  lineCount: number;
  createdByName: string | null;
  createdAt: string;
  approvedByName: string | null;
  approvedAt: string | null;
}

export interface PurchaseOrderLine {
  purchaseOrderLineId: string;
  itemId: string;
  itemName: string;
  unit: string;
  unitsPerPurchaseUnit: number;
  quantity: number;
  unitCost: number;
  taxPercent: number;
  lineValue: number;
  taxAmount: number;
  receivedQuantity: number;
  outstanding: number;
}

export interface PurchaseOrder extends PurchaseOrderSummary {
  notes: string | null;
  subtotal: number;
  taxTotal: number;
  createdByUserId: string | null;
  submittedAt: string | null;
  rejectionReason: string | null;
  closedByName: string | null;
  closedAt: string | null;
  closeReason: string | null;
  canApprove: boolean;
  lines: PurchaseOrderLine[];
  receipts: { goodsReceiptId: string; number: string; receivedDate: string; total: number; receivedByName: string | null }[];
}

export interface SavePurchaseOrderPayload {
  vendorId: string;
  storeId: string;
  orderDate?: string | null;
  expectedDate?: string | null;
  notes?: string | null;
  submit: boolean;
  lines: { itemId: string; quantity: number; unitCost: number; taxPercent: number }[];
}

export interface GoodsReceiptSummary {
  goodsReceiptId: string;
  number: string;
  purchaseOrderId: string | null;
  purchaseOrderNumber: string | null;
  vendorId: string;
  vendorName: string;
  storeId: string;
  storeName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  receivedDate: string;
  total: number;
  receivedByName: string | null;
  createdAt: string;
}

export interface GoodsReceipt extends GoodsReceiptSummary {
  notes: string | null;
  subtotal: number;
  taxTotal: number;
  lines: {
    goodsReceiptLineId: string;
    purchaseOrderLineId: string | null;
    itemId: string;
    itemName: string;
    unit: string;
    unitsPerPurchaseUnit: number;
    quantity: number;
    freeQuantity: number;
    unitCost: number;
    taxPercent: number;
    lineValue: number;
    taxAmount: number;
    batchNumber: string | null;
    expiryDate: string | null;
    batchId: string | null;
  }[];
}

export interface CreateGoodsReceiptPayload {
  purchaseOrderId?: string | null;
  vendorId?: string | null;
  storeId?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  receivedDate?: string | null;
  notes?: string | null;
  lines: {
    purchaseOrderLineId?: string | null;
    itemId?: string | null;
    quantity: number;
    freeQuantity: number;
    unitCost?: number | null;
    taxPercent?: number | null;
    batchNumber?: string | null;
    expiryDate?: string | null;
  }[];
}

export interface VendorReturnSummary {
  vendorReturnId: string;
  number: string;
  vendorId: string;
  vendorName: string;
  storeId: string;
  storeName: string | null;
  reason: string;
  total: number;
  createdByName: string | null;
  createdAt: string;
}

export interface VendorReturn extends VendorReturnSummary {
  goodsReceiptId: string | null;
  notes: string | null;
  lines: { vendorReturnLineId: string; itemId: string; itemName: string; unit: string; batchId: string; batchNumber: string | null; expiryDate: string | null; quantity: number; unitCost: number; lineValue: number }[];
}

// ---------------- movements ----------------

export type RequisitionStatus = "Submitted" | "PartiallyIssued" | "Issued" | "Rejected" | "Cancelled";

export interface RequisitionSummary {
  requisitionId: string;
  number: string;
  requestingStoreId: string;
  requestingStoreName: string | null;
  supplyingStoreId: string;
  supplyingStoreName: string | null;
  status: RequisitionStatus;
  priority: "Normal" | "Urgent";
  requiredDate: string | null;
  lineCount: number;
  requestedByName: string | null;
  createdAt: string;
}

export interface Requisition extends Omit<RequisitionSummary, "lineCount"> {
  notes: string | null;
  closedByName: string | null;
  closedAt: string | null;
  closeReason: string | null;
  canSupply: boolean;
  canCancel: boolean;
  lines: { requisitionLineId: string; itemId: string; itemName: string; unit: string; requestedQuantity: number; issuedQuantity: number; outstanding: number; availableAtSupplier: number }[];
  transfers: { transferId: string; number: string; status: TransferStatus; dispatchedAt: string; dispatchedByName: string | null }[];
}

export type TransferStatus = "InTransit" | "Received" | "Cancelled";

export interface TransferSummary {
  transferId: string;
  number: string;
  fromStoreId: string;
  fromStoreName: string | null;
  toStoreId: string;
  toStoreName: string | null;
  requisitionNumber: string | null;
  status: TransferStatus;
  isReturn: boolean;
  total: number;
  dispatchedByName: string | null;
  dispatchedAt: string;
  completedByName: string | null;
  completedAt: string | null;
  canReceive: boolean;
}

export interface Transfer extends TransferSummary {
  requisitionId: string | null;
  notes: string | null;
  cancelReason: string | null;
  canCancel: boolean;
  lines: { transferLineId: string; itemId: string; itemName: string; unit: string; sourceBatchId: string; destinationBatchId: string | null; batchNumber: string | null; expiryDate: string | null; unitCost: number; quantity: number; value: number }[];
}

// What posted an issue automatically; null when entered by hand.
export type IssueSource = "Prescription" | "Medication" | "MedicationAdministration" | "LabRequest" | "RadiologyRequest" | "Treatment";

export interface IssueSummary {
  issueId: string;
  number: string;
  storeId: string;
  storeName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  issuedTo: string | null;
  purpose: string | null;
  total: number;
  issuedByName: string | null;
  createdAt: string;
  // Set when the stock was used on, or dispensed to, a patient.
  patientId: string | null;
  patientName: string | null;
  sourceType: IssueSource | null;
  sourceLabel: string;
}

export interface Issue extends IssueSummary {
  visitId: string | null;
  sourceId: string | null;
  // The bill a return would change, if any - returns wait until Billing removes the line.
  billId: string | null;
  billStatus: string | null;
  lines: { issueLineId: string; itemId: string; itemName: string; unit: string; batchId: string; batchNumber: string | null; expiryDate: string | null; unitCost: number; quantity: number; returnedQuantity: number; isBillable: boolean; unitPrice: number; value: number }[];
}

// A quantity of an item, from a named lot or first-expiry-first-out.
export interface BatchQuantityLine {
  itemId: string;
  batchId?: string | null;
  quantity: number;
}

// ---------------- control ----------------

export type AdjustmentKind = "Opening" | "Adjustment" | "WriteOff";
export type AdjustmentStatus = "PendingApproval" | "Posted" | "Rejected" | "Cancelled";

export interface AdjustmentSummary {
  adjustmentId: string;
  number: string;
  storeId: string;
  storeName: string | null;
  kind: AdjustmentKind;
  reason: string;
  status: AdjustmentStatus;
  total: number;
  createdByName: string | null;
  createdAt: string;
  decidedByName: string | null;
  decidedAt: string | null;
}

export interface Adjustment extends AdjustmentSummary {
  disposalMethod: string | null;
  witnessName: string | null;
  notes: string | null;
  createdByUserId: string | null;
  decisionReason: string | null;
  canApprove: boolean;
  lines: { adjustmentLineId: string; itemId: string; itemName: string; unit: string; quantityChange: number; batchId: string | null; batchNumber: string | null; expiryDate: string | null; unitCost: number; lineValue: number }[];
}

export interface CreateAdjustmentPayload {
  storeId: string;
  kind: AdjustmentKind;
  reason: string;
  disposalMethod?: string | null;
  witnessName?: string | null;
  notes?: string | null;
  lines: { itemId: string; batchId?: string | null; quantityChange: number; batchNumber?: string | null; expiryDate?: string | null; unitCost?: number | null }[];
}

export type StockCountStatus = "InProgress" | "PendingApproval" | "Posted" | "Cancelled";

export interface StockCountSummary {
  stockCountId: string;
  number: string;
  storeId: string;
  storeName: string | null;
  itemTypeFilter: string | null;
  categoryFilter: string | null;
  status: StockCountStatus;
  lineCount: number;
  countedLines: number;
  varianceValue: number;
  createdByName: string | null;
  createdAt: string;
  decidedByName: string | null;
  decidedAt: string | null;
}

export interface StockCount extends Omit<StockCountSummary, "lineCount" | "countedLines"> {
  notes: string | null;
  createdByUserId: string | null;
  submittedAt: string | null;
  decisionReason: string | null;
  canApprove: boolean;
  lines: { stockCountLineId: string; itemId: string; itemName: string; unit: string; batchId: string; batchNumber: string | null; expiryDate: string | null; unitCost: number; systemQuantity: number; currentQuantity: number; countedQuantity: number | null; variance: number | null; remarks: string | null }[];
}

export interface Paged<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------- clinical use ----------------

// A Pharmacy catalog medicine that isn't an inventory item yet (offered by the item search).
export interface CatalogMedicine {
  medicineId: string;
  name: string | null;
  genericName: string | null;
  dosageForm: string | null;
  code: string | null;
  price: number;
}

export interface PatientUseStore {
  storeId: string;
  name: string;
  storeType: InventoryStoreType;
}

// An item a store has that can be used on a patient (not expired).
export interface PatientUseItem {
  itemId: string;
  code: string;
  name: string;
  unit: string;
  itemType: InventoryItemType;
  isBillable: boolean;
  sellingPrice: number;
  quantity: number;
}

// Something the patient's care took from stock.
export interface PatientUseRecord {
  issueId: string;
  number: string;
  storeId: string;
  storeName: string;
  departmentName: string | null;
  purpose: string | null;
  visitId: string | null;
  sourceType: IssueSource | null;
  sourceLabel: string;
  issuedByName: string | null;
  createdAt: string;
  billId: string | null;
  billStatus: string | null;
  // What the patient is charged for it (billable items, net of returns).
  charge: number;
  canReturn: boolean;
  lines: { issueLineId: string; itemId: string; itemName: string; unit: string; batchNumber: string | null; expiryDate: string | null; quantity: number; returnedQuantity: number; isBillable: boolean; unitPrice: number }[];
}

export interface RecordPatientUsePayload {
  storeId: string;
  patientId: string;
  visitId?: string | null;
  notes?: string | null;
  lines: BatchQuantityLine[];
}

// A catalog test, scan or procedure, and how many items it uses up.
export interface ServiceUsageSummary {
  listItemId: string;
  name: string;
  code: string | null;
  category: string;
  itemCount: number;
}

export interface ServiceUsage {
  listItemId: string;
  name: string;
  code: string | null;
  category: string;
  lines: { itemId: string; code: string; name: string; unit: string; quantity: number; isActive: boolean }[];
}

// Stock used on a patient that the store didn't have on record.
export interface StockShortfall {
  shortfallId: string;
  storeId: string | null;
  storeName: string | null;
  itemId: string;
  itemName: string;
  unit: string;
  quantity: number;
  reason: string;
  sourceType: IssueSource;
  sourceLabel: string;
  patientId: string | null;
  patientName: string | null;
  issueId: string | null;
  userName: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByName: string | null;
  resolutionNote: string | null;
}
