export interface Doctor {
  id: number;
  name: string;
  specialization: string;
  licenseNumber: string;
  consultationFee: number;
  experienceYears: number;
  isAssigned?: boolean;
}

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
}

export interface Specialization {
  specializationId: number;
  name: string;
}