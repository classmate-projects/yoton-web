"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeft,
  Bell,
  CalendarCheck2,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  ListChecks,
  LogIn,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  Stethoscope,
  Users,
  X,
  XCircle,
} from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import DatePicker from "@/components/DatePicker";
import { ReceptionService } from "@/services/reception.service";
import { ChatService } from "@/services/chat.service";
import { getChatConnection } from "@/lib/chatSignalR";
import {
  AppointmentRequestType,
  AppointmentSlotType,
  DoctorDaySlotsType,
  DoctorGridType,
  PatientListItemType,
  SpecializationDoctorsType,
} from "@/types/appointment.type";
import { PendingFollowUpType } from "@/types/emr.type";
import { VisitType } from "@/types/visit.type";
import { SpecializationAvailabilityType } from "@/types/doctorAvailability.type";
import { useAppointmentRequestSignalR } from "@/hooks/useAppointmentRequestSignalR";
import { getInitials } from "@/lib/getInitials";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { getCurrencySymbol } from "@/lib/currency";

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// A doctor's status dot, shown on their own card (and, for a whole specialty's heading,
// whether *any* doctor in it clears "scheduled"):
//  - "online"      - has a working day inside the selected range, that range includes today,
//                     and they're currently connected to the app (the same live chat presence
//                     used on the Messages page).
//  - "idle"        - has a working day inside the selected range, just not both of the above
//                     (e.g. the range is a past/future date, or they're on shift but not
//                     currently connected - there's no live signal to show either way).
//  - "unavailable" - no working day at all falls inside the selected range.
type DoctorStatus = "online" | "idle" | "unavailable";

const STATUS_DOT_CLASS: Record<DoctorStatus, string> = {
  online: "bg-emerald-500",
  idle: "bg-amber-500",
  unavailable: "bg-gray-400",
};

const STATUS_LABEL: Record<DoctorStatus, string> = {
  online: "Online",
  idle: "Idle",
  unavailable: "Not available",
};

const isDateWithinRange = (isoDate: string | null | undefined, from: string, to: string) => {
  if (!isoDate) return false;
  const day = toDateInputValue(new Date(isoDate));
  return day >= from && day <= to;
};

// Every day-of-week (0=Sunday..6=Saturday) that occurs at least once between `from` and `to`
// (inclusive). Schedules repeat weekly, so once every day-of-week has shown up once, a longer
// range can't add anything new - capped at 7 iterations either way.
const daysOfWeekInRange = (from: Date, to: Date): Set<number> => {
  const days = new Set<number>();
  const spanDays = Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
  const iterations = Math.min(spanDays + 1, 7);
  for (let i = 0; i < iterations; i++) {
    days.add(new Date(from.getTime() + i * 86_400_000).getDay());
  }
  return days;
};

export default function Appointments() {
  const [isLoadingGrid, setIsLoadingGrid] = useState(true);
  const [specializations, setSpecializations] = useState<
    SpecializationDoctorsType[]
  >([]);

  // ---------------- Date range filter (doctor availability + the lists below it) ----------------
  const todayValue = useMemo(() => toDateInputValue(new Date()), []);
  const [fromDate, setFromDate] = useState(todayValue);
  const [toDate, setToDate] = useState(todayValue);

  // ---------------- Doctor status dots (schedule + live chat presence) ----------------
  const [doctorAvailability, setDoctorAvailability] = useState<SpecializationAvailabilityType[]>([]);
  const [presence, setPresence] = useState<Record<string, boolean>>({});

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
  const [isFollowUp, setIsFollowUp] = useState(false);
  const [urgencyLevel, setUrgencyLevel] = useState("Routine");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [visitQueue, setVisitQueue] = useState<VisitType[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [queuePage, setQueuePage] = useState(1);
  const QUEUE_PAGE_SIZE = 5;

  // ---------------- Edit visit (Visit queue "Edit") ----------------
  // Nurses already see checked-in patients waiting for them on their own Nursing dashboard
  // (Patient Monitoring's "untouched" list), so a "Start Nursing" shortcut here was a
  // redundant second door into the same queue. Reception's actual day-to-day need on this
  // table is fixing a visit that's wrong - moved to the wrong doctor, booked for the wrong
  // time - so this reuses the same PUT /api/reception/visit/{id} reassignment the Patient
  // Records "Edit Visit" button already calls, just in a lighter modal (this page already
  // has every doctor loaded for its own booking grid above, so no extra fetch is needed).
  const [editingQueueVisit, setEditingQueueVisit] = useState<VisitType | null>(null);
  const [editVisitDoctorSearch, setEditVisitDoctorSearch] = useState("");
  const [editVisitSelectedDoctor, setEditVisitSelectedDoctor] = useState<DoctorGridType | null>(null);
  const [editVisitDate, setEditVisitDate] = useState<Date>(new Date());
  const [editVisitDaySlots, setEditVisitDaySlots] = useState<DoctorDaySlotsType | null>(null);
  const [isLoadingEditVisitSlots, setIsLoadingEditVisitSlots] = useState(false);
  const [editVisitSelectedSlot, setEditVisitSelectedSlot] = useState<AppointmentSlotType | null>(null);
  const [editVisitNotes, setEditVisitNotes] = useState("");
  const [isSavingEditVisit, setIsSavingEditVisit] = useState(false);

  const [appointmentRequests, setAppointmentRequests] = useState<
    AppointmentRequestType[]
  >([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<
    string | null
  >(null);

  // ---------------- Pending follow-ups (doctor-requested, awaiting reception) ----------------
  const [pendingFollowUps, setPendingFollowUps] = useState<PendingFollowUpType[]>([]);
  const [isLoadingFollowUps, setIsLoadingFollowUps] = useState(false);
  const [dismissingFollowUpId, setDismissingFollowUpId] = useState<string | null>(null);
  // Confirming a follow-up needs an actual bookable slot, unlike Appointment Requests'
  // one-click Confirm - FollowUp.followUpDate is only ever a day the doctor suggested, so
  // this opens its own small date+slot picker for that fixed doctor (see openConfirmFollowUp).
  const [confirmingFollowUp, setConfirmingFollowUp] = useState<PendingFollowUpType | null>(null);
  const [followUpConfirmDate, setFollowUpConfirmDate] = useState<Date>(new Date());
  const [followUpDaySlots, setFollowUpDaySlots] = useState<DoctorDaySlotsType | null>(null);
  const [isLoadingFollowUpSlots, setIsLoadingFollowUpSlots] = useState(false);
  const [followUpSelectedSlot, setFollowUpSelectedSlot] = useState<AppointmentSlotType | null>(null);
  const [isConfirmingFollowUp, setIsConfirmingFollowUp] = useState(false);

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

  useSignalRRefetch(["doctorScheduleUpdated"], fetchGrid);

  // ---------------- Fetch doctor weekly schedules (for the status dots) ----------------
  // Reuses the same catalog the Doctor Availability page edits - one full weekly schedule per
  // doctor, fetched once, so checking "does this doctor work on day X" for the selected range
  // is a client-side lookup instead of a per-doctor request.
  const fetchDoctorAvailability = async () => {
    try {
      const data = await ReceptionService.getDoctorAvailability();
      setDoctorAvailability(data.data ?? []);
    } catch (error) {
      console.error("Failed to fetch doctor availability:", error);
    }
  };

  useEffect(() => {
    fetchDoctorAvailability();
  }, []);

  useSignalRRefetch(["doctorScheduleUpdated", "doctorAssigned"], fetchDoctorAvailability);

  // ---------------- Live presence for the status dots ("online" tier) ----------------
  // Same mechanism as the Messages page: an initial REST snapshot for whichever doctors are
  // actually on this page, kept current afterwards by the shared /chat-hub connection's
  // "presenceChanged" event rather than polling.
  const doctorUserIds = useMemo(() => {
    const ids = specializations.flatMap((s) => s.doctors.map((d) => d.userId).filter((id): id is string => !!id));
    return Array.from(new Set(ids)).sort();
  }, [specializations]);
  const doctorUserIdsKey = doctorUserIds.join(",");

  useEffect(() => {
    if (!doctorUserIdsKey) return;
    ChatService.getPresence(doctorUserIds)
      .then((res) => {
        const map: Record<string, boolean> = {};
        (res.data || []).forEach((entry: { userId: string; isOnline: boolean }) => {
          map[entry.userId] = entry.isOnline;
        });
        setPresence((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorUserIdsKey]);

  useEffect(() => {
    let isMounted = true;
    const handlePresenceChanged = (payload: { userId: string; isOnline: boolean }) => {
      if (!isMounted) return;
      setPresence((prev) => ({ ...prev, [payload.userId]: payload.isOnline }));
    };

    getChatConnection()
      .then((connection) => {
        if (!isMounted) return;
        connection.off("presenceChanged", handlePresenceChanged);
        connection.on("presenceChanged", handlePresenceChanged);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
      getChatConnection()
        .then((connection) => connection.off("presenceChanged", handlePresenceChanged))
        .catch(() => {});
    };
  }, []);

  // Doctors with at least one working day inside [fromDate, toDate] - the specialty-level dot
  // is just "does this specialty have any doctor in this set".
  const scheduledDoctorIds = useMemo(() => {
    const from = new Date(`${fromDate}T00:00:00`);
    const to = new Date(`${toDate}T00:00:00`);
    const days = daysOfWeekInRange(from, to);
    const ids = new Set<string>();
    doctorAvailability.forEach((spec) => {
      spec.doctors.forEach((doc) => {
        if (doc.schedules.some((sch) => days.has(sch.day))) ids.add(doc.doctorId);
      });
    });
    return ids;
  }, [doctorAvailability, fromDate, toDate]);

  // "Online" only ever applies to *today* - a doctor can't be live-connected on a date that
  // hasn't happened yet or has already passed.
  const rangeIncludesToday = fromDate <= todayValue && todayValue <= toDate;

  const getDoctorStatus = (doctor: DoctorGridType): DoctorStatus => {
    if (!scheduledDoctorIds.has(doctor.doctorId)) return "unavailable";
    if (rangeIncludesToday && doctor.userId && presence[doctor.userId]) return "online";
    return "idle";
  };

  const isSpecialtyAvailable = (spec: SpecializationDoctorsType) =>
    spec.doctors.some((d) => scheduledDoctorIds.has(d.doctorId));

  // ---------------- Fetch patients (for booking search) ----------------
  const fetchPatients = async () => {
    try {
      const data = await ReceptionService.getAllPatients();
      setPatients(data.patients ?? []);
    } catch (error) {
      console.error("Failed to fetch patients:", error);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  useSignalRRefetch(["patientRegistered", "PatientUpdated", "patientSoftDeleted"], fetchPatients);

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
    // Long-interval safety net only, not the primary refresh mechanism - every stage
    // transition (check-in, nursing, doctor, investigations, pharmacy, billing) now
    // broadcasts visitCheckedIn/visitStatusUpdated (see useSignalRRefetch below), so this
    // is just insurance against a dropped connection instead of the 20s poll this used to
    // be running unconditionally for every open tab.
    const interval = setInterval(fetchVisitQueue, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useSignalRRefetch(["visitCheckedIn", "visitStatusUpdated"], fetchVisitQueue);

  const openEditQueueVisit = (visit: VisitType) => {
    setEditingQueueVisit(visit);
    setEditVisitDoctorSearch("");
    setEditVisitSelectedDoctor(null);
    setEditVisitDate(visit.appointmentDate ? new Date(visit.appointmentDate) : new Date());
    setEditVisitDaySlots(null);
    setEditVisitSelectedSlot(null);
    setEditVisitNotes(visit.notes ?? "");
  };

  const closeEditQueueVisit = () => {
    setEditingQueueVisit(null);
    setEditVisitSelectedDoctor(null);
    setEditVisitDaySlots(null);
    setEditVisitSelectedSlot(null);
  };

  // Flattened once from the same `specializations` catalog the main booking grid above
  // already loads - an 11-doctor clinic doesn't need its own department/specialty dropdowns
  // on top of a search box, just something to narrow the list by name or specialty.
  const editVisitDoctorOptions = useMemo(
    () => specializations.flatMap((s) => s.doctors.map((d) => ({ ...d, specializationName: s.specializationName }))),
    [specializations]
  );

  const editVisitDoctorResults = useMemo(() => {
    const term = editVisitDoctorSearch.trim().toLowerCase();
    if (term.length === 0) return editVisitDoctorOptions;
    return editVisitDoctorOptions.filter(
      (d) => d.name.toLowerCase().includes(term) || d.specializationName.toLowerCase().includes(term)
    );
  }, [editVisitDoctorOptions, editVisitDoctorSearch]);

  const fetchEditVisitSlots = async (doctorId: string, date: Date) => {
    try {
      setIsLoadingEditVisitSlots(true);
      setEditVisitSelectedSlot(null);
      const data = await ReceptionService.getDoctorSlots(doctorId, toDateInputValue(date));
      setEditVisitDaySlots(data.data ?? null);
    } catch (error) {
      console.error("Failed to fetch doctor slots:", error);
      toast.error("Failed to load slots for this doctor");
      setEditVisitDaySlots(null);
    } finally {
      setIsLoadingEditVisitSlots(false);
    }
  };

  useEffect(() => {
    if (editVisitSelectedDoctor) fetchEditVisitSlots(editVisitSelectedDoctor.doctorId, editVisitDate);
  }, [editVisitSelectedDoctor, editVisitDate]);

  const handleSaveEditVisit = async () => {
    if (!editingQueueVisit || !editVisitSelectedDoctor || !editVisitSelectedSlot) {
      toast.warning("Please select a doctor and an available time slot");
      return;
    }
    try {
      setIsSavingEditVisit(true);
      const data = await ReceptionService.reassignVisit(editingQueueVisit.visitId, {
        doctorId: editVisitSelectedDoctor.doctorId,
        appointmentDate: editVisitSelectedSlot.start,
        notes: editVisitNotes || undefined,
      });
      if (data.status === false) {
        toast.error(data.message || "This slot has just been booked. Please choose another slot.");
        fetchEditVisitSlots(editVisitSelectedDoctor.doctorId, editVisitDate);
        return;
      }
      toast.success(data.message || "Visit updated");
      closeEditQueueVisit();
      fetchVisitQueue();
    } catch (error) {
      toast.error(
        axios.isAxiosError(error) ? error.response?.data?.message || "Failed to update visit" : "Failed to update visit"
      );
    } finally {
      setIsSavingEditVisit(false);
    }
  };

  // ---------------- Fetch pending appointment requests (from mobile self-booking) ----------------
  const fetchAppointmentRequests = async () => {
    try {
      setIsLoadingRequests(true);
      const data = await ReceptionService.getAppointmentRequests();
      setAppointmentRequests(data.data ?? []);
    } catch (error) {
      console.error("Failed to fetch appointment requests:", error);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  useEffect(() => {
    fetchAppointmentRequests();
  }, []);

  // Live-updated the moment a patient submits a request from the mobile app, in addition
  // to the notification bell in the sidebar.
  useAppointmentRequestSignalR((event) => {
    setAppointmentRequests((prev) => {
      if (prev.some((r) => r.appointmentId === event.appointmentId)) return prev;
      return [
        {
          appointmentId: event.appointmentId,
          patientId: event.patientId,
          patientName: event.patientName,
          doctorId: event.doctorId,
          doctorName: event.doctorName,
          appointmentDate: event.appointmentDate,
          notes: event.notes,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ];
    });
  });

  const handleRespondToRequest = async (
    request: AppointmentRequestType,
    status: "Scheduled" | "Cancelled"
  ) => {
    try {
      setProcessingRequestId(request.appointmentId);
      const data = await ReceptionService.updateAppointmentStatus(
        request.appointmentId,
        status
      );
      toast.success(
        status === "Scheduled"
          ? "Appointment confirmed"
          : data.message || "Request declined"
      );
      setAppointmentRequests((prev) =>
        prev.filter((r) => r.appointmentId !== request.appointmentId)
      );
      if (selectedDoctor && selectedDoctor.doctorId === request.doctorId) {
        fetchSlots(selectedDoctor.doctorId, selectedDate);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Failed to update the request");
      } else {
        toast.error("Failed to update the request");
      }
    } finally {
      setProcessingRequestId(null);
    }
  };

  // ---------------- Fetch pending follow-ups (doctor-requested) ----------------
  const fetchPendingFollowUps = async () => {
    try {
      setIsLoadingFollowUps(true);
      const data = await ReceptionService.getPendingFollowUps();
      setPendingFollowUps(data.data ?? []);
    } catch (error) {
      console.error("Failed to fetch pending follow-ups:", error);
    } finally {
      setIsLoadingFollowUps(false);
    }
  };

  useEffect(() => {
    fetchPendingFollowUps();
  }, []);

  // A full refetch (rather than a bespoke incremental merge) on either event - same
  // "just reload the small list" approach this page already uses for the grid/patients/
  // visit queue above, and simpler to keep correct than hand-merging live payloads.
  useSignalRRefetch(["followUpAdded", "followUpResolved"], fetchPendingFollowUps);

  const openConfirmFollowUp = (followUp: PendingFollowUpType) => {
    setConfirmingFollowUp(followUp);
    setFollowUpConfirmDate(new Date(followUp.followUpDate));
    setFollowUpDaySlots(null);
    setFollowUpSelectedSlot(null);
  };

  const closeConfirmFollowUp = () => {
    setConfirmingFollowUp(null);
    setFollowUpDaySlots(null);
    setFollowUpSelectedSlot(null);
  };

  const fetchFollowUpSlots = async (doctorId: string, date: Date) => {
    try {
      setIsLoadingFollowUpSlots(true);
      setFollowUpSelectedSlot(null);
      const data = await ReceptionService.getDoctorSlots(doctorId, toDateInputValue(date));
      setFollowUpDaySlots(data.data ?? null);
    } catch (error) {
      console.error("Failed to fetch doctor slots:", error);
      toast.error("Failed to load slots for this doctor");
      setFollowUpDaySlots(null);
    } finally {
      setIsLoadingFollowUpSlots(false);
    }
  };

  useEffect(() => {
    if (confirmingFollowUp?.doctorId) {
      fetchFollowUpSlots(confirmingFollowUp.doctorId, followUpConfirmDate);
    }
  }, [confirmingFollowUp, followUpConfirmDate]);

  const handleConfirmFollowUp = async () => {
    if (!confirmingFollowUp || !followUpSelectedSlot) {
      toast.warning("Please select an available time slot");
      return;
    }
    try {
      setIsConfirmingFollowUp(true);
      const data = await ReceptionService.confirmFollowUp(confirmingFollowUp.followUpId, followUpSelectedSlot.start);
      if (data.status === false) {
        toast.error(data.message || "This slot has just been booked. Please choose another slot.");
        fetchFollowUpSlots(confirmingFollowUp.doctorId!, followUpConfirmDate);
        return;
      }
      toast.success(data.message || "Follow-up confirmed and appointment booked");
      setPendingFollowUps((prev) => prev.filter((f) => f.followUpId !== confirmingFollowUp.followUpId));
      closeConfirmFollowUp();
    } catch (error) {
      toast.error(
        axios.isAxiosError(error) ? error.response?.data?.message || "Failed to confirm follow-up" : "Failed to confirm follow-up"
      );
    } finally {
      setIsConfirmingFollowUp(false);
    }
  };

  const handleDismissFollowUp = async (followUp: PendingFollowUpType) => {
    try {
      setDismissingFollowUpId(followUp.followUpId);
      const data = await ReceptionService.dismissFollowUp(followUp.followUpId);
      toast.success(data.message || "Follow-up dismissed");
      setPendingFollowUps((prev) => prev.filter((f) => f.followUpId !== followUp.followUpId));
    } catch (error) {
      toast.error(
        axios.isAxiosError(error) ? error.response?.data?.message || "Failed to dismiss follow-up" : "Failed to dismiss follow-up"
      );
    } finally {
      setDismissingFollowUpId(null);
    }
  };

  // Walk-ins have no appointmentDate, so they fall back to when they were actually checked in -
  // both are "when this visit happened/is happening", just from whichever source the visit has.
  const dateFilteredVisitQueue = useMemo(
    () => visitQueue.filter((v) => isDateWithinRange(v.appointmentDate ?? v.checkedInAt, fromDate, toDate)),
    [visitQueue, fromDate, toDate]
  );

  const sortedVisitQueue = useMemo(() => {
    return [...dateFilteredVisitQueue].sort((a, b) => {
      const aTime = new Date(a.appointmentDate ?? a.checkedInAt).getTime();
      const bTime = new Date(b.appointmentDate ?? b.checkedInAt).getTime();
      return aTime - bTime;
    });
  }, [dateFilteredVisitQueue]);

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

  useSignalRRefetch(["appointmentCreated", "appointmentCancelled", "appointmentStatusUpdated"], () => {
    if (selectedDoctor) fetchSlots(selectedDoctor.doctorId, selectedDate);
  });

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

  // The doctor grid is search-driven, not shown by default - with every specialty and
  // every one of its doctors rendered at once, an empty search would otherwise dump the
  // entire staff directory onto the page before the user has asked to find anyone.
  const hasActiveDoctorFilter = searchTerm.trim().length > 0 || selectedSpecializationId !== "all";

  const filteredPendingFollowUps = useMemo(
    () => pendingFollowUps.filter((f) => isDateWithinRange(f.followUpDate, fromDate, toDate)),
    [pendingFollowUps, fromDate, toDate]
  );

  const filteredAppointmentRequests = useMemo(
    () => appointmentRequests.filter((r) => isDateWithinRange(r.appointmentDate, fromDate, toDate)),
    [appointmentRequests, fromDate, toDate]
  );

  const handleSelectSlot = (slot: DoctorDaySlotsType["slots"][number]) => {
    if (slot.isPast) return;
    if (slot.isAvailable) {
      setBookingSlot(slot);
      setPatientSearch("");
      setSelectedPatient(null);
      setNotes("");
      setIsFollowUp(false);
      setUrgencyLevel("Routine");
    } else {
      setCancelSlot(slot);
    }
  };

  const filteredPatients = patientSearch.trim()
    ? patients.filter(
        (p) =>
          p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
          p.phone?.toLowerCase().includes(patientSearch.toLowerCase()) ||
          p.opNumber?.toLowerCase().includes(patientSearch.toLowerCase()) ||
          p.opId?.toLowerCase().includes(patientSearch.toLowerCase()) ||
          p.nationalID?.toLowerCase().includes(patientSearch.toLowerCase()) ||
          p.passportNumber?.toLowerCase().includes(patientSearch.toLowerCase())
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
        isFollowUp,
        urgencyLevel,
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

  const handleCheckIn = async (appointmentId?: string) => {
    const targetId = appointmentId ?? cancelSlot?.appointmentId;
    if (!targetId) return;

    try {
      setIsSubmitting(true);
      const data = await ReceptionService.checkIn({
        appointmentId: targetId,
      });
      toast.success(data.message || "Patient checked in");
      // Only a single-booking slot closes the modal automatically; a shared
      // slot stays open so staff can act on the remaining bookings too.
      if (!cancelSlot || cancelSlot.bookings.length <= 1) {
        setCancelSlot(null);
      }
      fetchVisitQueue();
      if (selectedDoctor) fetchSlots(selectedDoctor.doctorId, selectedDate);
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

  const handleConfirmCancel = async (appointmentId?: string) => {
    const targetId = appointmentId ?? cancelSlot?.appointmentId;
    if (!targetId || !selectedDoctor) return;

    try {
      setIsSubmitting(true);
      const data = await ReceptionService.cancelAppointment(targetId);
      toast.success(data.message || "Appointment cancelled");
      if (!cancelSlot || cancelSlot.bookings.length <= 1) {
        setCancelSlot(null);
      }
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

  // A patient-requested (Pending) booking must be confirmed before it can be
  // checked in — otherwise reception could check a patient in who was never
  // actually approved, leaving their request stuck in the requests panel.
  const handleConfirmPendingRequest = async (appointmentId?: string) => {
    const targetId = appointmentId ?? cancelSlot?.appointmentId;
    if (!targetId || !selectedDoctor) return;

    try {
      setIsSubmitting(true);
      const data = await ReceptionService.updateAppointmentStatus(targetId, "Scheduled");
      toast.success(data.message || "Appointment confirmed");
      setAppointmentRequests((prev) => prev.filter((r) => r.appointmentId !== targetId));
      fetchSlots(selectedDoctor.doctorId, selectedDate);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Failed to confirm appointment");
      } else {
        toast.error("Failed to confirm appointment");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
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

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="relative block w-full sm:w-72">
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
              className="h-11 w-full text-base sm:w-52"
            >
              <option value="all">All specializations</option>
              {specializationOptions.map((spec) => (
                <option key={spec.id} value={spec.id}>
                  {spec.name}
                </option>
              ))}
            </select>
            <div className="flex items-end gap-2">
              <div className="w-full sm:w-36">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                  From
                </label>
                <DatePicker
                  value={fromDate}
                  onChange={(value) => {
                    setFromDate(value);
                    if (value > toDate) setToDate(value);
                  }}
                  dateFormat="dd-MM-yyyy"
                  placeholder="DD-MM-YYYY"
                />
              </div>
              <div className="w-full sm:w-36">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                  To
                </label>
                <DatePicker
                  value={toDate}
                  min={fromDate}
                  onChange={(value) => setToDate(value)}
                  dateFormat="dd-MM-yyyy"
                  placeholder="DD-MM-YYYY"
                />
              </div>
              {(fromDate !== todayValue || toDate !== todayValue) && (
                <button
                  onClick={() => {
                    setFromDate(todayValue);
                    setToDate(todayValue);
                  }}
                  title="Reset to today"
                  aria-label="Reset to today"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-input text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <RotateCcw size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <CalendarPlus className="text-primary" size={20} /> Pending follow-ups
              {filteredPendingFollowUps.length > 0 && (
                <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                  {filteredPendingFollowUps.length}
                </span>
              )}
            </h2>
            <button
              onClick={fetchPendingFollowUps}
              title="Refresh"
              aria-label="Refresh"
              className="flex h-8 w-8 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 cursor-pointer"
            >
              <RefreshCw size={16} />
            </button>
          </div>
          {isLoadingFollowUps ? (
            <LoadingSpinner />
          ) : filteredPendingFollowUps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {pendingFollowUps.length === 0
                ? "No follow-ups awaiting confirmation."
                : "No follow-ups in the selected date range."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase text-muted-foreground border-b border-border">
                    <th className="pb-2 pr-4">Patient</th>
                    <th className="pb-2 pr-4">Doctor</th>
                    <th className="pb-2 pr-4">Suggested date</th>
                    <th className="pb-2 pr-4">Instructions</th>
                    <th className="pb-2 pr-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPendingFollowUps.map((followUp) => (
                    <tr key={followUp.followUpId} className="border-b border-border last:border-0">
                      <td className="py-2 pr-4 font-medium text-foreground">
                        {followUp.patientName ?? "Unknown"}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {followUp.doctorName ? `Dr. ${followUp.doctorName}` : "—"}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {format(new Date(followUp.followUpDate), "d MMM yyyy")}
                      </td>
                      <td className="py-2 pr-4 max-w-[200px] truncate text-muted-foreground">
                        {followUp.instructions || "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openConfirmFollowUp(followUp)}
                            disabled={dismissingFollowUpId === followUp.followUpId}
                            className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                          >
                            <Check size={13} /> Confirm
                          </button>
                          <button
                            onClick={() => handleDismissFollowUp(followUp)}
                            disabled={dismissingFollowUpId === followUp.followUpId}
                            className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                          >
                            <X size={13} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Bell className="text-primary" size={20} /> Pending appointment requests
              {filteredAppointmentRequests.length > 0 && (
                <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                  {filteredAppointmentRequests.length}
                </span>
              )}
            </h2>
            <button
              onClick={fetchAppointmentRequests}
              title="Refresh"
              aria-label="Refresh"
              className="flex h-8 w-8 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 cursor-pointer"
            >
              <RefreshCw size={16} />
            </button>
          </div>
          {isLoadingRequests ? (
            <LoadingSpinner />
          ) : filteredAppointmentRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {appointmentRequests.length === 0
                ? "No pending requests from the mobile app."
                : "No requests in the selected date range."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase text-muted-foreground border-b border-border">
                    <th className="pb-2 pr-4">Patient</th>
                    <th className="pb-2 pr-4">Doctor</th>
                    <th className="pb-2 pr-4">Requested time</th>
                    <th className="pb-2 pr-4">Notes</th>
                    <th className="pb-2 pr-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppointmentRequests.map((request) => (
                    <tr key={request.appointmentId} className="border-b border-border last:border-0">
                      <td className="py-2 pr-4 font-medium text-foreground">
                        {request.patientName ?? "Unknown"}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {request.doctorName ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {format(new Date(request.appointmentDate), "d MMM, h:mm a")}
                      </td>
                      <td className="py-2 pr-4 max-w-[200px] truncate text-muted-foreground">
                        {request.notes || "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRespondToRequest(request, "Scheduled")}
                            disabled={processingRequestId === request.appointmentId}
                            className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                          >
                            <Check size={13} /> Confirm
                          </button>
                          <button
                            onClick={() => handleRespondToRequest(request, "Cancelled")}
                            disabled={processingRequestId === request.appointmentId}
                            className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                          >
                            <X size={13} /> Decline
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        </div>

        <section className="card p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <ListChecks className="text-primary" size={20} /> Visit queue
            </h2>
            <button
              onClick={fetchVisitQueue}
              title="Refresh"
              aria-label="Refresh"
              className="flex h-8 w-8 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 cursor-pointer"
            >
              <RefreshCw size={16} />
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
                          <button
                            type="button"
                            onClick={() => openEditQueueVisit(visit)}
                            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
                          >
                            <Pencil size={12} /> Edit
                          </button>
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
                      {selectedDoctor.specializationName} • {getCurrencySymbol()}{" "}
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
                  <span className="rounded-lg border border-amber-600 bg-amber-600 px-3 py-1 text-xs font-semibold text-white">
                    Needs confirmation
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
                  {daySlots!.slots.map((slot) => {
                  const hasPendingBooking =
                    slot.status === "Pending" ||
                    slot.bookings.some((b) => b.status === "Pending");
                  return (
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
                              : hasPendingBooking
                              ? "border-amber-600/30 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30"
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
                              : hasPendingBooking
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-blue-700 dark:text-blue-400"
                          }`}
                        >
                          <Clock size={14} />
                          {format(new Date(slot.start), "h:mm a")}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {slot.maxCapacity > 1 && (
                            <span
                              title="Multiple patients can share this slot"
                              className="flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground"
                            >
                              <Users size={11} /> {slot.bookedCount}/{slot.maxCapacity}
                            </span>
                          )}
                          {!slot.isPast && hasPendingBooking && (
                            <span
                              title="Awaiting confirmation"
                              className="flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                            >
                              Pending
                            </span>
                          )}
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
                            : hasPendingBooking
                            ? "bg-amber-600 text-white"
                            : "bg-blue-600 text-white"
                        }`}
                      >
                        {slot.isPast
                          ? "Past"
                          : slot.maxCapacity > 1
                          ? slot.isAvailable
                            ? slot.bookedCount > 0
                              ? `${slot.bookedCount}/${slot.maxCapacity} booked — open`
                              : "Available"
                            : hasPendingBooking
                            ? `Needs confirmation (${slot.bookedCount}/${slot.maxCapacity})`
                            : `Full (${slot.bookedCount}/${slot.maxCapacity})`
                          : slot.isAvailable
                          ? "Available"
                          : slot.status === "Pending"
                          ? `${slot.patientName || "Patient"} - Pending confirmation`
                          : slot.isWalkIn
                          ? `${slot.patientName || "Patient"} - Walk-in Visit`
                          : slot.patientName || "Booked"}
                      </span>
                    </button>
                  );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {!selectedDoctor && hasActiveDoctorFilter && (
          <>
            {isLoadingGrid ? (
              <LoadingSpinner />
            ) : filteredSpecializations.length > 0 ? (
              // One flat grid for every doctor, not a grid-per-specialty - with only a handful
              // of specialties having more than one doctor, a per-specialty grid would mostly
              // just be a very wide single-column list. Each specialty's heading spans every
              // column (col-span-full) so it still reads as a group break, while the doctor
              // cards packed under it flow into whatever columns are free instead of each
              // specialty forcing its own full-width row.
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {filteredSpecializations.map((spec, specIndex) => (
                  <Fragment key={spec.specializationId}>
                    <div
                      className={`col-span-full flex items-center gap-3 ${specIndex === 0 ? "" : "mt-4"}`}
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Stethoscope size={18} />
                      </span>
                      <h2 className="text-xl font-semibold text-foreground">
                        {spec.specializationName}
                      </h2>
                      <span
                        title={isSpecialtyAvailable(spec) ? "Available" : "Not available"}
                        aria-label={isSpecialtyAvailable(spec) ? "Available" : "Not available"}
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          isSpecialtyAvailable(spec) ? "bg-emerald-500" : "bg-gray-400"
                        }`}
                      />
                      <span className="rounded-lg border border-border bg-muted/40 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                        {spec.doctors.length} doctor
                        {spec.doctors.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    {spec.doctors.map((doctor) => (
                        <article key={doctor.doctorId} className="card p-5">
                          <div className="flex items-start gap-4">
                            <div className="relative shrink-0">
                              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary text-xl font-semibold text-primary-foreground shadow-sm">
                                {getInitials(doctor.name)}
                              </div>
                              <span
                                title={STATUS_LABEL[getDoctorStatus(doctor)]}
                                aria-label={STATUS_LABEL[getDoctorStatus(doctor)]}
                                className={`absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-card ${
                                  STATUS_DOT_CLASS[getDoctorStatus(doctor)]
                                }`}
                              />
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
                                  {getCurrencySymbol()} {doctor.consultationFee}
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
                  </Fragment>
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
                  placeholder="Search by name, phone, MRN, national ID, or passport..."
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
                          {patient.opNumber || patient.opId} • {patient.phone}
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
                      {selectedPatient.opNumber || selectedPatient.opId} • {selectedPatient.phone}
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

              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-semibold text-foreground/90">
                  Follow-up visit
                </label>
                <input
                  type="checkbox"
                  checked={isFollowUp}
                  onChange={(event) => setIsFollowUp(event.target.checked)}
                  className="h-5 w-5"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground/90 mb-2">
                  Urgency
                </label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={urgencyLevel === "Routine"}
                      onChange={() => setUrgencyLevel("Routine")}
                    />
                    Routine
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={urgencyLevel === "Urgent"}
                      onChange={() => setUrgencyLevel("Urgent")}
                    />
                    Urgent
                  </label>
                </div>
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
              {cancelSlot.bookings.length > 1 && (
                <span className="ml-2 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground align-middle">
                  {cancelSlot.bookings.length} patients sharing this slot
                </span>
              )}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {format(new Date(cancelSlot.start), "d MMM yyyy, h:mm a")} -{" "}
              {format(new Date(cancelSlot.end), "h:mm a")}
            </p>

            {cancelSlot.bookings.length > 1 ? (
              <div className="mt-4 flex flex-col gap-3">
                {cancelSlot.bookings.map((booking) => {
                  const isPending = booking.status === "Pending";
                  return (
                    <div
                      key={booking.appointmentId}
                      className="rounded-lg border border-border bg-muted/40 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {booking.patientName ?? "Patient"}
                        </p>
                        {isPending ? (
                          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                            Pending confirmation
                          </span>
                        ) : booking.isWalkIn ? (
                          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                            Walk-in
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        {isPending ? (
                          <button
                            onClick={() => handleConfirmPendingRequest(booking.appointmentId ?? undefined)}
                            disabled={isSubmitting}
                            className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                          >
                            <Check size={13} /> Confirm
                          </button>
                        ) : (
                          <button
                            onClick={() => handleCheckIn(booking.appointmentId ?? undefined)}
                            disabled={isSubmitting}
                            className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                          >
                            <LogIn size={13} /> Check in
                          </button>
                        )}
                        <button
                          onClick={() => handleConfirmCancel(booking.appointmentId ?? undefined)}
                          disabled={isSubmitting}
                          className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                        >
                          <XCircle size={13} /> {isPending ? "Decline" : "Cancel"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Patient
                  </p>
                  {cancelSlot.status === "Pending" ? (
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                      Pending confirmation
                    </span>
                  ) : cancelSlot.isWalkIn ? (
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      Walk-in Visit
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {cancelSlot.patientName ?? "Patient"}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3 mt-6">
              {cancelSlot.bookings.length <= 1 && (
                <>
                  {cancelSlot.status === "Pending" ? (
                    <button
                      onClick={() => handleConfirmPendingRequest()}
                      disabled={isSubmitting}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:opacity-90 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      <Check size={16} /> Confirm appointment
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCheckIn()}
                      disabled={isSubmitting}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:opacity-90 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      <LogIn size={16} /> Check in patient
                    </button>
                  )}
                  <button
                    onClick={() => handleConfirmCancel()}
                    disabled={isSubmitting}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    <XCircle size={16} />{" "}
                    {cancelSlot.status === "Pending" ? "Decline request" : "Cancel appointment"}
                  </button>
                </>
              )}
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

      {confirmingFollowUp && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto border border-border">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">Confirm follow-up</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {confirmingFollowUp.patientName ?? "Unknown"} •{" "}
                  {confirmingFollowUp.doctorName ? `Dr. ${confirmingFollowUp.doctorName}` : "—"}
                </p>
              </div>
              <button
                onClick={closeConfirmFollowUp}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-foreground/90 mb-2">Date</label>
                <DatePicker
                  value={toDateInputValue(followUpConfirmDate)}
                  onChange={(v) => v && setFollowUpConfirmDate(new Date(`${v}T00:00:00`))}
                  dateFormat="dd-MM-yyyy"
                  placeholder="DD-MM-YYYY"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground/90 mb-2">Available slots</label>
                {isLoadingFollowUpSlots ? (
                  <LoadingSpinner />
                ) : (followUpDaySlots?.slots.filter((s) => s.isAvailable).length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No open slots for this doctor on this day.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto">
                    {followUpDaySlots!.slots
                      .filter((s) => s.isAvailable)
                      .map((slot) => (
                        <button
                          key={slot.start}
                          type="button"
                          onClick={() => setFollowUpSelectedSlot(slot)}
                          className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                            followUpSelectedSlot?.start === slot.start
                              ? "border-primary bg-primary text-white"
                              : "border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400"
                          }`}
                        >
                          <Clock size={13} className="inline mr-1" />
                          {format(new Date(slot.start), "h:mm a")}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeConfirmFollowUp}
                className="flex-1 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmFollowUp}
                disabled={isConfirmingFollowUp || !followUpSelectedSlot}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {isConfirmingFollowUp ? "Booking..." : "Confirm & book"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingQueueVisit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto border border-border">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">Edit visit</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {editingQueueVisit.patientName ?? "Unknown"}
                </p>
              </div>
              <button
                onClick={closeEditQueueVisit}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-foreground/90 mb-2">Doctor</label>
                <input
                  type="text"
                  value={editVisitDoctorSearch}
                  onChange={(event) => {
                    setEditVisitDoctorSearch(event.target.value);
                    setEditVisitSelectedDoctor(null);
                  }}
                  placeholder="Search by doctor name or specialization..."
                  className="w-full px-4 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:border-blue-500 text-foreground"
                />

                {editVisitSelectedDoctor ? (
                  <div className="mt-2 flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{editVisitSelectedDoctor.name}</p>
                      <p className="text-xs text-muted-foreground">{editVisitSelectedDoctor.specializationName}</p>
                    </div>
                    <button
                      onClick={() => setEditVisitSelectedDoctor(null)}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                    {editVisitDoctorResults.length > 0 ? (
                      editVisitDoctorResults.map((doctor) => (
                        <button
                          key={doctor.doctorId}
                          onClick={() => setEditVisitSelectedDoctor(doctor)}
                          className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer flex items-center gap-2"
                        >
                          <Stethoscope size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                          <span>
                            <span className="font-medium text-foreground">{doctor.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{doctor.specializationName}</span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="px-4 py-3 text-sm text-muted-foreground">No doctors found.</p>
                    )}
                  </div>
                )}
              </div>

              {editVisitSelectedDoctor && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-foreground/90 mb-2">Date</label>
                    <DatePicker
                      value={toDateInputValue(editVisitDate)}
                      min={toDateInputValue(new Date())}
                      onChange={(v) => v && setEditVisitDate(new Date(`${v}T00:00:00`))}
                      dateFormat="dd-MM-yyyy"
                      placeholder="DD-MM-YYYY"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-foreground/90 mb-2">Available slots</label>
                    {isLoadingEditVisitSlots ? (
                      <LoadingSpinner />
                    ) : (editVisitDaySlots?.slots.filter((s) => s.isAvailable).length ?? 0) === 0 ? (
                      <p className="text-sm text-muted-foreground">No open slots for this doctor on this day.</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto">
                        {editVisitDaySlots!.slots
                          .filter((s) => s.isAvailable)
                          .map((slot) => (
                            <button
                              key={slot.start}
                              type="button"
                              onClick={() => setEditVisitSelectedSlot(slot)}
                              className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                                editVisitSelectedSlot?.start === slot.start
                                  ? "border-primary bg-primary text-white"
                                  : "border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400"
                              }`}
                            >
                              <Clock size={13} className="inline mr-1" />
                              {format(new Date(slot.start), "h:mm a")}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-foreground/90 mb-2">Notes</label>
                    <textarea
                      value={editVisitNotes}
                      onChange={(event) => setEditVisitNotes(event.target.value)}
                      rows={2}
                      placeholder="Reason for visit (optional)"
                      className="w-full px-4 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:border-blue-500 text-foreground resize-none"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeEditQueueVisit}
                className="flex-1 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditVisit}
                disabled={isSavingEditVisit || !editVisitSelectedDoctor || !editVisitSelectedSlot}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {isSavingEditVisit ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
