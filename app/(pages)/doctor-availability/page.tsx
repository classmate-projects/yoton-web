"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  Coffee,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Fragment } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { ReceptionService } from "@/services/reception.service";
import { SpecializationAvailabilityType } from "@/types/doctorAvailability.type";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type ScheduleField = "startTime" | "endTime" | "slotDurationMinutes";

interface EditableDaySchedule {
  day: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  breakStartTime: string; // "" = no break
  breakEndTime: string; // "" = no break
}

interface EditableDoctor {
  doctorId: string;
  doctorName: string;
  specialization: string;
  schedules: EditableDaySchedule[];
}

interface EditableSpecialization {
  specializationId: string;
  specializationName: string;
  doctors: EditableDoctor[];
}

const makeSchedule = (day: number): EditableDaySchedule => ({
  day,
  startTime: "09:00",
  endTime: "17:00",
  slotDurationMinutes: 30,
  breakStartTime: "",
  breakEndTime: "",
});

const toEditable = (
  data: SpecializationAvailabilityType[]
): EditableSpecialization[] =>
  data.map((spec) => ({
    specializationId: spec.specializationId,
    specializationName: spec.specializationName,
    doctors: spec.doctors.map((doctor) => ({
      doctorId: doctor.doctorId,
      doctorName: doctor.doctorName,
      specialization: doctor.specialization,
      schedules: [...doctor.schedules]
        .sort((a, b) => a.day - b.day)
        .map((s) => ({
          day: s.day,
          startTime: s.start,
          endTime: s.end,
          slotDurationMinutes: s.slotDurationMinutes,
          breakStartTime: s.breakStart ?? "",
          breakEndTime: s.breakEnd ?? "",
        })),
    })),
  }));

export default function DoctorAvailability() {
  const [isLoading, setIsLoading] = useState(true);
  const [availability, setAvailability] = useState<EditableSpecialization[]>(
    []
  );
  const [expandedSpecializations, setExpandedSpecializations] = useState<
    Set<string>
  >(new Set());
  const [expandedDoctors, setExpandedDoctors] = useState<Set<string>>(
    new Set()
  );
  const [selectedDays, setSelectedDays] = useState<Record<string, string>>({});
  const [savingDoctorId, setSavingDoctorId] = useState<string | null>(null);
  const canCollapseAll = expandedSpecializations.size > 1;

  const fetchAvailability = async () => {
    try {
      setIsLoading(true);
      const data = await ReceptionService.getDoctorAvailability();
      setAvailability(toEditable(data.specializations ?? []));
    } catch (error) {
      console.error("Failed to fetch doctor availability:", error);
      toast.error("Failed to load doctor availability");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailability();
  }, []);

  const toggleSpecialization = (specializationId: string) => {
    setExpandedSpecializations((previous) => {
      const next = new Set(previous);
      if (next.has(specializationId)) {
        next.delete(specializationId);
      } else {
        next.add(specializationId);
      }
      return next;
    });
  };

  const toggleDoctor = (doctorId: string) => {
    setExpandedDoctors((previous) => {
      const next = new Set(previous);
      if (next.has(doctorId)) {
        next.delete(doctorId);
      } else {
        next.add(doctorId);
      }
      return next;
    });
  };

  const updateSchedule = (
    doctorId: string,
    day: number,
    field: ScheduleField,
    value: string | number
  ) => {
    setAvailability((specs) =>
      specs.map((spec) => ({
        ...spec,
        doctors: spec.doctors.map((doctor) =>
          doctor.doctorId === doctorId
            ? {
                ...doctor,
                schedules: doctor.schedules.map((schedule) =>
                  schedule.day === day
                    ? { ...schedule, [field]: value }
                    : schedule
                ),
              }
            : doctor
        ),
      }))
    );
  };

  const addScheduleDay = (doctorId: string) => {
    const selectedDay = selectedDays[doctorId];
    if (selectedDay === undefined || selectedDay === "") return;
    const dayIndex = Number(selectedDay);

    setAvailability((specs) =>
      specs.map((spec) => ({
        ...spec,
        doctors: spec.doctors.map((doctor) =>
          doctor.doctorId === doctorId
            ? {
                ...doctor,
                schedules: [...doctor.schedules, makeSchedule(dayIndex)].sort(
                  (a, b) => a.day - b.day
                ),
              }
            : doctor
        ),
      }))
    );

    setSelectedDays((previous) => ({ ...previous, [doctorId]: "" }));
  };

  const removeScheduleDay = (doctorId: string, day: number) => {
    setAvailability((specs) =>
      specs.map((spec) => ({
        ...spec,
        doctors: spec.doctors.map((doctor) =>
          doctor.doctorId === doctorId
            ? {
                ...doctor,
                schedules: doctor.schedules.filter((s) => s.day !== day),
              }
            : doctor
        ),
      }))
    );
  };

  const toggleBreak = (doctorId: string, day: number) => {
    setAvailability((specs) =>
      specs.map((spec) => ({
        ...spec,
        doctors: spec.doctors.map((doctor) =>
          doctor.doctorId === doctorId
            ? {
                ...doctor,
                schedules: doctor.schedules.map((schedule) =>
                  schedule.day === day
                    ? schedule.breakStartTime
                      ? { ...schedule, breakStartTime: "", breakEndTime: "" }
                      : {
                          ...schedule,
                          breakStartTime: "13:00",
                          breakEndTime: "13:30",
                        }
                    : schedule
                ),
              }
            : doctor
        ),
      }))
    );
  };

  const updateBreakField = (
    doctorId: string,
    day: number,
    field: "breakStartTime" | "breakEndTime",
    value: string
  ) => {
    setAvailability((specs) =>
      specs.map((spec) => ({
        ...spec,
        doctors: spec.doctors.map((doctor) =>
          doctor.doctorId === doctorId
            ? {
                ...doctor,
                schedules: doctor.schedules.map((schedule) =>
                  schedule.day === day
                    ? { ...schedule, [field]: value }
                    : schedule
                ),
              }
            : doctor
        ),
      }))
    );
  };

  const saveDoctorSchedule = async (doctor: EditableDoctor) => {
    for (const schedule of doctor.schedules) {
      const dayName = DAYS[schedule.day];
      if (schedule.endTime <= schedule.startTime) {
        toast.error(`${dayName}: end time must be after start time`);
        return;
      }
      if (schedule.breakStartTime || schedule.breakEndTime) {
        if (!schedule.breakStartTime || !schedule.breakEndTime) {
          toast.error(`${dayName}: break needs both a start and end time`);
          return;
        }
        if (schedule.breakEndTime <= schedule.breakStartTime) {
          toast.error(`${dayName}: break end must be after break start`);
          return;
        }
        if (
          schedule.breakStartTime < schedule.startTime ||
          schedule.breakEndTime > schedule.endTime
        ) {
          toast.error(`${dayName}: break must fall within working hours`);
          return;
        }
      }
    }

    try {
      setSavingDoctorId(doctor.doctorId);
      const updatedBy =
        JSON.parse(localStorage.getItem("yoton_user_detail") || "{}")
          .userId ?? undefined;

      const data = await ReceptionService.updateDoctorSchedule({
        doctorId: doctor.doctorId,
        updatedBy,
        schedules: doctor.schedules.map((s) => ({
          day: s.day,
          startTime: s.startTime,
          endTime: s.endTime,
          slotDurationMinutes: s.slotDurationMinutes,
          breakStartTime: s.breakStartTime || null,
          breakEndTime: s.breakEndTime || null,
        })),
      });

      toast.success(data.message || "Schedule updated successfully");
      fetchAvailability();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Failed to update schedule");
      } else {
        toast.error("Failed to update schedule");
      }
    } finally {
      setSavingDoctorId(null);
    }
  };

  return (
    <div className="py-8 px-10 h-full overflow-y-auto">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
            <CalendarDays className="text-primary" /> Doctor Availability
          </h1>
          <p className="text-sm text-muted-foreground">
            Expand a specialization to view doctors, then expand a doctor to configure days, slots, and breaks.
          </p>
        </div>
        <button
          onClick={() => setExpandedSpecializations(new Set())}
          disabled={!canCollapseAll}
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:text-foreground"
        >
          Collapse all
        </button>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : availability.length === 0 ? (
        <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
          <CalendarDays className="text-muted-foreground/50" size={42} />
          <h2 className="mt-4 text-xl font-semibold text-foreground">
            No specializations with doctors found
          </h2>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {availability.map((specialization) => {
            const isSpecializationExpanded = expandedSpecializations.has(
              specialization.specializationId
            );

            return (
              <section key={specialization.specializationId} className="card">
                <button
                  onClick={() =>
                    toggleSpecialization(specialization.specializationId)
                  }
                  className="flex w-full items-center justify-between p-6 text-left transition-colors hover:bg-muted/30"
                >
                  <div>
                    <h2 className="text-2xl font-semibold text-foreground">
                      {specialization.specializationName}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {specialization.doctors.length} doctors configured
                    </p>
                  </div>
                  {isSpecializationExpanded ? (
                    <ChevronUp size={26} className="text-muted-foreground" />
                  ) : (
                    <ChevronDown size={26} className="text-muted-foreground" />
                  )}
                </button>

                <div
                  className={`grid transition-all duration-300 ease-in-out ${
                    isSpecializationExpanded
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="border-t border-border p-6">
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="table-no-row-hover min-w-[1040px]">
                          <thead>
                            <tr>
                              <th>Doctor</th>
                              <th>Working Days</th>
                              <th>Configured Days</th>
                              <th>Breaks</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {specialization.doctors.map((doctor) => {
                              const usedDays = new Set(
                                doctor.schedules.map((s) => s.day)
                              );
                              const availableDays = DAYS.map((name, index) => ({
                                name,
                                index,
                              })).filter(({ index }) => !usedDays.has(index));
                              const addDayValue =
                                selectedDays[doctor.doctorId] ?? "";
                              const isDoctorExpanded = expandedDoctors.has(
                                doctor.doctorId
                              );
                              const breakCount = doctor.schedules.filter(
                                (s) => s.breakStartTime
                              ).length;
                              const isSaving =
                                savingDoctorId === doctor.doctorId;

                              return (
                                <Fragment key={doctor.doctorId}>
                                  <tr>
                                    <td>
                                      <div>
                                        <p className="font-semibold text-foreground">
                                          {doctor.doctorName}
                                        </p>
                                        <p className="text-sm font-semibold text-primary">
                                          {doctor.specialization}
                                        </p>
                                      </div>
                                    </td>
                                    <td>
                                      <div className="flex flex-wrap gap-2">
                                        {doctor.schedules.length > 0 ? (
                                          doctor.schedules.map((schedule) => (
                                            <span
                                              key={schedule.day}
                                              className="rounded-lg border border-border bg-muted/50 px-3 py-1 text-xs font-semibold text-foreground"
                                            >
                                              {DAYS[schedule.day]}
                                            </span>
                                          ))
                                        ) : (
                                          <span className="text-sm text-muted-foreground">
                                            No days configured
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="font-semibold">
                                      {doctor.schedules.length}
                                    </td>
                                    <td className="font-semibold">{breakCount}</td>
                                    <td>
                                      <button
                                        onClick={() =>
                                          toggleDoctor(doctor.doctorId)
                                        }
                                        className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary min-w-36"
                                      >
                                        {isDoctorExpanded ? (
                                          <>
                                            <ChevronUp size={16} /> Hide config
                                          </>
                                        ) : (
                                          <>
                                            <ChevronDown size={16} /> Configure
                                          </>
                                        )}
                                      </button>
                                    </td>
                                  </tr>

                                  <tr>
                                    <td
                                      colSpan={5}
                                      className="bg-muted/20 [padding:0!important]"
                                    >
                                      <div
                                        className={`grid transition-all duration-300 ease-in-out ${
                                          isDoctorExpanded
                                            ? "grid-rows-[1fr] opacity-100"
                                            : "grid-rows-[0fr] opacity-0"
                                        }`}
                                      >
                                        <div className="overflow-hidden">
                                          <div className="flex flex-col gap-4 p-4">
                                            <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 md:flex-row md:items-center md:justify-between">
                                              <div>
                                                <p className="text-lg font-semibold text-foreground">
                                                  {doctor.doctorName} configuration
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                  Add a day, then tune the slot timing and break window.
                                                </p>
                                              </div>
                                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                                <select
                                                  value={addDayValue}
                                                  onChange={(event) =>
                                                    setSelectedDays((previous) => ({
                                                      ...previous,
                                                      [doctor.doctorId]:
                                                        event.target.value,
                                                    }))
                                                  }
                                                  className="h-10 min-w-44 text-sm"
                                                >
                                                  <option value="">Select day</option>
                                                  {availableDays.map(({ name, index }) => (
                                                    <option key={name} value={index}>
                                                      {name}
                                                    </option>
                                                  ))}
                                                </select>
                                                <button
                                                  onClick={() =>
                                                    addScheduleDay(doctor.doctorId)
                                                  }
                                                  disabled={!addDayValue}
                                                  className="flex h-10 items-center justify-center gap-2 rounded-lg border border-primary/30 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                  <Plus size={15} /> Add day
                                                </button>
                                                <button
                                                  onClick={() => saveDoctorSchedule(doctor)}
                                                  disabled={isSaving}
                                                  className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                  <Save size={15} />{" "}
                                                  {isSaving ? "Saving..." : "Save"}
                                                </button>
                                              </div>
                                            </div>

                                            <div className="overflow-x-auto rounded-lg border border-border bg-card">
                                              <table className="table-no-row-hover min-w-[900px]">
                                                <thead>
                                                  <tr>
                                                    <th>Day</th>
                                                    <th>Start</th>
                                                    <th>End</th>
                                                    <th>Interval</th>
                                                    <th>Break</th>
                                                    <th>Action</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {doctor.schedules.length > 0 ? (
                                                    doctor.schedules.map((schedule) => (
                                                      <tr
                                                        key={`${doctor.doctorId}-${schedule.day}`}
                                                      >
                                                        <td className="font-semibold">
                                                          {DAYS[schedule.day]}
                                                        </td>
                                                        <td>
                                                          <div className="relative min-w-32">
                                                            <input
                                                              type="time"
                                                              value={schedule.startTime}
                                                              onChange={(event) =>
                                                                updateSchedule(
                                                                  doctor.doctorId,
                                                                  schedule.day,
                                                                  "startTime",
                                                                  event.target.value
                                                                )
                                                              }
                                                              className="h-10 min-w-32 pr-9 text-sm"
                                                            />
                                                            <Clock
                                                              size={15}
                                                              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                                            />
                                                          </div>
                                                        </td>
                                                        <td>
                                                          <div className="relative min-w-32">
                                                            <input
                                                              type="time"
                                                              value={schedule.endTime}
                                                              onChange={(event) =>
                                                                updateSchedule(
                                                                  doctor.doctorId,
                                                                  schedule.day,
                                                                  "endTime",
                                                                  event.target.value
                                                                )
                                                              }
                                                              className="h-10 min-w-32 pr-9 text-sm"
                                                            />
                                                            <Clock
                                                              size={15}
                                                              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                                            />
                                                          </div>
                                                        </td>
                                                        <td>
                                                          <select
                                                            value={schedule.slotDurationMinutes}
                                                            onChange={(event) =>
                                                              updateSchedule(
                                                                doctor.doctorId,
                                                                schedule.day,
                                                                "slotDurationMinutes",
                                                                Number(event.target.value)
                                                              )
                                                            }
                                                            className="h-10 min-w-28 text-sm"
                                                          >
                                                            <option value={10}>10 min</option>
                                                            <option value={15}>15 min</option>
                                                            <option value={20}>20 min</option>
                                                            <option value={30}>30 min</option>
                                                            <option value={45}>45 min</option>
                                                            <option value={60}>60 min</option>
                                                          </select>
                                                        </td>
                                                        <td className="min-w-[320px]">
                                                          {schedule.breakStartTime ? (
                                                            <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-2 md:grid-cols-[112px_112px_auto]">
                                                              <div className="relative">
                                                                <input
                                                                  type="time"
                                                                  value={schedule.breakStartTime}
                                                                  onChange={(event) =>
                                                                    updateBreakField(
                                                                      doctor.doctorId,
                                                                      schedule.day,
                                                                      "breakStartTime",
                                                                      event.target.value
                                                                    )
                                                                  }
                                                                  className="h-9 pr-8 text-sm"
                                                                />
                                                                <Clock
                                                                  size={14}
                                                                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                                                />
                                                              </div>
                                                              <div className="relative">
                                                                <input
                                                                  type="time"
                                                                  value={schedule.breakEndTime}
                                                                  onChange={(event) =>
                                                                    updateBreakField(
                                                                      doctor.doctorId,
                                                                      schedule.day,
                                                                      "breakEndTime",
                                                                      event.target.value
                                                                    )
                                                                  }
                                                                  className="h-9 pr-8 text-sm"
                                                                />
                                                                <Clock
                                                                  size={14}
                                                                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                                                />
                                                              </div>
                                                              <button
                                                                onClick={() =>
                                                                  toggleBreak(
                                                                    doctor.doctorId,
                                                                    schedule.day
                                                                  )
                                                                }
                                                                className="flex h-9 items-center justify-center rounded-lg border border-border px-3 text-muted-foreground transition-colors hover:border-red-300 hover:text-red-600"
                                                                aria-label="Remove break"
                                                              >
                                                                <Trash2 size={15} />
                                                              </button>
                                                            </div>
                                                          ) : (
                                                            <button
                                                              onClick={() =>
                                                                toggleBreak(
                                                                  doctor.doctorId,
                                                                  schedule.day
                                                                )
                                                              }
                                                              className="flex w-fit items-center gap-2 rounded-lg border border-primary/30 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
                                                            >
                                                              <Coffee size={15} /> Add break
                                                            </button>
                                                          )}
                                                        </td>
                                                        <td>
                                                          <button
                                                            onClick={() =>
                                                              removeScheduleDay(
                                                                doctor.doctorId,
                                                                schedule.day
                                                              )
                                                            }
                                                            className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:border-red-300 hover:text-red-600"
                                                          >
                                                            Remove
                                                          </button>
                                                        </td>
                                                      </tr>
                                                    ))
                                                  ) : (
                                                    <tr>
                                                      <td
                                                        colSpan={6}
                                                        className="text-center text-muted-foreground"
                                                      >
                                                        No days configured for this doctor.
                                                      </td>
                                                    </tr>
                                                  )}
                                                </tbody>
                                              </table>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                </Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
