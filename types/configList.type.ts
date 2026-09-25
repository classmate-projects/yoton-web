export type ConfigListType =
  | "Diagnosis"
  | "Investigation"
  | "Treatment"
  | "OrderType"
  | "Route"
  | "DosageUnit"
  | "Frequency"
  | "InsuranceProvider"
  | "DrugType"
  | "CancerSite"
  | "Procedure";

// "Lab" | "Radiology" | "Treatment" - which order type a ListType=Procedure catalog entry
// creates when added to a patient's file. See Helpers/OrderCategoryHelper.cs.
export type OrderCategory = "Lab" | "Radiology" | "Treatment";

export interface ListItemType {
  listItemId: string;
  listType: string;
  name: string;
  code: string | null;
  // ListType=Procedure only - null on every other list type.
  department: string | null;
  cashPrice: number | null;
  orderCategory: OrderCategory | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface ListItemPayload {
  name: string;
  code?: string;
  sortOrder?: number;
  department?: string;
  cashPrice?: number;
  orderCategory?: OrderCategory;
}

export interface ListItemBulkUploadPayload {
  items: ListItemPayload[];
}
