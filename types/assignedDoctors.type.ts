export interface AssignedDoctorsInfo {
    doctorId: string;
    experienceYears: number;
    isActive: boolean;
    licenseNumber: string;
    specializationId: string;
    specializationName: string;
    userEmail: string;
    userId: string;
    userName: string;
    consultationServiceId?: string;
    consultationServiceName?: string;
    consultationServiceFee?: number;
  }
  
  export interface AssignedDoctors {
    count: number;
    data: AssignedDoctorsInfo[];
    message: string;
    status: boolean;
  }