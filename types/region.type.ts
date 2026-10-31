// The installation's country/region - mirrors the API's RegionDto
// (yoton-api/Regions/RegionCatalog.cs). Chosen once by the super administrator on
// /system-setup; every currency, phone, ID, address and tax rule in the app reads it from
// here (see lib/region.ts) instead of hardcoding one country.

export interface RegionCurrency {
  code: string;
  symbol: string;
  name: string;
  decimals: number;
}

export interface RegionPhone {
  // e.g. "+974"
  dialCode: string;
  // Digits after the dial code for a local number (8 in Qatar).
  nationalNumberLength: number;
  example: string;
}

export interface RegionNationalId {
  // e.g. "Qatar ID (QID)", "Emirates ID", "Aadhaar Number"
  label: string;
  // Regex source for the stored (normalized) form.
  pattern: string;
  placeholder: string;
}

export interface RegionAddressField {
  key: string;
  label: string;
  required: boolean;
  placeholder?: string | null;
  // A fixed list (e.g. Qatar's municipalities, the UAE's emirates, India's states).
  options?: string[] | null;
  pattern?: string | null;
  patternMessage?: string | null;
  // Word put before the value in the one-line address ("Zone", "Building", ...).
  prefix?: string | null;
}

export interface RegionTax {
  applicable: boolean;
  // "VAT", "GST", or "Tax" where there is none.
  name: string;
  defaultPercent: number;
  standardPercent: number | null;
  // "TRN", "GSTIN" - null where there is no tax.
  registrationLabel: string | null;
  // e.g. ["CGST", "SGST"] - the tax is reported split equally across these.
  splitComponents: string[];
  serviceCodeLabel: string | null;
  note: string | null;
}

export interface RegionRegulatory {
  healthAuthority: string;
  facilityLicenseLabel: string;
  claimsPortal: string | null;
  // Medication registries the pharmacy catalog can import from (DDC / Riayati in the UAE).
  medicationRegistries: string[];
  qualityKpiReports: boolean;
}

// Country-only features - matches the API's RegionFeatures.
export type RegionFeature = "eClaimLink" | "medicationRegistries" | "qualityKpiReports" | "tax";

export interface Region {
  // ISO 3166 alpha-2: "QA", "AE", "IN"
  code: string;
  country: string;
  // "Qatari", "Emirati", "Indian"
  demonym: string;
  currency: RegionCurrency;
  phone: RegionPhone;
  nationalId: RegionNationalId;
  addressFields: RegionAddressField[];
  tax: RegionTax;
  timeZoneId: string;
  utcOffsetMinutes: number;
  regulatory: RegionRegulatory;
  vaccineScheduleSource: string;
  routineVaccineCount: number;
  // Whose specimen-collection rules the container master follows (HMC in Qatar), and the
  // labelling / order-of-draw reminders shown with the nurse's collection guide.
  labSpecimenSource: string;
  labCollectionNotes: string[];
  features: RegionFeature[];
}

export interface SystemStatus {
  configured: boolean;
  region: Region | null;
  configuredAt: string | null;
  configuredByName: string | null;
  // Clinics (companies) on this installation.
  clinics: number;
}
