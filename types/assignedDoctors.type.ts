export interface AssignedDoctorsInfo {
    consultationFee: number;
    doctorId: number;
    experienceYears: number;
    isActive: boolean;
    licenseNumber: string;
    specializationId: number;
    specializationName: string;
    userEmail: string;
    userId: number;
    userName: string;
  }
  
  export interface AssignedDoctors {
    count: number;
    doctors: AssignedDoctorsInfo[];
    message: string;
  }