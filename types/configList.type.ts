export type ConfigListType =
  | "Diagnosis"
  | "Investigation"
  | "Treatment"
  | "OrderType"
  | "Route"
  | "DosageUnit"
  | "Frequency";

export interface ListItemType {
  listItemId: string;
  listType: string;
  name: string;
  code: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface ListItemPayload {
  name: string;
  code?: string;
  sortOrder?: number;
}

export interface ListItemBulkUploadPayload {
  items: ListItemPayload[];
}
