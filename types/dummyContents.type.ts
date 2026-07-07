export interface DummyDoctorType {
  id: string;
  name: string;
  specialization: string;
  experience: number;
  qualification: string;
  image: string;
  consultationFee: number;
}

export interface DummyPatientType {
  id: string;
  name: string;
}

export type SlotStatus =
  | "available"
  | "booked"
  | "blocked"
  | "completed";

export interface DummySlotType {
  slotId: string;
  date: string;
  day: string;
  startTime: string;
  endTime: string;
  status: SlotStatus;
  patient: DummyPatientType | null;
}

export interface DummySlotsType {
  doctor: Pick<
    DummyDoctorType,
    "id" | "name" | "specialization" | "experience" | "consultationFee"
  >;
  slots: DummySlotType[];
}
