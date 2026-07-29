"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { format } from "date-fns";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeIndianRupee,
  CalendarCheck2,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  ListChecks,
  LogIn,
  Search,
  Stethoscope,
  UserRoundCheck,
  X,
  XCircle,
} from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import DatePicker from "@/components/DatePicker";
import { ReceptionService } from "@/services/reception.service";
import {
  DoctorDaySlotsType,
  DoctorGridType,
  PatientListItemType,
  SpecializationDoctorsType,
} from "@/types/appointment.type";
import { VisitType } from "@/types/visit.type";
import { toDateInputValue } from "@/lib/date";

export default function Appointments() {
  const [isLoadingGrid, setIsLoadingGrid] = useState(true);
  const [specializations, setSpecializations] = useState<
    SpecializationDoctorsType[]
  >([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSpecializationId, setSelectedSpecializationId] =
    useState("all");

  const [selectedDoctor, setSelectedDoctor] = useState<DoctorGridType | null>(
    null
  );
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [daySlots, setDaySlots] = useState<DoctorDaySlotsType | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  const [patients, setPatients] = useState<PatientListItemType[]>([]);

  const [bookingSlot, setBookingSlot] = useState<
    DoctorDaySlotsType["slots"][number] | null
  >(null);
  const [cancelSlot, setCancelSlot] = useState<
    DoctorDaySlotsType["slots"][number] | null
  >(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] =
    useState<PatientListItemType | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [visitQueue, setVisitQueue] = useState<VisitType[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [queuePage, setQueuePage] = useState(1);
  const QUEUE_PAGE_SIZE = 5;

  // ---------------- Fetch specialization/doctor grid ----------------
  const fetchGrid = async () => {
    try {
      setIsLoadingGrid(true);
      const data = await ReceptionService.getSpecializationsWithDoctors();
      setSpecializations(data.specializations ?? []);
    } catch (error) {
      console.error("Failed to fetch specializations/doctors:", error);
      toast.error("Failed to load doctors");
    } finally {
      setIsLoadingGrid(false);
    }
  };

  useEffect(() => {
    fetchGrid();
  }, []);

  // ---------------- Fetch patients (for booking search) ----------------
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const data = await ReceptionService.getAllPatients();
        setPatients(data.patients ?? []);
      } catch (error) {
        console.error("Failed to fetch patients:", error);
      }
    };
    fetchPatients();
  }, []);

  // ---------------- Fetch visit queue ----------------
  const fetchVisitQueue = async () => {
    try {
      setIsLoadingQueue(true);
      const data = await ReceptionService.getVisitQueue();
      setVisitQueue(data.data ?? []);
    } catch (error) {
      console.error("Failed to fetch visit queue:", error);
    } finally {
      setIsLoadingQueue(false);
    }
  };

  useEffect(() => {
    fetchVisitQueue();
    // Poll so the queue reflects status changes made elsewhere (nursing, billing, etc.)
    // without requiring a manual refresh.
    const interval = setInterval(fetchVisitQueue, 20000);
    return () => clearInterval(interval);
  }, []);

  const sortedVisitQueue = useMemo(() => {
    return [...visitQueue].sort((a, b) => {
      const aTime = new Date(a.appointmentDate ?? a.checkedInAt).getTime();
      const bTime = new Date(b.appointmentDate ?? b.checkedInAt).getTime();
      return aTime - bTime;
    });
  }, [visitQueue]);

  const queueTotalPages = Math.max(
    1,
    Math.ceil(sortedVisitQueue.length / QUEUE_PAGE_SIZE)
  );

  useEffect(() => {
    if (queuePage > queueTotalPages) {
      setQueuePage(queueTotalPages);
    }
  }, [queuePage, queueTotalPages]);

  const paginatedVisitQueue = sortedVisitQueue.slice(
    (queuePage - 1) * QUEUE_PAGE_SIZE,
    queuePage * QUEUE_PAGE_SIZE
  );

  // ---------------- Fetch slots for selected doctor + date ----------------
  const fetchSlots = async (doctorId: string, date: Date) => {
    try {
      setIsLoadingSlots(true);
      const data = await ReceptionService.getDoctorSlots(
        doctorId,
        toDateInputValue(date)
      );
      setDaySlots(data.data ?? null);
    } catch (error) {
      console.error("Failed to fetch doctor slots:", error);
      toast.error("Failed to load slots for this doctor");
      setDaySlots(null);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (selectedDoctor) {
      fetchSlots(selectedDoctor.doctorId, selectedDate);
    }
  }, [selectedDoctor, selectedDate]);

  const specializationOptions = specializations.map((s) => ({
    id: s.specializationId,
    name: s.specializationName,
  }));

  const filteredSpecializations = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return specializations
      .filter(
        (s) =>
          selectedSpecializationId === "all" ||
          s.specializationId === selectedSpecializationId
      )
      .map((s) => {
        const matchesSpec = s.specializationName
          .toLowerCase()
          .includes(normalizedSearch);
        const doctors = matchesSpec
          ? s.doctors
          : s.doctors.filter((d) =>
              d.name.toLowerCase().includes(normalizedSearch)
            );
        return { ...s, doctors };
      })
      .filter((s) => normalizedSearch.length === 0 || s.doctors.length > 0);
  }, [specializations, searchTerm, selectedSpecializationId]);

  const totalDoctors = specializations.reduce(
    (total, s) => total + s.doctors.length,
    0
  );

  const averageFee = totalDoctors
    ? Math.round(
        specializations.reduce(
          (total, s) =>
            total + s.doctors.reduce((sum, d) => sum + d.consultationFee, 0),
          0
        ) / totalDoctors
      )
    : 0;

  const getInitials = (name: string) =>
    name
      .replace(/^Dr\.\s*/i, "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");

  const handleSelectSlot = (slot: DoctorDaySlotsType["slots"][number]) => {
    if (slot.isPast) return;
    if (slot.isAvailable) {
      setBookingSlot(slot);
      setPatientSearch("");
      setSelectedPatient(null);
      setNotes("");
    } else {
      setCancelSlot(slot);
    }
  };

  const filteredPatients = patientSearch.trim()
    ? patients.filter(
        (p) =>
          p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
          p.phone?.toLowerCase().includes(patientSearch.toLowerCase()) ||
          p.opId?.toLowerCase().includes(patientSearch.toLowerCase())
      )
    : [];

  const handleConfirmBooking = async () => {
    if (!bookingSlot || !selectedDoctor || !selectedPatient) {
      toast.warning("Please select a patient first");
      return;
    }

    try {
      setIsSubmitting(true);
      const userId =
        JSON.parse(localStorage.getItem("yoton_user_detail") || "{}")
          .userId ?? undefined;

      const data = await ReceptionService.createAppointment({
        patientId: selectedPatient.opId,
        doctorId: selectedDoctor.doctorId,
        appointmentDate: bookingSlot.start,
        notes,
        userId,
      });

      if (data.status === false) {
        toast.error(data.message || "Could not book this slot");
      } else {
        toast.success(data.message || "Appointment booked");
        setBookingSlot(null);
      }
      fetchSlots(selectedDoctor.doctorId, selectedDate);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Failed to book appointment");
      } else {
        toast.error("Failed to book appointment");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckIn = async () => {
    if (!cancelSlot?.appointmentId) return;

    try {
      setIsSubmitting(true);
      const data = await ReceptionService.checkIn({
        appointmentId: cancelSlot.appointmentId,
      });
      toast.success(data.message || "Patient checked in");
      setCancelSlot(null);
      fetchVisitQueue();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Failed to check in patient");
      } else {
        toast.error("Failed to check in patient");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelSlot?.appointmentId || !selectedDoctor) return;

    try {
      setIsSubmitting(true);
      const data = await ReceptionService.cancelAppointment(
        cancelSlot.appointmentId
      );
      toast.success(data.message || "Appointment cancelled");
      setCancelSlot(null);
      fetchSlots(selectedDoctor.doctorId, selectedDate);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Failed to cancel appointment");
      } else {
        toast.error("Failed to cancel appointment");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="py-8 px-10 h-full overflow-y-auto">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
              <CalendarDays className="text-primary" /> Appointments
            </h1>
            <p className="text-sm text-muted-foreground">
              Pick a specialization, choose a doctor, then book an open slot
              on the calendar.
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
              value={selectedSpecializationId}
              onChange={(event) =>
                setSelectedSpecializationId(event.target.value)
              }
              className="h-11 w-full text-base sm:w-60"
            >
              <option value="all">All specializations</option>
              {specializationOptions.map((spec) => (
                <option key={spec.id} value={spec.id}>
                  {spec.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="card p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  Available doctors
                </p>
                <p className="mt-1 text-3xl font-semibold">{totalDoctors}</p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserRoundCheck size={22} />
              </span>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  Specializations
                </p>
                <p className="mt-1 text-3xl font-semibold">
                  {specializations.length}
                </p>
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
                <p className="mt-1 text-3xl font-semibold">
                  INR {averageFee}
                </p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BadgeIndianRupee size={22} />
              </span>
            </div>
          </div>
        </div>

        <section className="card p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <ListChecks className="text-primary" size={20} /> Visit queue
            </h2>
            <button
              onClick={fetchVisitQueue}
              className="text-sm font-semibold text-primary hover:opacity-80 cursor-pointer"
            >
              Refresh
            </button>
          </div>
          {isLoadingQueue ? (
            <LoadingSpinner />
          ) : sortedVisitQueue.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No patients currently in the queue.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase text-muted-foreground border-b border-border">
                      <th className="pb-2 pr-4">Patient</th>
                      <th className="pb-2 pr-4">Type</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">Appointment time</th>
                      <th className="pb-2 pr-4">Checked in</th>
                      <th className="pb-2 pr-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedVisitQueue.map((visit) => (
                      <tr key={visit.visitId} className="border-b border-border last:border-0">
                        <td className="py-2 pr-4 font-medium text-foreground">
                          {visit.patientName ?? "Unknown"}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {visit.visitType}
                        </td>
                        <td className="py-2 pr-4">
                          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                            {visit.status}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {visit.appointmentDate
                            ? format(new Date(visit.appointmentDate), "d MMM, h:mm a")
                            : "—"}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {format(new Date(visit.checkedInAt), "h:mm a")}
                        </td>
                        <td className="py-2 pr-4">
                          {(visit.status === "CheckedIn" || visit.status === "WithNurse") && visit.patientId && (
                            <Link
                              href={`/nursing?patientId=${visit.patientId}&visitId=${visit.visitId}`}
                              className="text-xs font-semibold text-primary hover:underline"
                            >
                              Start Nursing
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between gap-4 mt-4">
                <p className="text-xs text-muted-foreground">
                  Showing {(queuePage - 1) * QUEUE_PAGE_SIZE + 1}
                  {"–"}
                  {Math.min(queuePage * QUEUE_PAGE_SIZE, sortedVisitQueue.length)} of{" "}
                  {sortedVisitQueue.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQueuePage((p) => Math.max(1, p - 1))}
                    disabled={queuePage === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors cursor-pointer"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-semibold text-muted-foreground">
                    Page {queuePage} of {queueTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setQueuePage((p) => Math.min(queueTotalPages, p + 1))
                    }
                    disabled={queuePage === queueTotalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors cursor-pointer"
                    aria-label="Next page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        {selectedDoctor && (
          <section className="card p-5">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => {
                      setSelectedDoctor(null);
                      setDaySlots(null);
                    }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-foreground transition-colors hover:bg-muted/70"
                    aria-label="Back to doctors"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                      <CalendarDays size={17} /> Slot calendar
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold text-foreground">
                      {selectedDoctor.name}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedDoctor.specializationName} • INR{" "}
                      {selectedDoctor.consultationFee} • {selectedDoctor.experienceYears}{" "}
                      years experience
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <DatePicker
                    value={toDateInputValue(selectedDate)}
                    min={toDateInputValue(new Date())}
                    onChange={(v) => {
                      if (v) {
                        setSelectedDate(new Date(`${v}T00:00:00`));
                      }
                    }}
                    className="flex h-10 w-44 items-center justify-between gap-2 rounded-xl border border-input bg-card px-3 py-1.5 text-left text-sm text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <span className="rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                    Available
                  </span>
                  <span className="rounded-lg border border-blue-600 bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                    Booked
                  </span>
                </div>
              </div>

              {isLoadingSlots ? (
                <LoadingSpinner />
              ) : (daySlots?.slots.length ?? 0) === 0 ? (
                <div className="rounded-lg border border-border bg-muted/40 p-10 text-center text-sm text-muted-foreground">
                  This doctor has no schedule configured for this day.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {daySlots!.slots.map((slot) => (
                    <button
                      key={slot.start}
                      onClick={() => handleSelectSlot(slot)}
                      disabled={slot.isPast}
                      title={slot.isPast ? "This slot has already passed" : undefined}
                      className={`group flex flex-col gap-2 rounded-xl border p-4 text-left shadow-sm transition-all ${
                        slot.isPast
                          ? "cursor-not-allowed border-border bg-muted/40 opacity-60"
                          : "hover:-translate-y-0.5 hover:shadow-md " +
                            (slot.isAvailable
                              ? "border-emerald-600/30 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30"
                              : "border-blue-600/30 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/30")
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`flex items-center gap-1.5 text-sm font-semibold ${
                            slot.isPast
                              ? "text-muted-foreground"
                              : slot.isAvailable
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-blue-700 dark:text-blue-400"
                          }`}
                        >
                          <Clock size={14} />
                          {format(new Date(slot.start), "h:mm a")}
                        </span>
                        {!slot.isPast && (slot.isAvailable ? (
                          <CalendarPlus
                            size={16}
                            className="text-emerald-600 dark:text-emerald-400"
                          />
                        ) : (
                          <CalendarCheck2
                            size={16}
                            className="text-blue-600 dark:text-blue-400"
                          />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        ends {format(new Date(slot.end), "h:mm a")}
                      </span>
                      <span
                        className={`mt-1 truncate rounded-md px-2 py-1 text-xs font-semibold ${
                          slot.isPast
                            ? "bg-muted text-muted-foreground"
                            : slot.isAvailable
                            ? "bg-emerald-600 text-white"
                            : "bg-blue-600 text-white"
                        }`}
                      >
                        {slot.isPast
                          ? "Past"
                          : slot.isAvailable
                          ? "Available"
                          : slot.isWalkIn
                          ? `${slot.patientName || "Patient"} - Walk-in Visit`
                          : slot.patientName || "Booked"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {!selectedDoctor && (
          <>
            {isLoadingGrid ? (
              <LoadingSpinner />
            ) : filteredSpecializations.length > 0 ? (
              <div className="flex flex-col gap-8">
                {filteredSpecializations.map((spec) => (
                  <div key={spec.specializationId} className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Stethoscope size={18} />
                      </span>
                      <h2 className="text-xl font-semibold text-foreground">
                        {spec.specializationName}
                      </h2>
                      <span className="rounded-lg border border-border bg-muted/40 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                        {spec.doctors.length} doctor
                        {spec.doctors.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                      {spec.doctors.map((doctor) => (
                        <article key={doctor.doctorId} className="card p-5">
                          <div className="flex items-start gap-4">
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary text-xl font-semibold text-primary-foreground shadow-sm">
                              {getInitials(doctor.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <h3 className="truncate text-xl font-semibold text-foreground">
                                    {doctor.name}
                                  </h3>
                                  <p className="mt-1 text-sm font-semibold text-primary">
                                    {doctor.specializationName}
                                  </p>
                                </div>
                                <span className="w-fit rounded-lg border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                                  INR {doctor.consultationFee}
                                </span>
                              </div>

                              <div className="mt-5 grid gap-3 sm:grid-cols-1">
                                <div className="rounded-lg border border-border bg-muted/40 p-3">
                                  <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                                    <GraduationCap size={15} /> Experience
                                  </p>
                                  <p className="mt-2 text-sm font-medium text-foreground">
                                    {doctor.experienceYears} years
                                  </p>
                                </div>
                              </div>

                              <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-muted-foreground">
                                  Ready for appointment scheduling
                                </p>
                                <button
                                  onClick={() => {
                                    setSelectedDoctor(doctor);
                                    setSelectedDate(new Date());
                                  }}
                                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                                >
                                  View slots
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
                <Stethoscope className="text-muted-foreground/50" size={42} />
                <h2 className="mt-4 text-xl font-semibold text-foreground">
                  No matching doctors
                </h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Try changing the search text or selecting a different
                  specialization.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Book appointment modal */}
      {bookingSlot && selectedDoctor && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto border border-border">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">
                  Book appointment
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedDoctor.name} •{" "}
                  {format(new Date(bookingSlot.start), "d MMM yyyy, h:mm a")} -{" "}
                  {format(new Date(bookingSlot.end), "h:mm a")}
                </p>
              </div>
              <button
                onClick={() => setBookingSlot(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-semibold text-foreground/90 mb-2">
                  Patient
                </label>
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(event) => {
                    setPatientSearch(event.target.value);
                    setSelectedPatient(null);
                  }}
                  placeholder="Search by name, phone or OP ID..."
                  className="w-full px-4 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:border-primary text-foreground"
                />
                {!selectedPatient && filteredPatients.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {filteredPatients.map((patient) => (
                      <button
                        key={patient.opId}
                        onClick={() => {
                          setSelectedPatient(patient);
                          setPatientSearch(patient.name);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-primary/5 border-b border-border last:border-b-0 transition-colors"
                      >
                        <div className="font-medium text-foreground">
                          {patient.name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {patient.opId} • {patient.phone}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {selectedPatient && (
                  <div className="mt-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-sm text-foreground/90">
                      <span className="font-semibold">Selected: </span>
                      {selectedPatient.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedPatient.opId} • {selectedPatient.phone}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground/90 mb-2">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Reason for visit"
                  className="w-full min-h-20 px-4 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:border-primary text-foreground"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setBookingSlot(null)}
                className="flex-1 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBooking}
                disabled={isSubmitting || !selectedPatient}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <CalendarPlus size={16} /> Book
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage appointment modal */}
      {cancelSlot && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-2xl max-w-sm w-full p-6 border border-border">
            <h2 className="text-xl font-semibold text-foreground">
              Manage appointment
            </h2>
            <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Patient
                </p>
                {cancelSlot.isWalkIn && (
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    Walk-in Visit
                  </span>
                )}
              </div>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {cancelSlot.patientName ?? "Patient"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {format(new Date(cancelSlot.start), "d MMM yyyy, h:mm a")} -{" "}
                {format(new Date(cancelSlot.end), "h:mm a")}
              </p>
            </div>
            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={handleCheckIn}
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:opacity-90 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <LogIn size={16} /> Check in patient
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <XCircle size={16} /> Cancel appointment
              </button>
              <button
                onClick={() => setCancelSlot(null)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
