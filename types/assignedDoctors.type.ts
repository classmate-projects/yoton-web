export interface AssignedDoctorsInfo {
    consultationFee: number;
    doctorId: string;
    experienceYears: number;
    isActive: boolean;
    licenseNumber: string;
    specializationId: string;
    specializationName: string;
    userEmail: string;
    userId: string;
    userName: string;
  }
  
  export interface AssignedDoctors {
    count: number;
    data: AssignedDoctorsInfo[];
    message: string;
    status: boolean;
  }