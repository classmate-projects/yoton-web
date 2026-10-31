// Mirrors Yoton-API's BillItemCategories.
export const BILL_ITEM_CATEGORIES = ["Consultation", "Pharmacy", "Lab", "Radiology", "Procedure", "Consumables", "Other"] as const;
export type BillItemCategory = (typeof BILL_ITEM_CATEGORIES)[number];

export interface BillItemType {
  billItemId: string;
  description: string | null;
  amount: number; // line total: gross - discount + tax
  sourceType: string;
  sourceId: string | null;
  quantity: number;
  unitPrice: number;
  grossAmount: number; // quantity x unitPrice
  discountPercent: number; // the line's own discount (the bill discount comes on top)
  discountAmount: number; // line's own discount + its share of the bill discount
  taxPercent: number;
  taxAmount: number;
  category: BillItemCategory;
  serviceCode: string | null; // GST SAC/HSN
  isRemoved: boolean; // kept for the record, excluded from totals
  removedReason: string | null;
  removedAt: string | null;
  adjustedReason: string | null;
  adjustedAt: string | null;
}

export interface BillType {
  billId: string;
  patientId: string | null;
  patientName: string;
  appointmentId: string | null;
  visitId: string | null;
  totalAmount: number;
  discount: number;
  tax: number;
  discountPercent: number | null; // null on older flat-amount bills
  taxPercent: number | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  netAmount: number;
  status: string;
  paymentMethod: string | null;
  paymentDate: string | null;
  createdAt: string;
  items: BillItemType[];
}

// Money owed back on a paid bill when items were returned after payment.
export interface BillRefundType {
  refundId: string;
  billId: string;
  billItemId: string;
  description: string;
  quantity: number;
  amount: number;
  reason: string;
  status: "Due" | "PaidOut";
  requestedByName: string | null;
  createdAt: string;
  paymentMethod: string | null;
  paidOutAt: string | null;
  paidOutByName: string | null;
}

export interface BillingSummaryType {
  pendingCount: number;
  pendingAmount: number;
  paidToday: number;
  revenueToday: number;
}

export interface CreateBillPayload {
  patientId: string;
  appointmentId?: string;
  visitId?: string;
  discountPercent: number; // 0-100, off the item total
  taxPercent: number; // 0-100, on the discounted amount
}

export interface AddBillItemPayload {
  billId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
  category: BillItemCategory;
  serviceCode?: string;
}

// Adjusting a line on a pending bill - all fields are the new values; reason required.
export interface UpdateBillItemPayload {
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
  category: BillItemCategory;
  serviceCode?: string;
  reason: string;
}

export interface ChargeableItemType {
  sourceType: string; // Prescription, LabRequest, RadiologyRequest, Medication, Treatment
  sourceId: string;
  description: string;
  suggestedAmount: number;
  status?: string | null; // the order's own status - walk-in items can be billed before they're done
  orderedAt?: string | null;
}

// A patient with walk-in (external service) orders not on a bill yet - Billing's Walk-in list.
export interface WalkInAwaitingType {
  patientId: string;
  patientName: string;
  patientOPNumber: string | null;
  phone: string | null;
  registrationType: "Full" | "External";
  itemCount: number;
  suggestedTotal: number;
  departments: string[]; // Lab, Radiology, Pharmacy
  latestOrderAt: string;
  openBill: BillType | null;
}

export interface AwaitingBillingItemType {
  visitId: string;
  patientId: string;
  patientName: string;
  checkedInAt: string;
  visitType: string;
  bill: BillType | null;
}

export interface AddBillItemFromSourcePayload {
  billId: string;
  sourceType: string;
  sourceId: string;
}
