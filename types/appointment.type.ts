export interface DoctorGridType {
  doctorId: string;
  name: string;
  // Only ever populated on the reception-facing endpoint (GetSpecializationsWithDoctors) -
  // the patient-facing one that shares this same DTO shape never sets it.
  userId?: string | null;
  specializationId: string;
  specializationName: string;
  experienceYears: number;
  consultationFee: number;
}

export interface SpecializationDoctorsType {
  specializationId: string;
  specializationName: string;
  departmentId: string | null;
  departmentName: string | null;
  doctors: DoctorGridType[];
}

export interface SlotBookingType {
  appointmentId: string | null;
  patientId: string | null;
  patientName: string | null;
  status: string | null;
  isWalkIn: boolean;
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
  bookedCount: number;
  maxCapacity: number;
  bookings: SlotBookingType[];
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
  isFollowUp?: boolean;
  urgencyLevel?: string; // Routine, Urgent
  allowOverlap?: boolean;
}

export interface PatientListItemType {
  opId: string;
  // Hospital-assigned outpatient number - what the UI shows as "MRN". opId itself stays
  // internal (routing, FK payloads, React keys) and is never shown to a user; opNumber is
  // the human-facing reference number. Falls back to opId when a patient predates having one
  // assigned, so the UI never shows a blank identifier.
  opNumber?: string | null;
  name: string;
  email: string;
  phone: string;
  address: string;
  dateOfBirth: string | null;
  nationalID?: string | null;
  passportNumber?: string | null;
}

export interface AppointmentRequestType {
  appointmentId: string;
  patientId: string | null;
  patientName: string | null;
  doctorId: string | null;
  doctorName: string | null;
  appointmentDate: string;
  notes: string | null;
  createdAt: string;
}
