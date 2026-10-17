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
  discount: number;
  tax: number;
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
