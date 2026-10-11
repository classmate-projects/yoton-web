export type OrderSetDto = {
  orderSetId: string;
  name: string;
  itemCount: number;
  updatedAt: string;
};

export type OrderSetItemDto = {
  orderSetItemId: string;
  itemType: "Diagnosis" | "Medication" | "Lab" | "Radiology" | "Treatment";
  listItemId?: string | null;
  displayName?: string | null;
  remarks?: string | null;
  priority?: string | null;
  // Medication fields
  drugName?: string | null;
  dosage?: string | null;
  dosageUnit?: string | null;
  frequency?: string | null;
  durationDays?: number | null;
  orderType?: string | null;
  route?: string | null;
  instructions?: string | null;
  drugType?: string | null;
  mealTiming?: string | null;
  totalQuantity?: number | null;
  refillCount?: number | null;
  prnReason?: string | null;
  requiresCounselling?: boolean;
  medicineId?: string | null;
};

export type OrderSetApplicationDto = {
  applicationId: string;
  orderSetId: string;
  orderSetName: string;
  appliedAt: string;
  isReverted: boolean;
};
