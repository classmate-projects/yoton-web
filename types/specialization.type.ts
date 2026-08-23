export interface SpecializationUpdateTypes {
    name: string;
    description: string;
    departmentId: string;
    isActive: boolean;
    isDentalSpecialty?: boolean;
}
export interface SpecializationCreateTypes {
    name: string;
    description: string;
    departmentId: string;
    isDentalSpecialty?: boolean;
}

export interface SpecializationTypes {
    specializationId: string;
    name: string;
    description: string;
    isActive: boolean;
    departmentId: string;
    isDentalSpecialty: boolean;
  }