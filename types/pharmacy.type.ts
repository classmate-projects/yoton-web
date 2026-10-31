import type { WalkInOrderFields } from "./patient.type";

export interface MedicineType {
  medicineId: string;
  name: string;
  genericName: string | null;
  ingredient: string | null;
  dosageForm: string | null;
  category: string | null;
  // Stock and price are in the medicine's dispensing unit (Strip, Tablet, ...); packUnit and
  // packSize say how it's bought (a Box of 10), so stock reads as whole packs plus loose units.
  stock: number;
  unit: string;
  packUnit: string | null;
  packSize: number;
  price: number;
  expiryDate: string | null;
  isActive: boolean;
  isHighRisk: boolean;
  code: string | null;
  source: "DDC" | "Riayati" | null;
  manufacturer: string | null;
  route: string | null;
  isControlled: boolean;
  isDiscontinued: boolean;
  discontinuedDate: string | null;
}

// One row of a bulk medication-catalog import — parsed client-side from the DDC or Riayati
// Excel file, mirroring ConfigListController's ListItemBulkUploadRequest shape.
export interface MedicineBulkRow {
  code?: string;
  name: string;
  genericName?: string;
  ingredient?: string;
  dosageForm?: string;
  route?: string;
  manufacturer?: string;
  price?: number;
  isControlled?: boolean;
  isDiscontinued?: boolean;
  discontinuedDate?: string;
}

export interface MedicineBulkUploadPayload {
  source: "DDC" | "Riayati";
  items: MedicineBulkRow[];
}

export interface PrescriptionItemType {
  prescriptionItemId: string;
  medicineId: string | null;
  medicineName: string;
  quantity: number;
  unit: string | null;
  priority: string;
  unitPrice: number;
}

export interface PrescriptionType extends WalkInOrderFields {
  prescriptionId: string;
  patientId: string | null;
  patientName: string;
  patientOPNumber?: string | null;
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
  correctedFromId: string | null;
  correctedFrom: PrescriptionType | null;
}

export interface PharmacySummaryType {
  lowStockCount: number;
  pendingPrescriptions: number;
}

export interface AddMedicinePayload {
  name: string;
  genericName?: string;
  ingredient?: string;
  dosageForm?: string;
  category?: string;
  price: number;
  isHighRisk?: boolean;
  code?: string;
  manufacturer?: string;
  route?: string;
  isControlled?: boolean;
  // How it's counted - left as it is when unit isn't sent. Price is per unit.
  unit?: string;
  packUnit?: string | null;
  packSize?: number;
}

export interface CreatePrescriptionPayload {
  patientId?: string;
  doctorId?: string;
  visitId?: string;
  externalProvider?: string; // outside prescriber on a walk-in's prescription
  notes?: string;
  items: { medicineId: string; quantity: number; priority?: string }[];
}

export interface IssueMedicinePayload {
  collectedBy: string; // Patient, Nurse
  collectorUserId?: string;
}

// A doctor-ordered Medication as pharmacy sees it — sourced directly from the same
// Medication records the doctor workbench writes, so dosage/frequency/route always match
// exactly what the doctor ordered. Includes pricing (pharmacy needs it); the doctor
// workbench's own print action never requests this type.
export interface PharmacyMedicationType {
  medicationId: string;
  patientId: string;
  patientName: string;
  patientOPNumber: string | null;
  doctorId: string | null;
  doctorName: string;

  medicineId: string | null;
  drugName: string;
  drugType: string | null;
  dosage: string | null;
  dosageUnit: string | null;
  frequency: string | null;
  durationDays: number | null;
  orderType: string | null;
  route: string | null;
  mealTiming: string | null;
  instructions: string | null;
  priority: string;
  totalQuantity: number | null;
  unit: string | null;
  refillCount: number;
  prnReason: string | null;
  requiresCounselling: boolean;
  unitPrice: number | null;

  startedAt: string;
  plannedEndDate: string | null;

  dispenseStatus: "Pending" | "Prepared" | "Dispensed";
  preparedByName: string | null;
  preparedAt: string | null;
  dispensedByName: string | null;
  dispensedAt: string | null;
  collectedBy: string | null;
  collectorName: string | null;

  alternatives: MedicineAlternativeType[];

  // Insurance/eligibility snapshot for this medication's patient — see
  // Patient.EligibilityMode on the backend ("Not Done" | "Online" | "Manual"). Manual is
  // what reception/pharmacy call "offline": backed by an uploaded document instead of the
  // structured eligibilityId/eligibilityVisitId fields.
  eligibilityMode: "Not Done" | "Online" | "Manual" | null;
  eligibilityCheckedDate: string | null;
  eligibilityID: string | null;
  eligibilityVisitID: string | null;
  insuranceProvider: string | null;
  insuranceCardNo: string | null;
  eligibilityDocumentPath: string | null;
  eligibilityDocumentUploadedAt: string | null;
}

export interface MedicineAlternativeType {
  medicineId: string;
  name: string;
  stock: number;
  price: number;
}

export interface DispenseMedicationPayload {
  collectedBy: string; // Patient, Nurse
  collectorUserId?: string;
}

// What went out on a dispense (a prescription or a medication order), lot by lot, and how much
// can still come back - quantities in the medicine's dispensing unit.
export interface DispensedLineType {
  issueLineId: string;
  itemName: string;
  unit: string;
  packUnit: string | null;
  packSize: number;
  batchNumber: string | null;
  expiryDate: string | null;
  quantity: number;
  returnedQuantity: number;
  canReturn: number;
}

export interface DispensedType {
  issueId: string;
  number: string;
  storeName: string | null;
  issuedByName: string | null;
  createdAt: string;
  billId: string | null;
  billStatus: string | null;
  lines: DispensedLineType[];
}

export interface ReturnDispensedPayload {
  reason?: string;
  // Back on the shelf; otherwise written off as it comes in.
  reusable: boolean;
  lines: { issueLineId: string; quantity: number }[];
}
