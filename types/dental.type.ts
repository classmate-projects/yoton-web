export type ToothCondition =
  | "Healthy" | "Caries" | "Filled" | "Missing" | "Implant"
  | "Crown" | "BridgeAbutment" | "BridgePontic" | "RCT"
  | "ExtractionIndicated" | "Fracture" | "Watch";

export type ToothSurface = "M" | "D" | "B" | "L" | "O";

export type ComplexityLevel =
  | "StraightForward" | "LowComplexity" | "ModerateComplexity" | "HighComplexity";

export interface ToothNote {
  note: string;
  createdAt: string;
}

export interface ToothTreatment {
  detail: string;
  status: "Planned" | "Completed" | "InProgress";
  date: string;
}

export interface ToothRecord {
  toothNumber: string;
  conditions: ToothCondition[];
  surfaces: ToothSurface[];
  mobility?: number;
  examination?: string;
  complexity?: ComplexityLevel;
  diagnosisText?: string;
  notesJson?: string;       // JSON string of ToothNote[]
  treatmentsJson?: string;  // JSON string of ToothTreatment[]
  notes?: string;
}

export interface PerioRecord {
  toothNumber: string;
  buccalProbing?: string;   // "3,2,3"
  lingualProbing?: string;  // "2,2,2"
  buccalBop?: string;       // "0,1,0"
  lingualBop?: string;      // "0,0,0"
  buccalRecession?: string; // "0,0,0"
  lingualRecession?: string;
  mobility?: number;
  furcation?: string;       // "None" | "I" | "II" | "III"
}

export interface DentalChartType {
  dentalChartId: string;
  encounterId: string;
  patientId: string;
  doctorId: string;
  chartType: "Adult" | "Pediatric";
  generalNotes?: string;
  occlusionNotes?: string;
  softTissueNotes?: string;
  radioGraphicFindings?: string;
  createdAt: string;
  updatedAt: string;
  toothRecords: ToothRecord[];
  periodontalRecords: PerioRecord[];
}
