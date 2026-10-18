export interface WeeklyAppointmentPoint {
  date: string;
  count: number;
}

export interface RevenuePoint {
  date: string;
  total: number;
}

export interface TopDoctor {
  doctorId: string;
  doctorName: string | null;
  userImage: string | null;
  count: number;
}
