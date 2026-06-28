export interface DepartmentCreateType {
    name: string;
    description: string;
}
export interface DepartmentUpdateType {
    name: string;
    description: string;
    isActive: boolean
}

export interface SpecDepartmetnTypes {
    specializationId: string;
    name: string;
}

export interface DepartmentTypes {
    departmentId: string;
    description: string;
    isActive: boolean;
    name: string;
    specializations: SpecDepartmetnTypes;
}