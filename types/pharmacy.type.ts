export interface MedicineType {
  medicineId: string;
  name: string;
  category: string | null;
  stock: number;
  price: number;
  expiryDate: string;
  isActive: boolean;
}

export interface PrescriptionItemType {
  prescriptionItemId: string;
  medicineId: string | null;
  medicineName: string;
  quantity: number;
  priority: string;
  unitPrice: number;
}

export interface PrescriptionType {
  prescriptionId: string;
  patientId: string | null;
  patientName: string;
  doctorId: string | null;
  doctorName: string | null;
  visitId: string | null;
  notes: string | null;
  status: string;
  collectedBy: string | null;
  collectorUserId: string | null;
  collectorName: string | null;
  dispensedAt: string | null;
  createdAt: string;
  items: PrescriptionItemType[];
}

export interface PharmacySummaryType {
  lowStockCount: number;
  pendingPrescriptions: number;
}

export interface AddMedicinePayload {
  name: string;
  category?: string;
  stock: number;
  price: number;
  expiryDate: string;
}

export interface CreatePrescriptionPayload {
  patientId: string;
  doctorId?: string;
  visitId?: string;
  notes?: string;
  items: { medicineId: string; quantity: number; priority?: string }[];
}

export interface IssueMedicinePayload {
  collectedBy: string; // Patient, Nurse
  collectorUserId?: string;
}
