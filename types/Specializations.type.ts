export interface Doctor {
  id: string;
  name: string;
  specialization: string;
  licenseNumber: string;
  consultationFee: number;
  experienceYears: number;
  isAssigned?: boolean;
}

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
}

export interface Specialization {
  specializationId: string;
  name: string;
  departmentId: string | null;
  isActive: boolean;
  isDentalSpecialty: boolean;
}