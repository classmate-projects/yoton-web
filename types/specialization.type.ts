export interface SpecializationUpdateTypes {
    name: string;
    description: string;
    departmentId: string;
    isActive: boolean;
}

export interface SpecializationTypes {
    specializationId: string;
    name: string;
    description: string;
    isActive: boolean;
    department: {
      departmentId: string;
      name: string;
    };
  }