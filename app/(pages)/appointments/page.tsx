"use client";

import { dummyDoctors } from "@/dummyDatas/dummyAppointment";
import { dummyAppointmentSlots } from "@/dummyDatas/dummyAppointment";
import { ReceptionService } from "@/services/reception.service";
import {
  DummyDoctorType,
  DummySlotType,
  SlotStatus,
} from "@/types/dummyContents.type";
import axios from "axios";
import {
  ArrowLeft,
  BadgeIndianRupee,
  Ban,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Clock,
  GraduationCap,
  Search,
  Stethoscope,
  UserPlus,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

const statusCardStyles: Record<SlotStatus, string> = {
  available:
    "border-emerald-600 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60",
  booked:
    "border-blue-600 bg-blue-600 text-white shadow-sm hover:bg-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/60",
  blocked:
    "border-amber-500 bg-amber-500 text-white shadow-sm hover:bg-amber-600 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60",
  completed:
    "border-slate-600 bg-slate-600 text-white shadow-sm hover:bg-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-900/80",
};

const statusLegendStyles: Record<SlotStatus, string> = {
  available:
    "border-emerald-600 bg-emerald-600 text-white shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
  booked:
    "border-blue-600 bg-blue-600 text-white shadow-sm dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
  blocked:
    "border-amber-500 bg-amber-500 text-white shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
  completed:
    "border-slate-600 bg-slate-600 text-white shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
};

const statusLabels: Record<SlotStatus, string> = {
  available: "Available",
  booked: "Booked",
  blocked: "Blocked",
  completed: "Completed",
};

const parseDate = (date: string) => new Date(`${date}T00:00:00`);

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

const formatWeekday = (date: Date) =>
  date.toLocaleDateString("en-US", {
    weekday: "short",
  });

const getTimeValue = (time: string) => {
  const [timeValue, modifier] = time.split(" ");
  const [hours, minutes] = timeValue.split(":").map(Number);
  const normalizedHours =
    modifier === "PM" && hours !== 12
      ? hours + 12
      : modifier === "AM" && hours === 12
        ? 0
        : hours;

  return normalizedHours * 60 + minutes;
};

export default function Appointments() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSpecialization, setSelectedSpecialization] = useState("all");
  const [selectedDoctor, setSelectedDoctor] = useState<DummyDoctorType | null>(
    null
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    dummyAppointmentSlots[0]?.slots[0]?.date ?? ""
  );
  const [selectedSlot, setSelectedSlot] = useState<DummySlotType | null>(null);

  const specializations = Array.from(
    new Set(dummyDoctors.map((doctor) => doctor.specialization))
  );

  const filteredDoctors = dummyDoctors.filter((doctor) => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchesSearch =
      normalizedSearch.length === 0 ||
      doctor.name.toLowerCase().includes(normalizedSearch) ||
      doctor.specialization.toLowerCase().includes(normalizedSearch);
    const matchesSpecialization =
      selectedSpecialization === "all" ||
      doctor.specialization === selectedSpecialization;

    return matchesSearch && matchesSpecialization;
  });

  const averageFee = Math.round(
    dummyDoctors.reduce((total, doctor) => total + doctor.consultationFee, 0) /
      dummyDoctors.length
  );

  const selectedDoctorSlots = selectedDoctor
    ? dummyAppointmentSlots.find(
        (slotGroup) => slotGroup.doctor.id === selectedDoctor.id
      )
    : null;

  const selectedDoctorDates = Array.from(
    new Set((selectedDoctorSlots?.slots ?? []).map((slot) => slot.date))
  ).sort();

  const visibleSlots: DummySlotType[] = (selectedDoctorSlots?.slots ?? [])
    .filter((slot) => slot.date === selectedDate)
    .sort((firstSlot, secondSlot) => {
      return (
        getTimeValue(firstSlot.startTime) - getTimeValue(secondSlot.startTime)
      );
    });

  const availableSlots = visibleSlots.filter(
    (slot) => slot.status === "available"
  ).length;

  const scheduleWindow =
    visibleSlots.length > 0
      ? `${visibleSlots[0].startTime} - ${visibleSlots[visibleSlots.length - 1].endTime}`
      : "No schedule";

  const getInitials = (name: string) =>
    name
      .replace(/^Dr\.\s*/i, "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");

  useEffect(() => {
    const fetchAllAppointments = async () => {
      try {
        const data = await ReceptionService.getAllAppointments();
        console.log("All appointments: ", data);
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.log("error: ", error.response?.data);
        } else {
          console.log("Something went wrong");
        }
      }
    };

    fetchAllAppointments();
  }, []);
  useEffect(() => {
    const id = "DOC-b3155d2a";
    const fetchDoctorById = async () => {
      try {
        const data = await ReceptionService.getDoctorById(id);
        console.log("doctor by id: ", data);
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.log("error: ", error.response?.data);
        } else {
          console.log("Something went wrong");
        }
      }
    };

    fetchDoctorById();
  }, []);

  return (
    <div className="py-8 px-10 h-full overflow-y-auto">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
              <CalendarDays className="text-primary" /> Appointments
            </h1>
            <p className="text-sm text-muted-foreground">
              Review available doctors and choose the right specialist for the next appointment.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block w-full sm:w-80">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search doctor or specialty"
                className="h-11 pl-11 text-base"
              />
            </label>
            <select
              value={selectedSpecialization}
              onChange={(event) => setSelectedSpecialization(event.target.value)}
              className="h-11 w-full text-base sm:w-60"
            >
              <option value="all">All specializations</option>
              {specializations.map((specialization) => (
                <option key={specialization} value={specialization}>
                  {specialization}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="card p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Available doctors</p>
                <p className="mt-1 text-3xl font-semibold">{dummyDoctors.length}</p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserRoundCheck size={22} />
              </span>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Specializations</p>
                <p className="mt-1 text-3xl font-semibold">{specializations.length}</p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Stethoscope size={22} />
              </span>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Average fee</p>
                <p className="mt-1 text-3xl font-semibold">INR {averageFee}</p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BadgeIndianRupee size={22} />
              </span>
            </div>
          </div>
        </div>

        {selectedDoctor && (
          <section className="card p-5">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => setSelectedDoctor(null)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-foreground transition-colors hover:bg-muted/70"
                    aria-label="Back to doctors"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                      <CalendarClock size={17} /> Slot calendar
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold text-foreground">
                      {selectedDoctor.name}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedDoctor.specialization} • {availableSlots} open slots •{" "}
                      {scheduleWindow}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(Object.keys(statusLabels) as SlotStatus[]).map((status) => (
                    <span
                      key={status}
                      className={`rounded-lg border px-3 py-1 text-xs font-semibold ${statusLegendStyles[status]}`}
                    >
                      {statusLabels[status]}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {selectedDoctorDates.map((date) => {
                  const parsedDate = parseDate(date);
                  const isSelected = selectedDate === date;
                  const slotsForDate =
                    selectedDoctorSlots?.slots.filter((slot) => slot.date === date) ??
                    [];
                  const firstSlot = slotsForDate[0];
                  const lastSlot = slotsForDate[slotsForDate.length - 1];

                  return (
                    <button
                      key={date}
                      onClick={() => {
                        setSelectedDate(date);
                        setSelectedSlot(null);
                      }}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border bg-muted/40 text-foreground hover:border-primary/40 hover:bg-primary/5"
                      }`}
                    >
                      <span className="block text-xs font-semibold uppercase opacity-80">
                        {formatWeekday(parsedDate)}
                      </span>
                      <span className="mt-1 block text-lg font-semibold">
                        {formatDate(parsedDate)}
                      </span>
                      {firstSlot && lastSlot && (
                        <span className="mt-1 block text-xs opacity-80">
                          {firstSlot.startTime} - {lastSlot.endTime}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="rounded-lg border border-border">
                  <div className="flex flex-col gap-2 border-b border-border bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {formatWeekday(parseDate(selectedDate))},{" "}
                        {formatDate(parseDate(selectedDate))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {visibleSlots.length} configured slots from {scheduleWindow}
                      </p>
                    </div>
                    <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <Clock size={16} /> Time ordered
                    </span>
                  </div>

                  {visibleSlots.length > 0 ? (
                    <div className="grid gap-3 p-4 sm:grid-cols-2 2xl:grid-cols-3">
                      {visibleSlots.map((slot) => {
                        const isSelectedSlot =
                          selectedSlot?.slotId === slot.slotId;

                        return (
                          <button
                            key={slot.slotId}
                            onClick={() => setSelectedSlot(slot)}
                            className={`rounded-lg border p-4 text-left transition-transform hover:-translate-y-0.5 ${
                              isSelectedSlot
                                ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                                : ""
                            } ${statusCardStyles[slot.status]}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <span className="text-base font-semibold">
                                {slot.startTime}
                              </span>
                              <span className="rounded-md bg-white/20 px-2 py-1 text-[11px] font-semibold uppercase text-white dark:bg-black/20 dark:text-current">
                                {statusLabels[slot.status]}
                              </span>
                            </div>
                            <span className="mt-2 block text-sm">
                              Ends at {slot.endTime}
                            </span>
                            {slot.patient && (
                              <span className="mt-2 block truncate text-xs font-medium">
                                {slot.patient.name}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      No slots configured for this date.
                    </div>
                  )}
                </div>

                <aside className="rounded-lg border border-border bg-card p-4">
                  {selectedSlot ? (
                    <div className="flex h-full flex-col gap-5">
                      <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
                        <div>
                          <p className="text-sm font-semibold text-primary">
                            Selected slot
                          </p>
                          <h3 className="mt-1 text-xl font-semibold text-foreground">
                            {selectedSlot.startTime} - {selectedSlot.endTime}
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatWeekday(parseDate(selectedSlot.date))},{" "}
                            {formatDate(parseDate(selectedSlot.date))}
                          </p>
                        </div>
                        <span
                          className={`rounded-lg border px-3 py-1 text-xs font-semibold ${statusLegendStyles[selectedSlot.status]}`}
                        >
                          {statusLabels[selectedSlot.status]}
                        </span>
                      </div>

                      {selectedSlot.status === "available" && (
                        <div className="flex flex-col gap-4">
                          <div className="flex items-center gap-2">
                            <UserPlus size={18} className="text-primary" />
                            <h4 className="font-semibold text-foreground">
                              Book appointment
                            </h4>
                          </div>

                          <div className="grid gap-3">
                            <label className="grid gap-1 text-sm font-semibold text-foreground/90">
                              Patient name
                              <input
                                type="text"
                                placeholder="Enter patient name"
                                className="h-10 text-sm"
                              />
                            </label>
                            <label className="grid gap-1 text-sm font-semibold text-foreground/90">
                              Phone number
                              <input
                                type="tel"
                                placeholder="Enter phone number"
                                className="h-10 text-sm"
                              />
                            </label>
                            <label className="grid gap-1 text-sm font-semibold text-foreground/90">
                              Visit type
                              <select className="h-10 text-sm">
                                <option>Consultation</option>
                                <option>Follow-up</option>
                                <option>Emergency</option>
                              </select>
                            </label>
                            <label className="grid gap-1 text-sm font-semibold text-foreground/90">
                              Notes
                              <textarea
                                placeholder="Reason for visit"
                                className="min-h-20 text-sm"
                              />
                            </label>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                            <button className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90">
                              <CalendarPlus size={16} /> Book
                            </button>
                            <button className="flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-600">
                              <Ban size={16} /> Block slot
                            </button>
                          </div>
                        </div>
                      )}

                      {selectedSlot.status === "booked" && (
                        <div className="flex flex-col gap-4">
                          <div className="rounded-lg border border-border bg-muted/40 p-4">
                            <p className="text-xs font-semibold uppercase text-muted-foreground">
                              Patient
                            </p>
                            <p className="mt-2 text-lg font-semibold text-foreground">
                              {selectedSlot.patient?.name ?? "Patient name"}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Appointment confirmed for this slot.
                            </p>
                          </div>
                          <button className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700">
                            <XCircle size={16} /> Cancel appointment
                          </button>
                        </div>
                      )}

                      {selectedSlot.status === "blocked" && (
                        <div className="flex flex-col gap-4">
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                            <p className="font-semibold">Slot blocked</p>
                            <p className="mt-1 text-sm">
                              This time is reserved for internal scheduling or doctor unavailability.
                            </p>
                          </div>
                          <button className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90">
                            Make slot available
                          </button>
                        </div>
                      )}

                      {selectedSlot.status === "completed" && (
                        <div className="rounded-lg border border-border bg-muted/40 p-4">
                          <p className="font-semibold text-foreground">
                            Appointment completed
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Completed slots are read-only in this screen.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-full min-h-80 flex-col items-center justify-center text-center">
                      <CalendarPlus className="text-muted-foreground/50" size={40} />
                      <h3 className="mt-4 text-lg font-semibold text-foreground">
                        Select a slot
                      </h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Choose a slot to book a patient, block availability, or cancel an appointment.
                      </p>
                    </div>
                  )}
                </aside>
              </div>
            </div>
          </section>
        )}

        {filteredDoctors.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {filteredDoctors.map((doctor: DummyDoctorType) => (
              <article key={doctor.id} className="card p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary text-xl font-semibold text-primary-foreground shadow-sm">
                    {getInitials(doctor.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h2 className="truncate text-xl font-semibold text-foreground">
                          {doctor.name}
                        </h2>
                        <p className="mt-1 text-sm font-semibold text-primary">
                          {doctor.specialization}
                        </p>
                      </div>
                      <span className="w-fit rounded-lg border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                        INR {doctor.consultationFee}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-border bg-muted/40 p-3">
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                          <GraduationCap size={15} /> Qualification
                        </p>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {doctor.qualification}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/40 p-3">
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                          <UserRoundCheck size={15} /> Experience
                        </p>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {doctor.experience} years
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Ready for appointment scheduling
                      </p>
                      <button
                        onClick={() => {
                          const doctorSlots = dummyAppointmentSlots.find(
                            (slotGroup) => slotGroup.doctor.id === doctor.id
                          );

                          setSelectedDoctor(doctor);
                          setSelectedDate(doctorSlots?.slots[0]?.date ?? "");
                          setSelectedSlot(null);
                        }}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                      >
                        {selectedDoctor?.id === doctor.id
                          ? "Viewing slots"
                          : "View slots"}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
            <Stethoscope className="text-muted-foreground/50" size={42} />
            <h2 className="mt-4 text-xl font-semibold text-foreground">
              No matching doctors
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Try changing the search text or selecting a different specialization.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
