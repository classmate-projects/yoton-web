"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  Coffee,
  Lock,
  Plus,
  Save,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { ReceptionService } from "@/services/reception.service";
import {
  ScheduleConflict,
  SpecializationAvailabilityType,
} from "@/types/doctorAvailability.type";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { getUserDetail } from "@/lib/userDetail";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type ScheduleField = "startTime" | "endTime" | "slotDurationMinutes" | "maxConcurrentBookings";

interface EditableBreak {
  id: string;
  startTime: string;
  endTime: string;
  reason: string;
}

interface EditableDaySchedule {
  day: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  maxConcurrentBookings: number;
  breaks: EditableBreak[];
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

interface BreakSlotOption {
  start: string;
  end: string;
  disabled: boolean;
}

interface BreakModalState {
  doctorId: string;
  day: number;
  slots: BreakSlotOption[];
}

const addMinutesToTime = (time: string, minutes: number) => {
  const [hours, mins] = time.split(":").map(Number);
  const total = hours * 60 + mins + minutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = Math.floor(wrapped / 60);
  const mm = wrapped % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

const buildBreakSlots = (schedule: EditableDaySchedule): BreakSlotOption[] => {
  const interval = schedule.slotDurationMinutes || 30;
  const slots: BreakSlotOption[] = [];
  let cursor = schedule.startTime;

  while (cursor < schedule.endTime) {
    const end = addMinutesToTime(cursor, interval);
    if (end > schedule.endTime) break;
    const disabled = schedule.breaks.some(
      (brk) => cursor < brk.endTime && end > brk.startTime
    );
    slots.push({ start: cursor, end, disabled });
    cursor = end;
  }

  return slots;
};

const makeSchedule = (day: number): EditableDaySchedule => ({
  day,
  startTime: "09:00",
  endTime: "17:00",
  slotDurationMinutes: 30,
  maxConcurrentBookings: 1,
  breaks: [],
});

const makeClientId = () =>
  `br_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

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
          maxConcurrentBookings: s.maxConcurrentBookings,
          breaks: s.breaks.map((b) => ({
            id: b.breakId,
            startTime: b.start,
            endTime: b.end,
            reason: b.reason ?? "",
          })),
        })),
    })),
  }));

function DoctorAvailabilityInner() {
  const searchParams = useSearchParams();
  const userRole = getUserDetail()?.role;
  // Reception can always edit, matching its access from before this page was opened up
  // to every role as a view. Admin only gets edit rights via the dedicated entry point
  // under Configuration > Departments & Staff (?mode=edit) - the plain User Modules link
  // (used by every other role too) is view-only, even for admin.
  const canEdit = userRole === "reception" || (userRole === "admin" && searchParams.get("mode") === "edit");

  const [isLoading, setIsLoading] = useState(true);
  const [availability, setAvailability] = useState<EditableSpecialization[]>(
    []
  );
  const [expandedSpecializations, setExpandedSpecializations] = useState<
    Set<string>
  >(new Set());
  // Which doctor's schedule editor is open, as a popup - null means none. A single id
  // (not a Set, unlike expandedSpecializations) since only one doctor's configuration
  // can sensibly be edited at a time in a popup.
  const [configDoctorId, setConfigDoctorId] = useState<string | null>(null);
  const [confirmRemoveDay, setConfirmRemoveDay] = useState<{
    doctorId: string;
    day: number;
  } | null>(null);
  const [savingDoctorId, setSavingDoctorId] = useState<string | null>(null);
  // Single toggle, not two separate buttons: expanded (fully or partially) collapses
  // everything on click; fully collapsed expands everything. The old "Collapse all" button
  // stayed disabled unless more than one section was open, so opening just one and
  // clicking it silently did nothing - that bug is gone now that there's one state to read.
  const allSpecializationIds = availability.map((s) => s.specializationId);
  const allExpanded =
    allSpecializationIds.length > 0 &&
    allSpecializationIds.every((id) => expandedSpecializations.has(id));
  const toggleExpandCollapseAll = () => {
    setExpandedSpecializations(allExpanded ? new Set() : new Set(allSpecializationIds));
  };

  const [breakModal, setBreakModal] = useState<BreakModalState | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [breakForm, setBreakForm] = useState({ reason: "Break" });

  const [scheduleConflict, setScheduleConflict] = useState<{
    doctor: EditableDoctor;
    conflicts: ScheduleConflict[];
  } | null>(null);
  const [overrideForm, setOverrideForm] = useState({
    username: "",
    password: "",
  });
  const [overrideError, setOverrideError] = useState<string | null>(null);

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

  useSignalRRefetch(["doctorScheduleUpdated", "doctorAssigned"], fetchAvailability);

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

  const addScheduleDay = (doctorId: string, day: number) => {
    setAvailability((specs) =>
      specs.map((spec) => ({
        ...spec,
        doctors: spec.doctors.map((doctor) =>
          doctor.doctorId === doctorId
            ? {
                ...doctor,
                schedules: [...doctor.schedules, makeSchedule(day)].sort(
                  (a, b) => a.day - b.day
                ),
              }
            : doctor
        ),
      }))
    );
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

  const handleDayPillClick = (
    doctorId: string,
    day: number,
    isConfigured: boolean
  ) => {
    if (isConfigured) {
      setConfirmRemoveDay({ doctorId, day });
    } else {
      addScheduleDay(doctorId, day);
    }
  };

  const openBreakModal = (doctorId: string, day: number) => {
    const doctor = availability
      .flatMap((spec) => spec.doctors)
      .find((d) => d.doctorId === doctorId);
    const schedule = doctor?.schedules.find((s) => s.day === day);
    if (!schedule) return;

    setBreakModal({ doctorId, day, slots: buildBreakSlots(schedule) });
    setSelectedSlots(new Set());
    setBreakForm({ reason: "Break" });
  };

  const closeBreakModal = () => setBreakModal(null);

  const toggleBreakSlot = (start: string) => {
    setSelectedSlots((previous) => {
      const next = new Set(previous);
      if (next.has(start)) {
        next.delete(start);
      } else {
        next.add(start);
      }
      return next;
    });
  };

  const confirmAddBreak = () => {
    if (!breakModal) return;
    const { doctorId, day, slots } = breakModal;

    const chosen = slots
      .filter((slot) => selectedSlots.has(slot.start))
      .sort((a, b) => a.start.localeCompare(b.start));

    if (chosen.length === 0) {
      toast.error("Select at least one slot");
      return;
    }

    // Merge back-to-back selected slots into single break ranges.
    const merged: { startTime: string; endTime: string }[] = [];
    for (const slot of chosen) {
      const last = merged[merged.length - 1];
      if (last && last.endTime === slot.start) {
        last.endTime = slot.end;
      } else {
        merged.push({ startTime: slot.start, endTime: slot.end });
      }
    }

    setAvailability((specs) =>
      specs.map((spec) => ({
        ...spec,
        doctors: spec.doctors.map((doctor) =>
          doctor.doctorId === doctorId
            ? {
                ...doctor,
                schedules: doctor.schedules.map((schedule) =>
                  schedule.day === day
                    ? {
                        ...schedule,
                        breaks: [
                          ...schedule.breaks,
                          ...merged.map((range) => ({
                            id: makeClientId(),
                            startTime: range.startTime,
                            endTime: range.endTime,
                            reason: breakForm.reason.trim() || "Break",
                          })),
                        ].sort((a, b) => a.startTime.localeCompare(b.startTime)),
                      }
                    : schedule
                ),
              }
            : doctor
        ),
      }))
    );

    closeBreakModal();
  };

  const removeBreak = (doctorId: string, day: number, breakId: string) => {
    setAvailability((specs) =>
      specs.map((spec) => ({
        ...spec,
        doctors: spec.doctors.map((doctor) =>
          doctor.doctorId === doctorId
            ? {
                ...doctor,
                schedules: doctor.schedules.map((schedule) =>
                  schedule.day === day
                    ? {
                        ...schedule,
                        breaks: schedule.breaks.filter((b) => b.id !== breakId),
                      }
                    : schedule
                ),
              }
            : doctor
        ),
      }))
    );
  };

  const saveDoctorSchedule = async (
    doctor: EditableDoctor,
    adminOverride?: { username: string; password: string }
  ) => {
    for (const schedule of doctor.schedules) {
      const dayName = DAYS[schedule.day];
      if (schedule.endTime <= schedule.startTime) {
        toast.error(`${dayName}: end time must be after start time`);
        return;
      }

      const sortedBreaks = [...schedule.breaks].sort((a, b) =>
        a.startTime.localeCompare(b.startTime)
      );

      for (let i = 0; i < sortedBreaks.length; i++) {
        const brk = sortedBreaks[i];
        if (brk.endTime <= brk.startTime) {
          toast.error(`${dayName}: break end must be after break start`);
          return;
        }
        if (brk.startTime < schedule.startTime || brk.endTime > schedule.endTime) {
          toast.error(`${dayName}: break must fall within working hours`);
          return;
        }
        const next = sortedBreaks[i + 1];
        if (next && brk.endTime > next.startTime) {
          toast.error(`${dayName}: break times cannot overlap each other`);
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
          maxConcurrentBookings: s.maxConcurrentBookings,
          breaks: s.breaks.map((b) => ({
            startTime: b.startTime,
            endTime: b.endTime,
            reason: b.reason || null,
          })),
        })),
        adminOverride,
      });

      toast.success(data.message || "Schedule updated successfully");
      setScheduleConflict(null);
      setOverrideForm({ username: "", password: "" });
      setOverrideError(null);
      fetchAvailability();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const responseData = error.response?.data;

        if (status === 409 && responseData?.conflicts) {
          setScheduleConflict({ doctor, conflicts: responseData.conflicts });
          setOverrideError(null);
        } else if (status === 401 && adminOverride) {
          setOverrideError(
            responseData?.message || "Invalid admin credentials"
          );
        } else {
          toast.error(responseData?.message || "Failed to update schedule");
        }
      } else {
        toast.error("Failed to update schedule");
      }
    } finally {
      setSavingDoctorId(null);
    }
  };

  const closeScheduleConflict = () => {
    setScheduleConflict(null);
    setOverrideForm({ username: "", password: "" });
    setOverrideError(null);
  };

  // Looked up fresh from `availability` on every render (rather than storing the doctor
  // object itself in state) so the popup keeps reflecting live edits instead of a stale
  // snapshot taken at the moment it was opened.
  const configDoctor = configDoctorId
    ? availability.flatMap((spec) => spec.doctors).find((d) => d.doctorId === configDoctorId) ?? null
    : null;
  const configUsedDays = new Set(configDoctor?.schedules.map((s) => s.day) ?? []);

  return (
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
            <CalendarDays className="text-primary" /> Doctor Availability
          </h1>
          <p className="text-sm text-muted-foreground">
            {canEdit
              ? "Expand a specialization to view doctors, then expand a doctor to configure days, slots, and breaks."
              : "Expand a specialization to view doctors, then expand a doctor to see their days, slots, and breaks."}
          </p>
        </div>
        <button
          onClick={toggleExpandCollapseAll}
          disabled={availability.length === 0}
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:text-foreground"
        >
          {allExpanded ? "Collapse all" : "Expand all"}
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
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                        {specialization.doctors.map((doctor) => {
                          const breakCount = doctor.schedules.reduce(
                            (total, s) => total + s.breaks.length,
                            0
                          );

                          return (
                            <div
                              key={doctor.doctorId}
                              className="card flex flex-col gap-3 p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-foreground">
                                    {doctor.doctorName}
                                  </p>
                                  <p className="truncate text-sm font-semibold text-primary">
                                    {doctor.specialization}
                                  </p>
                                </div>
                                <button
                                  onClick={() => setConfigDoctorId(doctor.doctorId)}
                                  aria-label={canEdit ? "Configure availability" : "View availability"}
                                  title={canEdit ? "Configure availability" : "View availability"}
                                  className="flex shrink-0 p-2 items-center justify-center rounded-full outline-none cursor-pointer border border-border text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                                >
                                  <Settings size={18} />
                                </button>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {doctor.schedules.length > 0 ? (
                                  doctor.schedules.map((schedule) => (
                                    <span
                                      key={schedule.day}
                                      className="rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs font-semibold text-foreground"
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

                              <div className="mt-auto flex items-center gap-4 border-t border-border pt-2 text-xs text-muted-foreground">
                                <span>
                                  <strong className="font-semibold text-foreground">
                                    {doctor.schedules.length}
                                  </strong>{" "}
                                  days configured
                                </span>
                                <span>
                                  <strong className="font-semibold text-foreground">
                                    {breakCount}
                                  </strong>{" "}
                                  breaks
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Doctor schedule configuration popup */}
      {configDoctor && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto p-6 border border-border">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {configDoctor.doctorName} {canEdit ? "configuration" : "availability"}
                </h2>
                <p className="text-sm font-semibold text-primary">{configDoctor.specialization}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {canEdit
                    ? "Tap a day to add it, tap an added day to remove it, then tune slot timing and breaks."
                    : "Working days, slot timing, and breaks for this doctor."}
                </p>
              </div>
              <button
                onClick={() => setConfigDoctorId(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-sm font-semibold text-foreground">Working days</p>
                  {canEdit && (
                    <button
                      onClick={() => saveDoctorSchedule(configDoctor)}
                      disabled={savingDoctorId === configDoctor.doctorId}
                      className="flex h-10 w-fit items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Save size={15} />{" "}
                      {savingDoctorId === configDoctor.doctorId ? "Saving..." : "Save"}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {canEdit
                    ? DAYS.map((name, index) => {
                        const isConfigured = configUsedDays.has(index);
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() =>
                              handleDayPillClick(configDoctor.doctorId, index, isConfigured)
                            }
                            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                              isConfigured
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border text-foreground hover:border-primary/40"
                            }`}
                          >
                            {name}
                          </button>
                        );
                      })
                    : DAYS.map((name, index) =>
                        configUsedDays.has(index) ? (
                          <span
                            key={name}
                            className="rounded-lg border border-primary bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                          >
                            {name}
                          </span>
                        ) : null
                      )}
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="table-no-row-hover table-compact w-full">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Interval</th>
                      <th>Max/slot</th>
                      <th>Break Times</th>
                      {canEdit && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {configDoctor.schedules.length > 0 ? (
                      configDoctor.schedules.map((schedule) => (
                        <tr key={`${configDoctor.doctorId}-${schedule.day}`}>
                          <td className="font-semibold">{DAYS[schedule.day]}</td>
                          <td>
                            {canEdit ? (
                              <div className="relative min-w-28">
                                <input
                                  type="time"
                                  value={schedule.startTime}
                                  onChange={(event) =>
                                    updateSchedule(
                                      configDoctor.doctorId,
                                      schedule.day,
                                      "startTime",
                                      event.target.value
                                    )
                                  }
                                  className="h-10 min-w-28 pr-9 text-sm"
                                />
                                <Clock
                                  size={15}
                                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                />
                              </div>
                            ) : (
                              <span className="text-sm text-foreground">{schedule.startTime}</span>
                            )}
                          </td>
                          <td>
                            {canEdit ? (
                              <div className="relative min-w-28">
                                <input
                                  type="time"
                                  value={schedule.endTime}
                                  onChange={(event) =>
                                    updateSchedule(
                                      configDoctor.doctorId,
                                      schedule.day,
                                      "endTime",
                                      event.target.value
                                    )
                                  }
                                  className="h-10 min-w-28 pr-9 text-sm"
                                />
                                <Clock
                                  size={15}
                                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                />
                              </div>
                            ) : (
                              <span className="text-sm text-foreground">{schedule.endTime}</span>
                            )}
                          </td>
                          <td>
                            {canEdit ? (
                              <select
                                value={schedule.slotDurationMinutes}
                                onChange={(event) =>
                                  updateSchedule(
                                    configDoctor.doctorId,
                                    schedule.day,
                                    "slotDurationMinutes",
                                    Number(event.target.value)
                                  )
                                }
                                className="h-10 min-w-24 text-sm"
                              >
                                <option value={10}>10 min</option>
                                <option value={15}>15 min</option>
                                <option value={20}>20 min</option>
                                <option value={30}>30 min</option>
                                <option value={45}>45 min</option>
                                <option value={60}>60 min</option>
                              </select>
                            ) : (
                              <span className="text-sm text-foreground">{schedule.slotDurationMinutes} min</span>
                            )}
                          </td>
                          <td>
                            {canEdit ? (
                              <select
                                value={schedule.maxConcurrentBookings}
                                onChange={(event) =>
                                  updateSchedule(
                                    configDoctor.doctorId,
                                    schedule.day,
                                    "maxConcurrentBookings",
                                    Number(event.target.value)
                                  )
                                }
                                title="How many patients can be booked into the same slot"
                                className="h-10 min-w-20 text-sm"
                              >
                                <option value={1}>1 patient</option>
                                <option value={2}>2 patients</option>
                                <option value={3}>3 patients</option>
                              </select>
                            ) : (
                              <span className="text-sm text-foreground">
                                {schedule.maxConcurrentBookings} patient{schedule.maxConcurrentBookings === 1 ? "" : "s"}
                              </span>
                            )}
                          </td>
                          <td className="min-w-[200px]">
                            <div className="flex flex-col gap-2">
                              {canEdit && (
                                <button
                                  onClick={() => openBreakModal(configDoctor.doctorId, schedule.day)}
                                  className="flex w-fit items-center gap-2 rounded-lg border border-primary/30 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
                                >
                                  <Coffee size={15} /> Add break time
                                </button>
                              )}

                              {schedule.breaks.length > 0 ? (
                                <div className="flex flex-col gap-1.5">
                                  {schedule.breaks.map((brk) => (
                                    <div
                                      key={brk.id}
                                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-1.5"
                                    >
                                      <span className="text-sm font-medium text-foreground">
                                        {brk.startTime} - {brk.endTime}
                                      </span>
                                      <span className="truncate text-xs text-muted-foreground">
                                        {brk.reason}
                                      </span>
                                      {canEdit && (
                                        <button
                                          onClick={() =>
                                            removeBreak(configDoctor.doctorId, schedule.day, brk.id)
                                          }
                                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                                          aria-label="Remove break"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">No breaks</p>
                              )}
                            </div>
                          </td>
                          {canEdit && (
                            <td>
                              <button
                                onClick={() => removeScheduleDay(configDoctor.doctorId, schedule.day)}
                                className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:border-red-300 hover:text-red-600"
                              >
                                Remove
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={canEdit ? 7 : 6} className="text-center text-muted-foreground">
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
      )}

      {/* Add break modal */}
      {breakModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-2xl max-w-sm w-full p-6 border border-border">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                  <Coffee size={20} className="text-primary" /> Add break time
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {DAYS[breakModal.day]}
                </p>
              </div>
              <button
                onClick={closeBreakModal}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground/90 mb-2">
                  Select slots to mark as break
                </label>
                {breakModal.slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Set a start time, end time, and interval for this day first.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                    {breakModal.slots.map((slot) => {
                      const isSelected = selectedSlots.has(slot.start);
                      return (
                        <button
                          key={slot.start}
                          type="button"
                          disabled={slot.disabled}
                          onClick={() => toggleBreakSlot(slot.start)}
                          className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
                            slot.disabled
                              ? "cursor-not-allowed border-border bg-muted/40 text-muted-foreground/50"
                              : isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border text-foreground hover:border-primary/40"
                          }`}
                        >
                          {slot.start}
                          {slot.disabled && (
                            <span className="block text-[10px]">Break</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {selectedSlots.size} slot{selectedSlots.size === 1 ? "" : "s"} selected
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground/90 mb-2">
                  Reason
                </label>
                <input
                  type="text"
                  value={breakForm.reason}
                  onChange={(event) =>
                    setBreakForm((previous) => ({
                      ...previous,
                      reason: event.target.value,
                    }))
                  }
                  placeholder="e.g. Lunch, Rounds, Procedure buffer"
                  className="w-full h-10 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={closeBreakModal}
                className="flex-1 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAddBreak}
                disabled={selectedSlots.size === 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:opacity-90 text-white font-semibold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={16} /> Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm remove already-configured day */}
      {confirmRemoveDay && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-2xl max-w-sm w-full p-6 border border-border">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                Day already configured
              </h2>
              <button
                onClick={() => setConfirmRemoveDay(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-6">
              {DAYS[confirmRemoveDay.day]} {" "}already has slots and breaks
              configured for this doctor. Remove this day&apos;s
              configuration?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmRemoveDay(null)}
                className="flex-1 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  removeScheduleDay(
                    confirmRemoveDay.doctorId,
                    confirmRemoveDay.day
                  );
                  setConfirmRemoveDay(null);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:opacity-90 text-white font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 size={16} /> Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Appointment conflict - requires admin override to proceed */}
      {scheduleConflict && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-2xl max-w-md w-full p-6 border border-border">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <AlertTriangle size={20} className="text-red-600" />
                  Existing appointments block this change
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {scheduleConflict.doctor.doctorName}
                </p>
              </div>
              <button
                onClick={closeScheduleConflict}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-3">
              This change would leave {scheduleConflict.conflicts.length}{" "}
              already-booked appointment
              {scheduleConflict.conflicts.length === 1 ? "" : "s"} without a
              valid slot:
            </p>

            <div className="max-h-40 overflow-y-auto flex flex-col gap-1.5 mb-4">
              {scheduleConflict.conflicts.map((conflict, index) => (
                <div
                  key={conflict.appointmentId ?? index}
                  className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm"
                >
                  <span className="font-semibold text-foreground">
                    {conflict.patientName ?? "Unknown patient"}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    — {conflict.day}, {conflict.date} at {conflict.time}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-sm font-semibold text-foreground/90 mb-2 flex items-center gap-2">
                <Lock size={14} /> Enter admin credentials to proceed anyway
              </p>
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={overrideForm.username}
                  onChange={(event) =>
                    setOverrideForm((previous) => ({
                      ...previous,
                      username: event.target.value,
                    }))
                  }
                  placeholder="Admin username"
                  className="w-full h-10 text-sm"
                />
                <input
                  type="password"
                  value={overrideForm.password}
                  onChange={(event) =>
                    setOverrideForm((previous) => ({
                      ...previous,
                      password: event.target.value,
                    }))
                  }
                  placeholder="Admin password"
                  className="w-full h-10 text-sm"
                />
              </div>
              {overrideError && (
                <p className="text-sm text-red-600 mt-2">{overrideError}</p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeScheduleConflict}
                className="flex-1 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  saveDoctorSchedule(scheduleConflict.doctor, {
                    username: overrideForm.username,
                    password: overrideForm.password,
                  })
                }
                disabled={
                  !overrideForm.username.trim() ||
                  !overrideForm.password ||
                  savingDoctorId === scheduleConflict.doctor.doctorId
                }
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:opacity-90 text-white font-semibold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Lock size={16} />{" "}
                {savingDoctorId === scheduleConflict.doctor.doctorId
                  ? "Verifying..."
                  : "Proceed as admin"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DoctorAvailability() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner />
        </div>
      }
    >
      <DoctorAvailabilityInner />
    </Suspense>
  );
}
