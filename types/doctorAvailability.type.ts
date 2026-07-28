export interface DayScheduleType {
  day: number; // 0 = Sunday ... 6 = Saturday (matches .NET DayOfWeek)
  start: string; // "HH:mm"
  end: string; // "HH:mm"
  slotDurationMinutes: number;
  breakStart: string | null; // "HH:mm"
  breakEnd: string | null; // "HH:mm"
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

export interface DayScheduleInput {
  day: number;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  slotDurationMinutes: number;
  breakStartTime: string | null; // "HH:mm"
  breakEndTime: string | null; // "HH:mm"
}

export interface UpdateDoctorSchedulePayload {
  doctorId: string;
  schedules: DayScheduleInput[];
  updatedBy?: string | null;
}
