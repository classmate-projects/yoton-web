"use client";

import {
  DummyAvailabilityDepartment,
  DummyBreakTime,
  DummyDayAvailability,
  dummyDoctorAvailability,
} from "@/dummyDatas/dummyDoctorAvailability";
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
import { Fragment, useState } from "react";

type ScheduleField = keyof Pick<
  DummyDayAvailability,
  "startTime" | "endTime" | "intervalMinutes"
>;

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const makeSchedule = (day: string): DummyDayAvailability => ({
  day,
  startTime: "09:00",
  endTime: "17:00",
  intervalMinutes: 30,
  breakTimes: [],
});

const makeBreak = (doctorId: string, day: string): DummyBreakTime => ({
  id: `br_${doctorId}_${day.toLowerCase()}_${Date.now()}`,
  startTime: "13:00",
  reason: "Break",
});

export default function DoctorAvailability() {
  const [doctorAvailability, setDoctorAvailability] =
    useState<DummyAvailabilityDepartment[]>(dummyDoctorAvailability);
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(
    new Set()
  );
  const [expandedDoctors, setExpandedDoctors] = useState<Set<string>>(
    new Set()
  );
  const [selectedDays, setSelectedDays] = useState<Record<string, string>>({});
  const canCollapseAll = expandedDepartments.size > 1;

  const toggleDepartment = (departmentId: string) => {
    setExpandedDepartments((previousDepartments) => {
      const nextDepartments = new Set(previousDepartments);
      if (nextDepartments.has(departmentId)) {
        nextDepartments.delete(departmentId);
      } else {
        nextDepartments.add(departmentId);
      }
      return nextDepartments;
    });
  };

  const toggleDoctor = (doctorId: string) => {
    setExpandedDoctors((previousDoctors) => {
      const nextDoctors = new Set(previousDoctors);
      if (nextDoctors.has(doctorId)) {
        nextDoctors.delete(doctorId);
      } else {
        nextDoctors.add(doctorId);
      }
      return nextDoctors;
    });
  };

  const updateSchedule = (
    doctorId: string,
    day: string,
    field: ScheduleField,
    value: string | number
  ) => {
    setDoctorAvailability((departments) =>
      departments.map((department) => ({
        ...department,
        doctors: department.doctors.map((doctor) =>
          doctor.doctorId === doctorId
            ? {
                ...doctor,
                schedules: doctor.schedules.map((schedule) =>
                  schedule.day === day ? { ...schedule, [field]: value } : schedule
                ),
              }
            : doctor
        ),
      }))
    );
  };

  const addScheduleDay = (doctorId: string) => {
    const selectedDay = selectedDays[doctorId];
    if (!selectedDay) return;

    setDoctorAvailability((departments) =>
      departments.map((department) => ({
        ...department,
        doctors: department.doctors.map((doctor) =>
          doctor.doctorId === doctorId
            ? {
                ...doctor,
                schedules: [...doctor.schedules, makeSchedule(selectedDay)].sort(
                  (firstSchedule, secondSchedule) =>
                    DAYS.indexOf(firstSchedule.day) -
                    DAYS.indexOf(secondSchedule.day)
                ),
              }
            : doctor
        ),
      }))
    );

    setSelectedDays((previousDays) => ({ ...previousDays, [doctorId]: "" }));
  };

  const removeScheduleDay = (doctorId: string, day: string) => {
    setDoctorAvailability((departments) =>
      departments.map((department) => ({
        ...department,
        doctors: department.doctors.map((doctor) =>
          doctor.doctorId === doctorId
            ? {
                ...doctor,
                schedules: doctor.schedules.filter(
                  (schedule) => schedule.day !== day
                ),
              }
            : doctor
        ),
      }))
    );
  };

  const addBreakTime = (doctorId: string, day: string) => {
    setDoctorAvailability((departments) =>
      departments.map((department) => ({
        ...department,
        doctors: department.doctors.map((doctor) =>
          doctor.doctorId === doctorId
            ? {
                ...doctor,
                schedules: doctor.schedules.map((schedule) =>
                  schedule.day === day
                    ? {
                        ...schedule,
                        breakTimes: [
                          ...schedule.breakTimes,
                          makeBreak(doctor.doctorId, schedule.day),
                        ],
                      }
                    : schedule
                ),
              }
            : doctor
        ),
      }))
    );
  };

  const updateBreakTime = (
    doctorId: string,
    day: string,
    breakId: string,
    field: keyof Omit<DummyBreakTime, "id">,
    value: string
  ) => {
    setDoctorAvailability((departments) =>
      departments.map((department) => ({
        ...department,
        doctors: department.doctors.map((doctor) =>
          doctor.doctorId === doctorId
            ? {
                ...doctor,
                schedules: doctor.schedules.map((schedule) =>
                  schedule.day === day
                    ? {
                        ...schedule,
                        breakTimes: schedule.breakTimes.map((breakTime) =>
                          breakTime.id === breakId
                            ? { ...breakTime, [field]: value }
                            : breakTime
                        ),
                      }
                    : schedule
                ),
              }
            : doctor
        ),
      }))
    );
  };

  const removeBreakTime = (doctorId: string, day: string, breakId: string) => {
    setDoctorAvailability((departments) =>
      departments.map((department) => ({
        ...department,
        doctors: department.doctors.map((doctor) =>
          doctor.doctorId === doctorId
            ? {
                ...doctor,
                schedules: doctor.schedules.map((schedule) =>
                  schedule.day === day
                    ? {
                        ...schedule,
                        breakTimes: schedule.breakTimes.filter(
                          (breakTime) => breakTime.id !== breakId
                        ),
                      }
                    : schedule
                ),
              }
            : doctor
        ),
      }))
    );
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
          onClick={() => setExpandedDepartments(new Set())}
          disabled={!canCollapseAll}
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:text-foreground"
        >
          Collapse all
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {doctorAvailability.map((department) => {
          const isDepartmentExpanded = expandedDepartments.has(
            department.departmentId
          );

          return (
            <section key={department.departmentId} className="card">
              <button
                onClick={() => toggleDepartment(department.departmentId)}
                className="flex w-full items-center justify-between p-6 text-left transition-colors hover:bg-muted/30"
              >
                <div>
                  <h2 className="text-2xl font-semibold text-foreground">
                    {department.departmentName}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {department.doctors.length} doctors configured
                  </p>
                </div>
                {isDepartmentExpanded ? (
                  <ChevronUp size={26} className="text-muted-foreground" />
                ) : (
                  <ChevronDown size={26} className="text-muted-foreground" />
                )}
              </button>

              <div
                className={`grid transition-all duration-300 ease-in-out ${
                  isDepartmentExpanded
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
                          {department.doctors.map((doctor) => {
                            const usedDays = new Set(
                              doctor.schedules.map((schedule) => schedule.day)
                            );
                            const availableDays = DAYS.filter(
                              (day) => !usedDays.has(day)
                            );
                            const addDayValue =
                              selectedDays[doctor.doctorId] ?? "";
                            const isDoctorExpanded = expandedDoctors.has(
                              doctor.doctorId
                            );
                            const breakCount = doctor.schedules.reduce(
                              (total, schedule) =>
                                total + schedule.breakTimes.length,
                              0
                            );

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
                                            {schedule.day}
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
                                      onClick={() => toggleDoctor(doctor.doctorId)}
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
                                              Add a day, then tune the slot timing and break windows.
                                            </p>
                                          </div>
                                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                            <select
                                              value={addDayValue}
                                              onChange={(event) =>
                                                setSelectedDays((previousDays) => ({
                                                  ...previousDays,
                                                  [doctor.doctorId]:
                                                    event.target.value,
                                                }))
                                              }
                                              className="h-10 min-w-44 text-sm"
                                            >
                                              <option value="">Select day</option>
                                              {availableDays.map((day) => (
                                                <option key={day} value={day}>
                                                  {day}
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
                                            <button className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90">
                                              <Save size={15} /> Save
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
                                                <th>Break Times</th>
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
                                                      {schedule.day}
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
                                                        value={
                                                          schedule.intervalMinutes
                                                        }
                                                        onChange={(event) =>
                                                          updateSchedule(
                                                            doctor.doctorId,
                                                            schedule.day,
                                                            "intervalMinutes",
                                                            Number(
                                                              event.target.value
                                                            )
                                                          )
                                                        }
                                                        className="h-10 min-w-28 text-sm"
                                                      >
                                                        <option value={10}>
                                                          10 min
                                                        </option>
                                                        <option value={15}>
                                                          15 min
                                                        </option>
                                                        <option value={20}>
                                                          20 min
                                                        </option>
                                                        <option value={30}>
                                                          30 min
                                                        </option>
                                                        <option value={45}>
                                                          45 min
                                                        </option>
                                                        <option value={60}>
                                                          60 min
                                                        </option>
                                                      </select>
                                                    </td>
                                                    <td className="min-w-[440px]">
                                                      <div className="flex flex-col gap-2">
                                                        <button
                                                          onClick={() =>
                                                            addBreakTime(
                                                              doctor.doctorId,
                                                              schedule.day
                                                            )
                                                          }
                                                          className="flex w-fit items-center gap-2 rounded-lg border border-primary/30 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
                                                        >
                                                          <Coffee size={15} /> Add
                                                          break time
                                                        </button>

                                                        {schedule.breakTimes.length >
                                                        0 ? (
                                                          schedule.breakTimes.map(
                                                            (breakTime) => (
                                                              <div
                                                                key={breakTime.id}
                                                                className="grid gap-2 rounded-lg border border-border bg-muted/30 p-2 md:grid-cols-[112px_1fr_auto]"
                                                              >
                                                                <div className="relative">
                                                                  <input
                                                                    type="time"
                                                                    value={
                                                                      breakTime.startTime
                                                                    }
                                                                    onChange={(
                                                                      event
                                                                    ) =>
                                                                      updateBreakTime(
                                                                        doctor.doctorId,
                                                                        schedule.day,
                                                                        breakTime.id,
                                                                        "startTime",
                                                                        event.target
                                                                          .value
                                                                      )
                                                                    }
                                                                    className="h-9 pr-8 text-sm"
                                                                  />
                                                                  <Clock
                                                                    size={14}
                                                                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                                                  />
                                                                </div>
                                                                <input
                                                                  type="text"
                                                                  value={
                                                                    breakTime.reason
                                                                  }
                                                                  onChange={(
                                                                    event
                                                                  ) =>
                                                                    updateBreakTime(
                                                                      doctor.doctorId,
                                                                      schedule.day,
                                                                      breakTime.id,
                                                                      "reason",
                                                                      event.target
                                                                        .value
                                                                    )
                                                                  }
                                                                  className="h-9 text-sm"
                                                                />
                                                                <button
                                                                  onClick={() =>
                                                                    removeBreakTime(
                                                                      doctor.doctorId,
                                                                      schedule.day,
                                                                      breakTime.id
                                                                    )
                                                                  }
                                                                  className="flex h-9 items-center justify-center rounded-lg border border-border px-3 text-muted-foreground transition-colors hover:border-red-300 hover:text-red-600"
                                                                  aria-label="Remove break time"
                                                                >
                                                                  <Trash2
                                                                    size={15}
                                                                  />
                                                                </button>
                                                              </div>
                                                            )
                                                          )
                                                        ) : (
                                                          <p className="text-sm text-muted-foreground">
                                                            No breaks
                                                          </p>
                                                        )}
                                                      </div>
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
    </div>
  );
}
