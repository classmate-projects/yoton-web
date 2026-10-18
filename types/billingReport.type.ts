// Shape of GET /api/BillingReports (BillingReportController). Money values are plain
// numbers in the company currency; revenue excludes tax.

export interface MethodSplit {
  [method: string]: number;
}

export interface BillingReportType {
  from: string;
  to: string;
  generatedAt: string;
  collection: {
    totalBills: number;
    totalAmount: number;
    byMethod: { method: string; count: number; amount: number }[];
    byCashier: { cashier: string; count: number; amount: number; methods: MethodSplit }[];
    byDay: { date: string; count: number; amount: number; methods: MethodSplit }[];
    payments: { billId: string; patientName: string; paidAt: string; method: string; cashier: string; amount: number }[];
  };
  outstanding: {
    totalBills: number;
    totalAmount: number;
    ageing: { bucket: string; count: number; amount: number }[];
    bills: { billId: string; patientName: string; createdAt: string; ageDays: number; itemCount: number; amount: number }[];
  };
  cancellations: {
    cancelledCount: number;
    cancelledAmount: number;
    removedCount: number;
    removedAmount: number;
    bills: { billId: string; patientName: string; cancelledAt: string; cancelledBy: string; reason: string; amount: number }[];
    removedLines: {
      billId: string;
      patientName: string;
      description: string | null;
      removedAt: string;
      removedBy: string;
      reason: string;
      amount: number;
    }[];
  };
  discounts: {
    billCount: number;
    totalDiscount: number;
    totalGross: number;
    byUser: { user: string; count: number; amount: number }[];
    bills: {
      billId: string;
      patientName: string;
      paidAt: string;
      grossAmount: number;
      billDiscountPercent: number | null;
      lineDiscountCount: number;
      discount: number;
      netAmount: number;
      givenBy: string;
      lineDiscountBy: string;
    }[];
  };
  revenue: {
    totalRevenue: number;
    byDepartment: { department: string; bills: number; revenue: number }[];
    byDoctor: { doctor: string; department: string; bills: number; revenue: number }[];
    byCategory: { category: string; lines: number; revenue: number }[];
    byService: { service: string; category: string; quantity: number; revenue: number }[];
  };
  gst: {
    taxableValue: number;
    totalTax: number;
    byRate: { rate: number | null; lines: number; taxableValue: number; tax: number; cgst: number; sgst: number; total: number }[];
    byCode: { code: string; category: string; rate: number; quantity: number; taxableValue: number; tax: number }[];
  };
}
