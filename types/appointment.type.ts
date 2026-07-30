export interface DoctorGridType {
  doctorId: string;
  name: string;
  specializationId: string;
  specializationName: string;
  experienceYears: number;
  consultationFee: number;
}

export interface SpecializationDoctorsType {
  specializationId: string;
  specializationName: string;
  doctors: DoctorGridType[];
}

export interface AppointmentSlotType {
  start: string;
  end: string;
  isAvailable: boolean;
  isPast: boolean;
  appointmentId: string | null;
  patientId: string | null;
  patientName: string | null;
  status: string | null;
  isWalkIn: boolean;
}

export interface DoctorDaySlotsType {
  doctorId: string;
  doctorName: string;
  specializationName: string;
  date: string;
  slotDurationMinutes: number;
  slots: AppointmentSlotType[];
}

export interface CreateAppointmentPayload {
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  notes?: string;
  userId?: string;
}

export interface PatientListItemType {
  opId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  dateOfBirth: string | null;
}
