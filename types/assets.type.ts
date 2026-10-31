// Mirrors the Assets & maintenance API (yoton-api/Controllers/AssetsController.cs).

export type AssetCategory = "MedicalEquipment" | "Furniture" | "ITEquipment" | "Vehicle" | "Other";
export type AssetStatus = "InUse" | "InStore" | "UnderMaintenance" | "OutOfService" | "Disposed";
export type WorkOrderKind = "Preventive" | "Repair" | "Calibration";
export type WorkOrderStatus = "Open" | "InProgress" | "Completed" | "Cancelled";

export interface AssetLookups {
  categories: AssetCategory[];
  statuses: AssetStatus[];
  workOrderKinds: WorkOrderKind[];
  disposalMethods: string[];
  departments: { departmentId: string; name: string }[];
  branches: { branchId: string; name: string }[];
  staff: { userId: string; name: string; role: string; departmentId: string | null }[];
  vendors: { vendorId: string; name: string }[];
  // Stores the caller can take spare parts from.
  partsStores: { storeId: string; name: string }[];
  // The Assets module (admin always): runs the register and work orders.
  isAssetTeam: boolean;
  isAdmin: boolean;
  myDepartmentId: string | null;
}

export interface Asset {
  assetId: string;
  assetTag: string;
  name: string;
  category: AssetCategory;
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  branchId: string | null;
  branchName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  location: string | null;
  custodianUserId: string | null;
  custodianName: string | null;
  status: AssetStatus;
  vendorId: string | null;
  vendorName: string | null;
  purchaseDate: string | null;
  purchaseCost: number;
  invoiceNumber: string | null;
  usefulLifeYears: number | null;
  salvageValue: number;
  accumulatedDepreciation: number;
  bookValue: number;
  warrantyEndDate: string | null;
  underWarranty: boolean;
  serviceVendorId: string | null;
  serviceVendorName: string | null;
  warrantyTerms: string | null;
  maintenanceIntervalDays: number | null;
  lastMaintainedOn: string | null;
  nextMaintenanceDue: string | null;
  maintenanceDueInDays: number | null;
  requiresCalibration: boolean;
  calibrationIntervalDays: number | null;
  lastCalibratedOn: string | null;
  nextCalibrationDue: string | null;
  calibrationDueInDays: number | null;
  notes: string | null;
  disposedOn: string | null;
  disposalMethod: string | null;
  disposalValue: number | null;
  disposalReason: string | null;
  disposedByName: string | null;
  openWorkOrders: number;
  createdAt: string;
}

export interface SaveAssetPayload {
  assetTag: string;
  name: string;
  category: AssetCategory;
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  branchId: string | null;
  departmentId: string | null;
  location: string | null;
  custodianUserId: string | null;
  status?: AssetStatus;
  vendorId: string | null;
  purchaseDate: string | null;
  purchaseCost: number;
  invoiceNumber: string | null;
  usefulLifeYears: number | null;
  salvageValue: number;
  warrantyEndDate: string | null;
  serviceVendorId: string | null;
  warrantyTerms: string | null;
  maintenanceIntervalDays: number | null;
  nextMaintenanceDue: string | null;
  requiresCalibration: boolean;
  calibrationIntervalDays: number | null;
  nextCalibrationDue: string | null;
  notes: string | null;
}

export interface AssetEvent {
  eventId: string;
  eventType: "Registered" | "Updated" | "Moved" | "StatusChanged" | "FaultReported" | "Serviced" | "Calibrated" | "Repaired" | "Disposed";
  details: string;
  workOrderId: string | null;
  userName: string | null;
  createdAt: string;
}

export interface WorkOrder {
  workOrderId: string;
  number: string;
  assetId: string;
  assetTag: string | null;
  assetName: string | null;
  departmentName: string | null;
  kind: WorkOrderKind;
  status: WorkOrderStatus;
  priority: "Normal" | "Urgent";
  problem: string;
  scheduledFor: string | null;
  assignedToUserId: string | null;
  assignedToName: string | null;
  vendorId: string | null;
  vendorName: string | null;
  reportedByName: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  completedByName: string | null;
  workDone: string | null;
  outcome: "Working" | "NotWorking" | "Pass" | "Fail" | null;
  certificateNumber: string | null;
  serviceCost: number;
  partsCost: number;
  totalCost: number;
  issueId: string | null;
  cancelReason: string | null;
}

export interface AssetDetail {
  asset: Asset;
  events: AssetEvent[];
  workOrders: WorkOrder[];
}

export interface WorkOrderDetail {
  workOrder: WorkOrder;
  asset: Asset | null;
  parts: { issueId: string; number: string; storeName: string | null; lines: { itemName: string; unit: string; batchNumber: string | null; quantity: number; returnedQuantity: number; unitCost: number; value: number }[] } | null;
}

export interface AssetOverview {
  totalAssets: number;
  inUse: number;
  underMaintenance: number;
  outOfService: number;
  bookValue: number;
  openWorkOrders: number;
  urgentWorkOrders: number;
  dueWindowDays: number;
  warrantyWindowDays: number;
  maintenanceDue: { asset: Asset; scheduled: boolean }[];
  calibrationDue: { asset: Asset; scheduled: boolean }[];
  warrantyEnding: Asset[];
  workOrders: WorkOrder[];
}
