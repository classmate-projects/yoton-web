export interface BillItemType {
  billItemId: string;
  description: string | null;
  amount: number;
  sourceType: string;
  sourceId: string | null;
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
  netAmount: number;
  status: string;
  paymentMethod: string | null;
  paymentDate: string | null;
  createdAt: string;
  items: BillItemType[];
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
  amount: number;
}

export interface ChargeableItemType {
  sourceType: string; // Prescription, LabRequest, RadiologyRequest
  sourceId: string;
  description: string;
  suggestedAmount: number;
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
