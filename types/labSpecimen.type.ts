// Specimen containers - mirrors the API's DTOs/LabSpecimenDTO.cs. The container master is
// seeded from the installation's region (Qatar follows HMC's collection manual) and every lab
// test points at the container(s) its sample goes in.

export type SpecimenContainerCategory =
  | "Blood tube"
  | "Blood culture"
  | "Urine"
  | "Stool"
  | "Swab"
  | "Cytology/Histology"
  | "Other";

export const SPECIMEN_CONTAINER_CATEGORIES: SpecimenContainerCategory[] = [
  "Blood tube",
  "Blood culture",
  "Urine",
  "Stool",
  "Swab",
  "Cytology/Histology",
  "Other",
];

// One container a sample goes in, with the container's details flattened in.
export interface LabSpecimenType {
  containerCode: string | null;
  containerName: string;
  capColor: string | null;
  colorHex: string | null;
  additive: string | null;
  category: string | null;
  specimenType: string | null;
  volume: string | null;
  quantity: number;
  // Venipuncture order of draw, lowest first; null outside the venous draw (urine, swabs, ...).
  drawOrder: number | null;
  inversions: string | null;
  // Test-specific (fasting, trough timing, ...); handling is the container's own.
  instructions: string | null;
  handling: string | null;
}

// Collected = frozen when the sample was taken; Configured = the test's catalog setup;
// Suggested = the region's rules from the test name; NotRequired = no container needed.
export type LabSpecimenSource = "Collected" | "Configured" | "Suggested" | "NotRequired";

export interface SpecimenContainerType {
  specimenContainerId: string;
  code: string;
  name: string;
  capColor: string | null;
  colorHex: string | null;
  additive: string | null;
  specimenType: string | null;
  category: SpecimenContainerCategory;
  defaultVolume: string | null;
  inversions: string | null;
  drawOrder: number | null;
  handlingNotes: string | null;
  isSystemDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  testCount: number;
}

export interface SaveSpecimenContainerPayload {
  code: string;
  name: string;
  capColor: string | null;
  colorHex: string | null;
  additive: string | null;
  specimenType: string | null;
  category: SpecimenContainerCategory;
  defaultVolume: string | null;
  inversions: string | null;
  drawOrder: number | null;
  handlingNotes: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface LabTestSpecimenRowType {
  labTestSpecimenId: string;
  specimenContainerId: string;
  specimenType: string | null;
  volume: string | null;
  quantity: number;
  instructions: string | null;
  sortOrder: number;
  isAutoAssigned: boolean;
  resolved: LabSpecimenType;
}

export interface LabTestSpecimenSetupType {
  listItemId: string;
  name: string;
  code: string | null;
  isLabTest: boolean;
  isAutoAssigned: boolean;
  specimens: LabTestSpecimenRowType[];
  // What the region's rules give this test - offered as "use the default".
  defaultRule: string | null;
  defaultNoContainer: boolean;
  defaults: LabSpecimenType[];
}

export interface SaveLabTestSpecimenRow {
  specimenContainerId: string;
  specimenType: string | null;
  volume: string | null;
  quantity: number;
  instructions: string | null;
}

export interface LabTestSpecimensSummary {
  isAutoAssigned: boolean;
  specimens: LabSpecimenType[];
}

export interface LabSpecimenCoverageType {
  labTests: number;
  setByAdmin: number;
  regionDefault: number;
  noContainerNeeded: number;
  notSet: number;
  source: string;
  country: string;
}

export interface ApplyDefaultsResult {
  assigned: number;
  setByAdmin: number;
  noContainerNeeded: number;
  notRecognized: number;
}
