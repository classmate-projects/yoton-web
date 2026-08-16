export interface TestParameterType {
  testParameterId: string;
  listItemId: string;
  name: string;
  unit: string | null;
  normalLow: number | null;
  normalHigh: number | null;
  sortOrder: number;
  isActive: boolean;
}

export interface TestParameterPayload {
  listItemId: string;
  name: string;
  unit?: string;
  normalLow?: number;
  normalHigh?: number;
  sortOrder?: number;
}
