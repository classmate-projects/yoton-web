export interface DepartmentCreateType {
    name: string;
    description: string;
    isMedical: boolean;
}
export interface DepartmentUpdateType {
    name: string;
    description: string;
    isActive: boolean
    isMedical: boolean;
}

export interface SpecDepartmetnTypes {
    specializationId: string;
    name: string;
}

export interface DepartmentTypes {
    departmentId: string;
    description: string;
    isActive: boolean;
    isMedical: boolean;
    name: string;
    specializations: SpecDepartmetnTypes;
}