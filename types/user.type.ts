export interface UserCreateType {
    name: string;
    username: string;
    email: string;
    password: string;
    role: string
    phone: string
}


export interface UserUpdateType {
    name: string;
    email: string;
    role: string;
    phone: string
    isActive: boolean
}

export interface UserAssignedDoctorCreateType {
    UserId: string;
    SpecializationId: string;
    LicenseNumber: string;
    ExperienceYears: number;
    ConsultationFee: number;
}