export interface SpecializationUpdateTypes {
    name: string;
    description: string;
    departmentId: string;
    isActive: boolean;
}
export interface SpecializationCreateTypes {
    name: string;
    description: string;
    departmentId: string;
}

export interface SpecializationTypes {
    specializationId: string;
    name: string;
    description: string;
    isActive: boolean;
    departmentId: string;
  }