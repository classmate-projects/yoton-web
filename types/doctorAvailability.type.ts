export interface BreakType {
  breakId: string;
  start: string; // "HH:mm"
  end: string; // "HH:mm"
  reason: string | null;
}

export interface DayScheduleType {
  day: number; // 0 = Sunday ... 6 = Saturday (matches .NET DayOfWeek)
  start: string; // "HH:mm"
  end: string; // "HH:mm"
  slotDurationMinutes: number;
  maxConcurrentBookings: number;
  breaks: BreakType[];
}

export interface DoctorAvailabilityType {
  doctorId: string;
  doctorName: string;
  specialization: string;
  schedules: DayScheduleType[];
}

export interface SpecializationAvailabilityType {
  specializationId: string;
  specializationName: string;
  doctors: DoctorAvailabilityType[];
}

export interface BreakInput {
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  reason: string | null;
}

export interface DayScheduleInput {
  day: number;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  slotDurationMinutes: number;
  maxConcurrentBookings: number;
  breaks: BreakInput[];
}

export interface AdminOverrideInput {
  username: string;
  password: string;
}

export interface UpdateDoctorSchedulePayload {
  doctorId: string;
  schedules: DayScheduleInput[];
  updatedBy?: string | null;
  adminOverride?: AdminOverrideInput;
}

export interface ScheduleConflict {
  appointmentId: string | null;
  patientName: string | null;
  day: string;
  date: string; // "yyyy-MM-dd"
  time: string; // "HH:mm"
}
