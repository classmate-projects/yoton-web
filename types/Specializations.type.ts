export interface Specialization {
  specializationId: string;
  name: string;
  departmentId: string | null;
  isActive: boolean;
  isDentalSpecialty: boolean;
}