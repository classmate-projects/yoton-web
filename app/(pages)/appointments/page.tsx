"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
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
  Eye,
  GraduationCap,
  HelpCircle,
  ListChecks,
  Paperclip,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  Stethoscope,
  Trash2,
  Upload,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import DatePicker from "@/components/DatePicker";
import SearchableSelect from "@/components/SearchableSelect";
import { backendAssetUrl } from "@/lib/backendAsset";
import PatientRegistrationModal from "@/components/PatientRegistrationModal";
import { ReceptionService } from "@/services/reception.service";
import { AuthService } from "@/services/auth.service";
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
import { notifySaveStatus } from "@/lib/saveStatus";

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const VISIT_STATUS_META: Record<string, { label: string; className: string }> = {
  CheckedIn:      { label: "Waiting",        className: "bg-amber-500/15 text-amber-400" },
  WithNurse:      { label: "With Nurse",     className: "bg-sky-500/15 text-sky-400" },
  WithDoctor:     { label: "With Doctor",    className: "bg-emerald-500/15 text-emerald-400" },
  Investigations: { label: "Investigations", className: "bg-orange-500/15 text-orange-400" },
  Pharmacy:       { label: "Pharmacy",       className: "bg-violet-500/15 text-violet-400" },
  Billing:        { label: "Billing",        className: "bg-rose-500/15 text-rose-400" },
  Completed:      { label: "Completed",      className: "bg-gray-500/15 text-gray-400" },
};

const visitStatusBadge = (status: string) => {
  const meta = VISIT_STATUS_META[status] ?? { label: status, className: "bg-primary/10 text-primary" };
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
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

  // ---------------- Department filter (defaults to user's assigned department) ----------------
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>("all");
  const [userDeptInfo, setUserDeptInfo] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    AuthService.getMe().then((data) => {
      const deptId: string | null = data?.departmentId ?? null;
      const deptName: string | null = data?.departmentName ?? null;
      if (deptId) {
        setSelectedDeptFilter(deptId);
        if (deptName) setUserDeptInfo({ id: deptId, name: deptName });
      }
    }).catch(() => {});
  }, []);

  // ---------------- Book Appointment modals ----------------
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookModalDeptFilter, setBookModalDeptFilter] = useState("all");
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] =
    useState<PatientListItemType | null>(null);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [notes, setNotes] = useState("");
  const [isFollowUp, setIsFollowUp] = useState(false);
  const [urgencyLevel, setUrgencyLevel] = useState("Routine");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingMode, setBookingMode] = useState<"existing" | "new">("existing");
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientPhone, setNewPatientPhone] = useState("");
  const [newPatientPhoneCode, setNewPatientPhoneCode] = useState("+91");
  const [newPatientSex, setNewPatientSex] = useState("");
  const [newPatientDob, setNewPatientDob] = useState("");
  const [newPatientEmail, setNewPatientEmail] = useState("");
  const [newPatientNationalId, setNewPatientNationalId] = useState("");

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
  const [editVisitDeptFilter, setEditVisitDeptFilter] = useState("all");
  const [editVisitSpecFilter, setEditVisitSpecFilter] = useState("all");

  // ---------------- Appointment Registration (walk-in desk: find today's appointment, register the visit) ----------------
  type ScheduledAppointmentItem = {
    appointmentId: string;
    appointmentDate: string;
    status: string;
    patientId: string | null;
    patientName: string | null;
    patientPhone: string | null;
    patientNationalId: string | null;
    patientOpNumber: string | null;
    doctorId: string | null;
    departmentId: string | null;
    doctorName: string | null;
    specializationName: string | null;
    notes: string | null;
    isWalkIn: boolean;
    isFollowUp: boolean;
    urgencyLevel: string | null;
    alreadyRegistered: boolean;
    visitId: string | null;
    visitStatus: string | null;
    hasEncounter: boolean;
  };
  const [scheduledAppointments, setScheduledAppointments] = useState<ScheduledAppointmentItem[]>([]);
  const [isLoadingScheduled, setIsLoadingScheduled] = useState(false);
  const [registrationDate, setRegistrationDate] = useState(todayValue);
  const [registrationSearch, setRegistrationSearch] = useState("");
  const [registeringId, setRegisteringId] = useState<string | null>(null);

  // ---------------- Today's Appointment Queue (column 1, non-walk-in only) ----------------
  const [todayAppointmentQueue, setTodayAppointmentQueue] = useState<ScheduledAppointmentItem[]>([]);
  const [isLoadingTodayQueue, setIsLoadingTodayQueue] = useState(false);
  const [appointmentQueueSearch, setAppointmentQueueSearch] = useState("");

  // ---------------- Edit Appointment (pre-registration, reuses edit-visit modal state) ----------------
  const [editingQueueAppointment, setEditingQueueAppointment] = useState<ScheduledAppointmentItem | null>(null);
  const [isSavingEditAppointment, setIsSavingEditAppointment] = useState(false);
  const [editUrgencyLevel, setEditUrgencyLevel] = useState("Routine");
  const [editIsFollowUp, setEditIsFollowUp] = useState(false);

  // ---------------- Revert registration ----------------
  const [revertingVisitId, setRevertingVisitId] = useState<string | null>(null);

  // ---------------- Attachments modal ----------------
  type PatientDocItem = {
    patientDocumentId: string;
    documentType: string;
    filePath: string | null;
    createdAt: string;
    visitId: string | null;
  };
  const DOC_TYPE_LABELS: Record<string, string> = {
    ExternalLabReport: "External Lab Report",
    ExternalRadiologyReport: "External Radiology Report",
    InsuranceEligibility: "Insurance Eligibility",
    Other: "Other",
  };
  const PREVIEWABLE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "pdf"];
  const [attachmentPatient, setAttachmentPatient] = useState<{ id: string; name: string } | null>(null);
  const [patientDocs, setPatientDocs] = useState<PatientDocItem[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [docUploadType, setDocUploadType] = useState("Other");
  const [docUploadFile, setDocUploadFile] = useState<File | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  const openAttachments = async (patientId: string, patientName: string) => {
    setAttachmentPatient({ id: patientId, name: patientName });
    setPatientDocs([]);
    setDocUploadFile(null);
    setDocUploadType("Other");
    setIsLoadingDocs(true);
    try {
      const res = await ReceptionService.getPatientDocuments(patientId);
      setPatientDocs(res.data ?? []);
    } catch {
      toast.error("Failed to load attachments");
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const refreshDocs = async (patientId: string) => {
    try {
      const res = await ReceptionService.getPatientDocuments(patientId);
      setPatientDocs(res.data ?? []);
    } catch {
      // leave stale list rather than wiping it on a refresh failure
    }
  };

  const handleUploadDoc = async () => {
    if (!attachmentPatient || !docUploadFile) return;
    setIsUploadingDoc(true);
    try {
      await ReceptionService.uploadDocument(attachmentPatient.id, { documentType: docUploadType, file: docUploadFile });
      // Re-fetch via GET so every document in state has the same camelCase shape
      // as the list endpoint — the upload returns the raw EF entity which may not
      // match (PascalCase PatientDocumentId vs camelCase patientDocumentId).
      await refreshDocs(attachmentPatient.id);
      setDocUploadFile(null);
      toast.success("Document uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleDeleteDoc = async (doc: PatientDocItem) => {
    if (!attachmentPatient) return;
    setDeletingDocId(doc.patientDocumentId);
    try {
      await ReceptionService.deletePatientDocument(attachmentPatient.id, doc.patientDocumentId);
      setPatientDocs((prev) => prev.filter((d) => d.patientDocumentId !== doc.patientDocumentId));
      toast.success("Document deleted");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to delete document");
    } finally {
      setDeletingDocId(null);
    }
  };

  // ---------------- Overlap booking (add a 2nd / 3rd patient to an already-booked slot) ----------------
  const [overlapSlot, setOverlapSlot] = useState<DoctorDaySlotsType["slots"][number] | null>(null);
  const [overlapDoctorId, setOverlapDoctorId] = useState<string | null>(null);
  const [overlapPatientSearch, setOverlapPatientSearch] = useState("");
  const [overlapSelectedPatient, setOverlapSelectedPatient] = useState<PatientListItemType | null>(null);
  const [overlapNotes, setOverlapNotes] = useState("");
  const [isSubmittingOverlap, setIsSubmittingOverlap] = useState(false);

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

  // ---------------- Fetch scheduled appointments for registration ----------------
  const fetchScheduledAppointments = async (date?: string) => {
    try {
      setIsLoadingScheduled(true);
      const res = await ReceptionService.getScheduledAppointments(date);
      setScheduledAppointments(res.items ?? []);
    } catch {
      setScheduledAppointments([]);
    } finally {
      setIsLoadingScheduled(false);
    }
  };

  useEffect(() => { fetchScheduledAppointments(registrationDate); }, [registrationDate]);
  useSignalRRefetch(["visitCheckedIn", "appointmentCreated", "appointmentStatusUpdated", "visitStatusUpdated", "encounterSaved", "encounterFinished"], () => fetchScheduledAppointments(registrationDate));

  const fetchTodayAppointmentQueue = async () => {
    try {
      setIsLoadingTodayQueue(true);
      const res = await ReceptionService.getScheduledAppointments(todayValue);
      const appts = (res.items ?? []).filter((a: ScheduledAppointmentItem) => !a.isWalkIn && !a.alreadyRegistered);
      appts.sort((a: ScheduledAppointmentItem, b: ScheduledAppointmentItem) =>
        new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime()
      );
      setTodayAppointmentQueue(appts);
    } catch {
      setTodayAppointmentQueue([]);
    } finally {
      setIsLoadingTodayQueue(false);
    }
  };

  useEffect(() => { fetchTodayAppointmentQueue(); }, []);
  useSignalRRefetch(["visitCheckedIn", "appointmentCreated", "appointmentStatusUpdated", "visitStatusUpdated"], fetchTodayAppointmentQueue);

  const handleRegister = async (appointmentId: string) => {
    try {
      setRegisteringId(appointmentId);
      notifySaveStatus("saving");
      const data = await ReceptionService.checkIn({ appointmentId });
      toast.success(data.message || "Patient registered for consultation");
      notifySaveStatus("saved");
      setScheduledAppointments((prev) =>
        prev.map((a) =>
          a.appointmentId === appointmentId
            ? { ...a, alreadyRegistered: true, visitId: data.data?.visitId ?? a.visitId, visitStatus: data.data?.status ?? "CheckedIn" }
            : a
        )
      );
      setTodayAppointmentQueue((prev) =>
        prev.map((a) =>
          a.appointmentId === appointmentId
            ? { ...a, alreadyRegistered: true, visitId: data.data?.visitId ?? a.visitId, visitStatus: data.data?.status ?? "CheckedIn" }
            : a
        )
      );
      fetchVisitQueue();
    } catch (error) {
      notifySaveStatus("error");
      toast.error(axios.isAxiosError(error) ? error.response?.data?.message || "Registration failed" : "Registration failed");
    } finally {
      setRegisteringId(null);
    }
  };

  const openEditQueueVisit = (visit: VisitType) => {
    setEditingQueueVisit(visit);
    setEditVisitDoctorSearch("");
    setEditVisitSelectedDoctor(null);
    setEditVisitDate(visit.appointmentDate ? new Date(visit.appointmentDate) : new Date());
    setEditVisitDaySlots(null);
    setEditVisitSelectedSlot(null);
    setEditVisitNotes(visit.notes ?? "");
    setEditVisitDeptFilter("all");
    setEditVisitSpecFilter("all");
  };

  const closeEditQueueVisit = () => {
    setEditingQueueVisit(null);
    setEditVisitSelectedDoctor(null);
    setEditVisitDaySlots(null);
    setEditVisitSelectedSlot(null);
    setEditVisitDeptFilter("all");
    setEditVisitSpecFilter("all");
  };

  // Flattened once from the same `specializations` catalog the main booking grid above
  // already loads - department/specialty dropdowns narrow the list before the text search.
  const editVisitDoctorOptions = useMemo(
    () =>
      specializations.flatMap((s) =>
        s.doctors.map((d) => ({
          ...d,
          specializationName: s.specializationName,
          specializationId: s.specializationId,
          departmentId: s.departmentId,
          departmentName: s.departmentName,
        }))
      ),
    [specializations]
  );

  // Unique departments and specializations for the filter dropdowns.
  const editVisitDeptOptions = useMemo(() => {
    const seen = new Map<string, string>();
    specializations.forEach((s) => {
      if (s.departmentId && s.departmentName) seen.set(s.departmentId, s.departmentName);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [specializations]);

  const editVisitSpecOptions = useMemo(() => {
    return specializations
      .filter((s) => editVisitDeptFilter === "all" || s.departmentId === editVisitDeptFilter)
      .map((s) => ({ id: s.specializationId, name: s.specializationName }));
  }, [specializations, editVisitDeptFilter]);

  const editVisitDoctorResults = useMemo(() => {
    const term = editVisitDoctorSearch.trim().toLowerCase();
    return editVisitDoctorOptions.filter((d) => {
      if (editVisitDeptFilter !== "all" && d.departmentId !== editVisitDeptFilter) return false;
      if (editVisitSpecFilter !== "all" && d.specializationId !== editVisitSpecFilter) return false;
      if (term.length === 0) return true;
      return d.name.toLowerCase().includes(term) || d.specializationName.toLowerCase().includes(term);
    });
  }, [editVisitDoctorOptions, editVisitDoctorSearch, editVisitDeptFilter, editVisitSpecFilter]);

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
    notifySaveStatus("saving");
    try {
      setIsSavingEditVisit(true);
      const data = await ReceptionService.reassignVisit(editingQueueVisit.visitId, {
        doctorId: editVisitSelectedDoctor.doctorId,
        appointmentDate: editVisitSelectedSlot.start,
        notes: editVisitNotes || undefined,
      });
      if (data.status === false) {
        notifySaveStatus("error");
        toast.error(data.message || "This slot has just been booked. Please choose another slot.");
        fetchEditVisitSlots(editVisitSelectedDoctor.doctorId, editVisitDate);
        return;
      }
      toast.success(data.message || "Visit updated");
      notifySaveStatus("saved");
      closeEditQueueVisit();
      fetchVisitQueue();
    } catch (error) {
      notifySaveStatus("error");
      toast.error(
        axios.isAxiosError(error) ? error.response?.data?.message || "Failed to update visit" : "Failed to update visit"
      );
    } finally {
      setIsSavingEditVisit(false);
    }
  };

  // ---------------- Edit Appointment handlers ----------------
  const openEditAppointment = (apt: ScheduledAppointmentItem) => {
    setEditingQueueAppointment(apt);
    setEditVisitDoctorSearch("");
    setEditVisitSelectedDoctor(null);
    setEditVisitDate(new Date(apt.appointmentDate));
    setEditVisitDaySlots(null);
    setEditVisitSelectedSlot(null);
    setEditVisitNotes(apt.notes ?? "");
    setEditVisitDeptFilter("all");
    setEditVisitSpecFilter("all");
    setEditUrgencyLevel(apt.urgencyLevel ?? "Routine");
    setEditIsFollowUp(apt.isFollowUp ?? false);
  };

  const closeEditAppointment = () => {
    setEditingQueueAppointment(null);
    setEditVisitSelectedDoctor(null);
    setEditVisitDaySlots(null);
    setEditVisitSelectedSlot(null);
    setEditVisitDeptFilter("all");
    setEditVisitSpecFilter("all");
  };

  const handleSaveEditAppointment = async () => {
    if (!editingQueueAppointment || !editVisitSelectedDoctor || !editVisitSelectedSlot) {
      toast.warning("Please select a doctor and an available time slot");
      return;
    }
    notifySaveStatus("saving");
    try {
      setIsSavingEditAppointment(true);
      const data = await ReceptionService.updateAppointment(editingQueueAppointment.appointmentId, {
        doctorId: editVisitSelectedDoctor.doctorId,
        appointmentDate: editVisitSelectedSlot.start,
        notes: editVisitNotes || undefined,
        urgencyLevel: editUrgencyLevel,
        isFollowUp: editIsFollowUp,
      });
      if (data.status === false) {
        notifySaveStatus("error");
        toast.error(data.message || "This slot has just been booked. Please choose another slot.");
        fetchEditVisitSlots(editVisitSelectedDoctor.doctorId, editVisitDate);
        return;
      }
      toast.success(data.message || "Appointment updated");
      notifySaveStatus("saved");
      closeEditAppointment();
      fetchTodayAppointmentQueue();
      fetchScheduledAppointments(registrationDate);
    } catch (error) {
      notifySaveStatus("error");
      toast.error(axios.isAxiosError(error) ? error.response?.data?.message || "Failed to update appointment" : "Failed to update appointment");
    } finally {
      setIsSavingEditAppointment(false);
    }
  };

  // ---------------- Revert registration handler ----------------
  const handleRevertCheckIn = async (apt: ScheduledAppointmentItem) => {
    if (!apt.visitId) return;
    if ((apt.visitStatus && apt.visitStatus !== "CheckedIn") || apt.hasEncounter) {
      toast.error("Doctor has already started the encounter for this patient. Kindly contact the doctor.");
      return;
    }
    try {
      setRevertingVisitId(apt.visitId);
      notifySaveStatus("saving");
      const data = await ReceptionService.revertCheckIn(apt.visitId);
      toast.success(data.message || "Registration reverted");
      notifySaveStatus("saved");
      fetchTodayAppointmentQueue();
      fetchScheduledAppointments(registrationDate);
      fetchVisitQueue();
    } catch (error) {
      notifySaveStatus("error");
      toast.error(axios.isAxiosError(error) ? error.response?.data?.message || "Failed to revert registration" : "Failed to revert registration");
    } finally {
      setRevertingVisitId(null);
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
    notifySaveStatus("saving");
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
      notifySaveStatus("saved");
      setAppointmentRequests((prev) =>
        prev.filter((r) => r.appointmentId !== request.appointmentId)
      );
      if (selectedDoctor && selectedDoctor.doctorId === request.doctorId) {
        fetchSlots(selectedDoctor.doctorId, selectedDate);
      }
    } catch (error) {
      notifySaveStatus("error");
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
    notifySaveStatus("saving");
    try {
      setIsConfirmingFollowUp(true);
      const data = await ReceptionService.confirmFollowUp(confirmingFollowUp.followUpId, followUpSelectedSlot.start);
      if (data.status === false) {
        notifySaveStatus("error");
        toast.error(data.message || "This slot has just been booked. Please choose another slot.");
        fetchFollowUpSlots(confirmingFollowUp.doctorId!, followUpConfirmDate);
        return;
      }
      toast.success(data.message || "Follow-up confirmed and appointment booked");
      notifySaveStatus("saved");
      setPendingFollowUps((prev) => prev.filter((f) => f.followUpId !== confirmingFollowUp.followUpId));
      closeConfirmFollowUp();
    } catch (error) {
      notifySaveStatus("error");
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

  const bookModalDepts = useMemo(() => {
    const seen = new Map<string, string>();
    specializations.forEach((s) => {
      if (s.departmentId && s.departmentName) seen.set(s.departmentId, s.departmentName);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [specializations]);

  // If the user's dept from getMe() isn't a known dept (no doctors/specializations assigned to it),
  // the select would visually show "All departments" while the state still holds the dept ID,
  // silently filtering out all appointments. Fall back to "all" in that case.
  useEffect(() => {
    if (selectedDeptFilter === "all" || bookModalDepts.length === 0) return;
    const exists = bookModalDepts.some((d) => d.id === selectedDeptFilter);
    if (!exists) setSelectedDeptFilter("all");
  }, [bookModalDepts, selectedDeptFilter]);

  const bookModalSpecOptions = useMemo(() => {
    return specializations
      .filter((s) => bookModalDeptFilter === "all" || s.departmentId === bookModalDeptFilter)
      .map((s) => ({ id: s.specializationId, name: s.specializationName }));
  }, [specializations, bookModalDeptFilter]);

  const filteredSpecializations = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return specializations
      .filter((s) => {
        if (bookModalDeptFilter !== "all" && s.departmentId !== bookModalDeptFilter) return false;
        return selectedSpecializationId === "all" || s.specializationId === selectedSpecializationId;
      })
      .map((s) => {
        const matchesSpec = s.specializationName.toLowerCase().includes(normalizedSearch);
        const doctors = matchesSpec
          ? s.doctors
          : s.doctors.filter((d) => d.name.toLowerCase().includes(normalizedSearch));
        return { ...s, doctors };
      })
      .filter((s) => normalizedSearch.length === 0 || s.doctors.length > 0);
  }, [specializations, searchTerm, selectedSpecializationId, bookModalDeptFilter]);

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
    if (!bookingSlot || !selectedDoctor) return;

    if (!selectedPatient) {
      toast.warning("Please select a patient first");
      return;
    }

    notifySaveStatus("saving");
    try {
      setIsSubmitting(true);
      const userId =
        JSON.parse(localStorage.getItem("yoton_user_detail") || "{}")
          .userId ?? undefined;

      const patientId = selectedPatient?.opId ?? "";

      const data = await ReceptionService.createAppointment({
        patientId,
        doctorId: selectedDoctor.doctorId,
        appointmentDate: bookingSlot.start,
        notes,
        userId,
        isFollowUp,
        urgencyLevel,
      });

      if (data.status === false) {
        notifySaveStatus("error");
        toast.error(data.message || "Could not book this slot");
      } else {
        toast.success(data.message || "Appointment booked");
        notifySaveStatus("saved");
        setBookingSlot(null);
        setShowBookModal(false);
        setSelectedDoctor(null);
        setPatientSearch("");
        setSelectedPatient(null);
        setNotes("");
        setIsFollowUp(false);
        setUrgencyLevel("Routine");
        setBookingMode("existing");
      }
      fetchSlots(selectedDoctor.doctorId, selectedDate);
    } catch (error) {
      notifySaveStatus("error");
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Failed to book appointment");
      } else {
        toast.error("Failed to book appointment");
      }
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleConfirmCancel = async (appointmentId?: string) => {
    const targetId = appointmentId ?? cancelSlot?.appointmentId;
    if (!targetId || !selectedDoctor) return;

    notifySaveStatus("saving");
    try {
      setIsSubmitting(true);
      const data = await ReceptionService.cancelAppointment(targetId);
      toast.success(data.message || "Appointment cancelled");
      notifySaveStatus("saved");
      setCancelSlot(null);
      fetchSlots(selectedDoctor.doctorId, selectedDate);
    } catch (error) {
      notifySaveStatus("error");
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Failed to cancel appointment");
      } else {
        toast.error("Failed to cancel appointment");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const openOverlapBooking = (slot: DoctorDaySlotsType["slots"][number], doctorId: string) => {
    setOverlapSlot(slot);
    setOverlapDoctorId(doctorId);
    setOverlapPatientSearch("");
    setOverlapSelectedPatient(null);
    setOverlapNotes("");
    setCancelSlot(null);
  };

  const handleOverlapBooking = async () => {
    if (!overlapSlot || !overlapDoctorId || !overlapSelectedPatient) {
      toast.warning("Please select a patient first");
      return;
    }
    notifySaveStatus("saving");
    try {
      setIsSubmittingOverlap(true);
      const userId = JSON.parse(localStorage.getItem("yoton_user_detail") || "{}").userId ?? undefined;
      const data = await ReceptionService.overlapAppointment({
        patientId: overlapSelectedPatient.opId,
        doctorId: overlapDoctorId,
        appointmentDate: overlapSlot.start,
        notes: overlapNotes || undefined,
        userId,
      });
      if (data.status === false) {
        notifySaveStatus("error");
        toast.error(data.message || "Could not add patient to this slot");
        return;
      }
      toast.success(data.message || "Patient added to slot");
      notifySaveStatus("saved");
      setOverlapSlot(null);
      setOverlapDoctorId(null);
      if (selectedDoctor) fetchSlots(selectedDoctor.doctorId, selectedDate);
    } catch (error) {
      notifySaveStatus("error");
      toast.error(axios.isAxiosError(error) ? error.response?.data?.message || "Failed to add patient" : "Failed to add patient");
    } finally {
      setIsSubmittingOverlap(false);
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
              Manage today&apos;s queue, book appointments, and register walk-ins.
            </p>
          </div>

          {(bookModalDepts.length > 0 || userDeptInfo) && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Department</label>
              <SearchableSelect
                value={selectedDeptFilter}
                onChange={setSelectedDeptFilter}
                options={[
                  { value: "all", label: "All departments" },
                  ...bookModalDepts.map((d) => ({ value: d.id, label: d.name })),
                  ...(userDeptInfo && !bookModalDepts.some((d) => d.id === userDeptInfo.id)
                    ? [{ value: userDeptInfo.id, label: userDeptInfo.name }]
                    : []),
                ]}
              />
            </div>
          )}
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
            <EmptyState
              illustration="visits"
              title={pendingFollowUps.length === 0 ? "No follow-ups awaiting confirmation" : "No follow-ups in this period"}
              description={
                pendingFollowUps.length === 0
                  ? "Follow-ups booked by doctors will appear here for confirmation."
                  : "Try widening the date range."
              }
            />
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
            <EmptyState
              illustration="messages"
              title={appointmentRequests.length === 0 ? "No pending requests" : "No requests in this period"}
              description={
                appointmentRequests.length === 0
                  ? "Appointment requests patients send from the mobile app will appear here."
                  : "Try widening the date range."
              }
            />
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

        {/* ---- Queue columns: Appointment Queue (col 1) + Doctor Registration Queue (col 2) ---- */}
        <div className="grid gap-6 lg:grid-cols-2">

        {/* ---- Appointment Queue (today's booked appointments, max 10) ---- */}
        <section className="card p-5">
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <CalendarCheck2 className="text-primary" size={20} /> Appointment Queue
                {todayAppointmentQueue.length > 0 && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">
                    {todayAppointmentQueue.length}
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowBookModal(true);
                    setSearchTerm("");
                    setSelectedSpecializationId("all");
                    setBookModalDeptFilter("all");
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 cursor-pointer"
                >
                  <CalendarPlus size={14} /> Check Appointment
                </button>
                <button
                  onClick={fetchTodayAppointmentQueue}
                  title="Refresh"
                  aria-label="Refresh"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 cursor-pointer"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>
            <label className="relative block">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={appointmentQueueSearch}
                onChange={(e) => setAppointmentQueueSearch(e.target.value)}
                placeholder="Search by name, OP no., mobile, national ID…"
                className="h-9 w-full pl-9 pr-3 text-sm"
              />
            </label>
          </div>
          {isLoadingTodayQueue ? (
            <LoadingSpinner />
          ) : todayAppointmentQueue.length === 0 ? (
            <EmptyState size="compact" illustration="visits" title="No pending appointments for today" />
          ) : (() => {
            const byDept = selectedDeptFilter === "all"
              ? todayAppointmentQueue
              : todayAppointmentQueue.filter((a) => a.departmentId === selectedDeptFilter);
            const term = appointmentQueueSearch.trim().toLowerCase();
            const filtered = term
              ? byDept.filter(
                  (a) =>
                    a.patientName?.toLowerCase().includes(term) ||
                    a.patientOpNumber?.toLowerCase().includes(term) ||
                    a.patientPhone?.toLowerCase().includes(term) ||
                    a.patientNationalId?.toLowerCase().includes(term)
                )
              : byDept;
            if (filtered.length === 0)
              return <EmptyState size="compact" illustration="search" title="No results match your search" />;
            return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase text-muted-foreground border-b border-border">
                    <th className="pb-2 pr-4">Time</th>
                    <th className="pb-2 pr-4">Patient</th>
                    <th className="pb-2 pr-4">Doctor</th>
                    <th className="pb-2 pr-4">Urgency</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((apt) => (
                    <tr key={apt.appointmentId} className="border-b border-border last:border-0">
                      <td className="py-2.5 pr-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">{format(new Date(apt.appointmentDate), "h:mm a")}</span>
                          {/* Appointment info tooltip */}
                          <div className="relative group/aptip">
                            <HelpCircle size={13} className="text-primary/60 cursor-help" />
                            <div className="pointer-events-none invisible group-hover/aptip:visible absolute left-0 top-full mt-1.5 z-50 w-52 rounded-lg bg-popover border border-border shadow-lg p-2.5 text-xs text-foreground">
                              <p className="font-semibold mb-1">Appointment details</p>
                              <p className="text-muted-foreground">Time: {format(new Date(apt.appointmentDate), "h:mm a")}</p>
                              {apt.doctorName && <p className="text-muted-foreground">Doctor: {apt.doctorName}</p>}
                              {apt.specializationName && <p className="text-muted-foreground">Specialty: {apt.specializationName}</p>}
                              {apt.urgencyLevel === "Urgent" && <p className="text-red-400 font-medium mt-1">⚠ Urgent</p>}
                              {apt.notes && <p className="text-muted-foreground mt-1 italic">"{apt.notes}"</p>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4">
                        <p className="font-semibold text-foreground">{apt.patientName ?? "Unknown"}</p>
                        {apt.patientOpNumber && (
                          <p className="text-xs text-muted-foreground">MRN: {apt.patientOpNumber}</p>
                        )}
                      </td>
                      <td className="py-2.5 pr-4">
                        {apt.doctorName ? (
                          <>
                            <p className="text-foreground font-medium">{apt.doctorName}</p>
                            {apt.specializationName && (
                              <p className="text-xs text-muted-foreground">{apt.specializationName}</p>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4">
                        {apt.urgencyLevel === "Urgent" ? (
                          <span className="rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-400">Urgent</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Routine</span>
                        )}
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => openEditAppointment(apt)}
                            title="Edit appointment"
                            className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted cursor-pointer"
                          >
                            <Pencil size={12} />
                            Edit
                          </button>
                          {apt.patientId && (
                            <button
                              onClick={() => openAttachments(apt.patientId!, apt.patientName ?? "Patient")}
                              title="Attachments"
                              className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted cursor-pointer"
                            >
                              <Paperclip size={12} />
                              Attach
                            </button>
                          )}
                          {apt.status === "Pending" ? (
                            <span className="text-xs text-muted-foreground">Confirm first</span>
                          ) : (
                            <button
                              onClick={() => handleRegister(apt.appointmentId)}
                              disabled={registeringId === apt.appointmentId}
                              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
                            >
                              <UserCheck size={13} />
                              {registeringId === apt.appointmentId ? "Registering…" : "Register"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            );
          })()}
        </section>

        {/* ---- Registered Patients ---- */}
        <section className="card p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <ListChecks className="text-primary" size={20} /> Registered Patients
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="relative block">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={registrationSearch}
                  onChange={(e) => setRegistrationSearch(e.target.value)}
                  placeholder="Search patient or doctor..."
                  className="h-9 pl-9 pr-3 text-sm w-56"
                />
              </label>
              <DatePicker
                value={registrationDate}
                onChange={(v) => { if (v) setRegistrationDate(v); }}
                dateFormat="dd-MM-yyyy"
                placeholder="DD-MM-YYYY"
              />
              <button
                onClick={() => fetchScheduledAppointments(registrationDate)}
                title="Refresh"
                aria-label="Refresh"
                className="flex h-9 w-9 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 cursor-pointer"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {isLoadingScheduled ? (
            <LoadingSpinner />
          ) : (() => {
            const term = registrationSearch.trim().toLowerCase();
            const byDept = selectedDeptFilter === "all"
              ? scheduledAppointments
              : scheduledAppointments.filter((a) => a.departmentId === selectedDeptFilter);
            // Right panel shows only registered patients
            const registered = byDept.filter((a) => a.alreadyRegistered);
            if (registered.length === 0)
              return <EmptyState size="compact" illustration="patients" title="No patients registered for this date yet" />;
            const filtered = term
              ? registered.filter(
                  (a) =>
                    a.patientName?.toLowerCase().includes(term) ||
                    a.doctorName?.toLowerCase().includes(term) ||
                    a.specializationName?.toLowerCase().includes(term) ||
                    a.patientOpNumber?.toLowerCase().includes(term)
                )
              : registered;
            if (filtered.length === 0)
              return <EmptyState size="compact" illustration="search" title="No results match your search" />;
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase text-muted-foreground border-b border-border">
                      <th className="pb-2 pr-4">Appt. Time</th>
                      <th className="pb-2 pr-4">Patient</th>
                      <th className="pb-2 pr-4">Doctor / Specialty</th>
                      <th className="pb-2 pr-4">Urgency</th>
                      <th className="pb-2 pr-4">Visit Status</th>
                      <th className="pb-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((apt) => (
                      <tr key={apt.appointmentId} className="border-b border-border last:border-0">
                        <td className="py-2.5 pr-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">{format(new Date(apt.appointmentDate), "h:mm a")}</span>
                            {/* Appointment detail tooltip */}
                            <div className="relative group/regtip">
                              <HelpCircle size={13} className="text-primary/60 cursor-help" />
                              <div className="pointer-events-none invisible group-hover/regtip:visible absolute left-0 top-full mt-1.5 z-50 w-52 rounded-lg bg-popover border border-border shadow-lg p-2.5 text-xs text-foreground">
                                <p className="font-semibold mb-1">Appointment details</p>
                                <p className="text-muted-foreground">Booked for: {format(new Date(apt.appointmentDate), "h:mm a")}</p>
                                {apt.doctorName && <p className="text-muted-foreground">Doctor: {apt.doctorName}</p>}
                                {apt.specializationName && <p className="text-muted-foreground">Specialty: {apt.specializationName}</p>}
                                {apt.urgencyLevel === "Urgent" && <p className="text-red-400 font-medium mt-1">⚠ Urgent</p>}
                                {apt.notes && <p className="text-muted-foreground mt-1 italic">"{apt.notes}"</p>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4">
                          <p className="font-semibold text-foreground">{apt.patientName ?? "Unknown"}</p>
                          {apt.patientOpNumber && (
                            <p className="text-xs text-muted-foreground">MRN: {apt.patientOpNumber}</p>
                          )}
                          {apt.patientPhone && (
                            <p className="text-xs text-muted-foreground">{apt.patientPhone}</p>
                          )}
                        </td>
                        <td className="py-2.5 pr-4">
                          {apt.doctorName ? (
                            <>
                              <p className="text-foreground font-medium">{apt.doctorName}</p>
                              {apt.specializationName && (
                                <p className="text-xs text-muted-foreground">{apt.specializationName}</p>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4">
                          {apt.urgencyLevel === "Urgent" ? (
                            <span className="rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-400">Urgent</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Routine</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4">
                          {apt.visitStatus
                            ? visitStatusBadge(apt.visitStatus)
                            : visitStatusBadge("CheckedIn")}
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {apt.patientId && (
                              <button
                                onClick={() => openAttachments(apt.patientId!, apt.patientName ?? "Patient")}
                                title="Attachments"
                                className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted cursor-pointer"
                              >
                                <Paperclip size={12} />
                                Attach
                              </button>
                            )}
                            {(() => {
                              const isLocked = (apt.visitStatus != null && apt.visitStatus !== "CheckedIn") || apt.hasEncounter;
                              return (
                                <button
                                  onClick={() => {
                                    if (isLocked) {
                                      toast.error("Doctor has already started the encounter at this time. Kindly contact the doctor.");
                                    } else {
                                      handleRevertCheckIn(apt);
                                    }
                                  }}
                                  disabled={revertingVisitId === apt.visitId}
                                  title={isLocked ? "Cannot revert — encounter in progress" : "Revert registration"}
                                  className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                                    isLocked
                                      ? "border-border bg-muted/30 text-muted-foreground opacity-50"
                                      : "border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20"
                                  } disabled:opacity-50`}
                                >
                                  <RotateCcw size={12} />
                                  {revertingVisitId === apt.visitId ? "Reverting…" : "Revert"}
                                </button>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </section>

        </div>{/* end queue columns grid */}


        {false && (
          <>
            {isLoadingGrid ? (
              <LoadingSpinner />
            ) : filteredSpecializations.length > 0 ? (
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

      {/* ---- Modal 1: Doctor Picker ---- */}
      {showBookModal && !selectedDoctor && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-border">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Check Appointment</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Choose a department, specialty, then a doctor</p>
              </div>
              <button
                onClick={() => setShowBookModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-3 p-5 pb-0 shrink-0 sm:flex-row">
              <div className="flex-1">
                <SearchableSelect
                  value={bookModalDeptFilter}
                  onChange={(v) => {
                    setBookModalDeptFilter(v);
                    setSelectedSpecializationId("all");
                  }}
                  options={[
                    { value: "all", label: "All departments" },
                    ...bookModalDepts.map((d) => ({ value: d.id, label: d.name })),
                  ]}
                />
              </div>
              <div className="flex-1">
                <SearchableSelect
                  value={selectedSpecializationId}
                  onChange={setSelectedSpecializationId}
                  options={[
                    { value: "all", label: "All specializations" },
                    ...bookModalSpecOptions.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                />
              </div>
              <label className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search doctor or specialty…"
                  className="h-10 w-full pl-9 pr-3 text-sm rounded-lg border border-border bg-muted text-foreground focus:outline-none focus:border-primary"
                />
              </label>
            </div>

            {/* Doctor grid */}
            <div className="overflow-y-auto p-5 pt-4">
              {isLoadingGrid ? (
                <LoadingSpinner />
              ) : filteredSpecializations.length === 0 || filteredSpecializations.every((s) => s.doctors.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <Stethoscope className="text-muted-foreground/40" size={38} />
                  <p className="mt-3 text-sm text-muted-foreground">No doctors match your filters.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredSpecializations.flatMap((spec) =>
                    spec.doctors.map((doctor) => (
                      <button
                        key={doctor.doctorId}
                        onClick={() => {
                          setShowBookModal(false);
                          setSelectedDoctor(doctor);
                          setSelectedDate(new Date());
                        }}
                        className="flex items-center gap-4 rounded-xl border border-border bg-muted/30 p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer"
                      >
                        <div className="relative shrink-0">
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-base font-semibold text-primary-foreground">
                            {getInitials(doctor.name)}
                          </div>
                          <span
                            title={STATUS_LABEL[getDoctorStatus(doctor)]}
                            className={`absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-card ${STATUS_DOT_CLASS[getDoctorStatus(doctor)]}`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-foreground">{doctor.name}</p>
                          <p className="text-xs text-primary font-medium">{spec.specializationName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {getCurrencySymbol()} {doctor.consultationFee} · {doctor.experienceYears} yrs
                          </p>
                        </div>
                        <CalendarPlus size={16} className="shrink-0 text-primary" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---- Modal 2: Slot Calendar ---- */}
      {selectedDoctor && !bookingSlot && !cancelSlot && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-border">
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-border shrink-0">
              <div className="flex items-start gap-4">
                <button
                  onClick={() => {
                    setSelectedDoctor(null);
                    setDaySlots(null);
                    setShowBookModal(true);
                    setSearchTerm("");
                    setSelectedSpecializationId("all");
                    setBookModalDeptFilter("all");
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-foreground hover:bg-muted/70 transition-colors shrink-0"
                  aria-label="Back to doctors"
                >
                  <ArrowLeft size={17} />
                </button>
                <div>
                  <p className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wide">
                    <CalendarDays size={14} /> Slot Calendar
                  </p>
                  <h2 className="mt-0.5 text-xl font-semibold text-foreground">{selectedDoctor.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedDoctor.specializationName} · {getCurrencySymbol()} {selectedDoctor.consultationFee} · {selectedDoctor.experienceYears} yrs experience
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setSelectedDoctor(null); setDaySlots(null); }}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* Date + legend */}
            <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-border shrink-0">
              <DatePicker
                value={toDateInputValue(selectedDate)}
                min={toDateInputValue(new Date())}
                onChange={(v) => { if (v) setSelectedDate(new Date(`${v}T00:00:00`)); }}
                className="flex h-10 w-44 items-center justify-between gap-2 rounded-xl border border-input bg-muted px-3 py-1.5 text-left text-sm text-foreground"
              />
              <span className="rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Available</span>
              <span className="rounded-lg border border-blue-600 bg-blue-600 px-3 py-1 text-xs font-semibold text-white">Booked</span>
              <span className="rounded-lg border border-amber-600 bg-amber-600 px-3 py-1 text-xs font-semibold text-white">Needs confirmation</span>
              <span className="rounded-lg border border-purple-600 bg-purple-600 px-3 py-1 text-xs font-semibold text-white">Overlap</span>
            </div>

            {/* Slot grid */}
            <div className="overflow-y-auto p-6">
              {isLoadingSlots ? (
                <LoadingSpinner />
              ) : (daySlots?.slots.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center text-sm text-muted-foreground">
                  This doctor has no schedule configured for this day.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {daySlots!.slots.map((slot) => {
                    const hasPendingBooking = slot.status === "Pending" || slot.bookings.some((b) => b.status === "Pending");
                    const hasOverlap = slot.bookedCount > slot.maxCapacity;
                    return (
                      <button
                        key={slot.start}
                        onClick={() => handleSelectSlot(slot)}
                        disabled={slot.isPast}
                        title={slot.isPast ? "This slot has already passed" : undefined}
                        className={`group flex flex-col gap-2 rounded-xl border p-4 text-left shadow-sm transition-all ${
                          slot.isPast
                            ? "cursor-not-allowed border-border bg-muted/40 opacity-60"
                            : "hover:-translate-y-0.5 hover:shadow-md cursor-pointer " +
                              (hasOverlap
                                ? "border-purple-600/30 bg-purple-50 dark:border-purple-900/50 dark:bg-purple-950/30"
                                : slot.isAvailable
                                ? "border-emerald-600/30 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30"
                                : hasPendingBooking
                                ? "border-amber-600/30 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30"
                                : "border-blue-600/30 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/30")
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`flex items-center gap-1.5 text-sm font-semibold ${
                            slot.isPast ? "text-muted-foreground" : hasOverlap ? "text-purple-700 dark:text-purple-400" : slot.isAvailable ? "text-emerald-700 dark:text-emerald-400" : hasPendingBooking ? "text-amber-700 dark:text-amber-400" : "text-blue-700 dark:text-blue-400"
                          }`}>
                            <Clock size={14} />
                            {format(new Date(slot.start), "h:mm a")}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {slot.bookedCount > 0 && (
                              <span title={hasOverlap ? `Overlap: ${slot.bookedCount} patients` : "Multiple patients"} className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${hasOverlap ? "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400" : "bg-muted text-muted-foreground"}`}>
                                <Users size={11} /> {slot.bookedCount}{hasOverlap ? `/3` : slot.maxCapacity > 1 ? `/${slot.maxCapacity}` : ""}
                              </span>
                            )}
                            {!slot.isPast && hasOverlap && <span className="rounded-md bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-500/10 dark:text-purple-400">Overlap</span>}
                            {!slot.isPast && hasPendingBooking && <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">Pending</span>}
                            {!slot.isPast && (slot.isAvailable ? <CalendarPlus size={16} className="text-emerald-600 dark:text-emerald-400" /> : <CalendarCheck2 size={16} className="text-blue-600 dark:text-blue-400" />)}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">ends {format(new Date(slot.end), "h:mm a")}</span>
                        <span className={`mt-1 truncate rounded-md px-2 py-1 text-xs font-semibold ${
                          slot.isPast ? "bg-muted text-muted-foreground" : hasOverlap ? "bg-purple-600 text-white" : slot.isAvailable ? "bg-emerald-600 text-white" : hasPendingBooking ? "bg-amber-600 text-white" : "bg-blue-600 text-white"
                        }`}>
                          {slot.isPast ? "Past" : hasOverlap ? `Overlap — ${slot.bookedCount} patients` : slot.maxCapacity > 1 ? (slot.isAvailable ? (slot.bookedCount > 0 ? `${slot.bookedCount}/${slot.maxCapacity} booked — open` : "Available") : hasPendingBooking ? `Needs confirmation (${slot.bookedCount}/${slot.maxCapacity})` : `Full (${slot.bookedCount}/${slot.maxCapacity})`) : slot.isAvailable ? "Available" : slot.status === "Pending" ? `${slot.patientName || "Patient"} - Pending confirmation` : slot.isWalkIn ? `${slot.patientName || "Patient"} - Walk-in Visit` : slot.patientName || "Booked"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Book appointment modal */}
      {bookingSlot && selectedDoctor && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-2xl max-w-2xl w-full p-5 max-h-[96vh] overflow-y-auto border border-border">
            <div className="flex items-start justify-between mb-4">
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
                onClick={() => { setBookingSlot(null); setBookingMode("existing"); setNewPatientName(""); setNewPatientPhone(""); setNewPatientPhoneCode("+91"); setNewPatientSex(""); setNewPatientDob(""); setNewPatientEmail(""); setNewPatientNationalId(""); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Patient mode toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden text-sm font-semibold">
                <button
                  type="button"
                  className="flex-1 py-2 bg-primary text-white"
                >
                  Existing patient
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewPatientModal(true)}
                  className="flex-1 py-2 bg-muted text-muted-foreground hover:bg-muted/70 transition-colors cursor-pointer"
                >
                  New patient
                </button>
              </div>

              {/* Patient search */}
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-foreground/90">Patient</label>
                </div>
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
                        <div className="font-medium text-foreground">{patient.name}</div>
                        <div className="text-sm text-muted-foreground">{patient.opNumber || patient.opId} • {patient.phone}</div>
                      </button>
                    ))}
                  </div>
                )}
                {selectedPatient && (
                  <div className="mt-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-sm text-foreground/90"><span className="font-semibold">Selected: </span>{selectedPatient.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedPatient.opNumber || selectedPatient.opId} • {selectedPatient.phone}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground/90 mb-2">Notes</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Reason for visit"
                  rows={2}
                  className="w-full px-4 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:border-primary text-foreground resize-none"
                />
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="followUpCheck" checked={isFollowUp} onChange={(event) => setIsFollowUp(event.target.checked)} className="h-4 w-4" />
                  <label htmlFor="followUpCheck" className="text-sm font-semibold text-foreground/90 cursor-pointer">Follow-up visit</label>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground/90">Urgency:</span>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" checked={urgencyLevel === "Routine"} onChange={() => setUrgencyLevel("Routine")} /> Routine
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" checked={urgencyLevel === "Urgent"} onChange={() => setUrgencyLevel("Urgent")} /> Urgent
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
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

            {/* Patient list */}
            <div className="mt-4 flex flex-col gap-2">
              {cancelSlot.bookings.length > 0 ? (
                cancelSlot.bookings.map((booking) => {
                  const isPending = booking.status === "Pending";
                  return (
                    <div key={booking.appointmentId} className="rounded-lg border border-border bg-muted/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{booking.patientName ?? "Patient"}</p>
                        <div className="flex items-center gap-2">
                          {isPending && (
                            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                              Pending
                            </span>
                          )}
                          {isPending ? (
                            <button
                              onClick={() => handleConfirmPendingRequest(booking.appointmentId ?? undefined)}
                              disabled={isSubmitting}
                              className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                            >
                              <Check size={13} /> Confirm
                            </button>
                          ) : null}
                          <button
                            onClick={() => handleConfirmCancel(booking.appointmentId ?? undefined)}
                            disabled={isSubmitting}
                            className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                          >
                            <XCircle size={13} /> {isPending ? "Decline" : "Cancel"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Patient</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{cancelSlot.patientName ?? "Patient"}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 mt-6">
              {cancelSlot.bookedCount < 3 && selectedDoctor && (
                <button
                  onClick={() => openOverlapBooking(cancelSlot, selectedDoctor.doctorId)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  <Users size={16} /> Add another patient to this slot
                  <span className="ml-1 rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">
                    {cancelSlot.bookedCount}/3
                  </span>
                </button>
              )}
              {cancelSlot.bookings.length <= 1 && cancelSlot.status === "Pending" && (
                <button
                  onClick={() => handleConfirmPendingRequest()}
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:opacity-90 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  <Check size={16} /> Confirm appointment
                </button>
              )}
              {cancelSlot.bookings.length <= 1 && cancelSlot.status !== "Pending" && (
                <button
                  onClick={() => handleConfirmCancel()}
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  <XCircle size={16} /> Cancel appointment
                </button>
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

      {/* Overlap booking modal — add a 2nd / 3rd patient to an already-booked slot */}
      {overlapSlot && overlapDoctorId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-2xl max-w-md w-full p-6 border border-border">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Add another patient</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(new Date(overlapSlot.start), "d MMM yyyy, h:mm a")} — {format(new Date(overlapSlot.end), "h:mm a")}
                </p>
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:bg-purple-500/10 dark:text-purple-400">
                  <Users size={11} /> Overlap booking · {overlapSlot.bookedCount}/3 patients
                </span>
              </div>
              <button onClick={() => setOverlapSlot(null)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="relative">
                <label className="block text-sm font-semibold text-foreground/90 mb-2">Patient</label>
                <input
                  type="text"
                  value={overlapPatientSearch}
                  onChange={(e) => { setOverlapPatientSearch(e.target.value); setOverlapSelectedPatient(null); }}
                  placeholder="Search by name, phone, MRN..."
                  className="w-full px-4 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:border-purple-500 text-foreground"
                />
                {!overlapSelectedPatient && overlapPatientSearch.trim() && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {patients
                      .filter((p) =>
                        p.name.toLowerCase().includes(overlapPatientSearch.toLowerCase()) ||
                        p.phone?.toLowerCase().includes(overlapPatientSearch.toLowerCase()) ||
                        p.opNumber?.toLowerCase().includes(overlapPatientSearch.toLowerCase())
                      )
                      .map((patient) => (
                        <button
                          key={patient.opId}
                          onClick={() => { setOverlapSelectedPatient(patient); setOverlapPatientSearch(patient.name); }}
                          className="w-full text-left px-4 py-2 hover:bg-purple-50 dark:hover:bg-purple-950/30 border-b border-border last:border-b-0 transition-colors"
                        >
                          <div className="font-medium text-foreground">{patient.name}</div>
                          <div className="text-xs text-muted-foreground">{patient.opNumber || patient.opId} · {patient.phone}</div>
                        </button>
                      ))}
                  </div>
                )}
                {overlapSelectedPatient && (
                  <div className="mt-2 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-900">
                    <p className="text-sm font-semibold text-foreground">{overlapSelectedPatient.name}</p>
                    <p className="text-xs text-muted-foreground">{overlapSelectedPatient.opNumber || overlapSelectedPatient.opId} · {overlapSelectedPatient.phone}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground/90 mb-2">Notes (optional)</label>
                <textarea
                  value={overlapNotes}
                  onChange={(e) => setOverlapNotes(e.target.value)}
                  rows={2}
                  placeholder="Reason for visit"
                  className="w-full px-4 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:border-purple-500 text-foreground resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setOverlapSlot(null)}
                className="flex-1 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleOverlapBooking}
                disabled={isSubmittingOverlap || !overlapSelectedPatient}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <Users size={16} /> {isSubmittingOverlap ? "Booking..." : "Book overlap"}
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

      {/* ---- Edit Appointment modal (pre-registration, reuses same doctor/slot picker state) ---- */}
      {editingQueueAppointment && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-border">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">Edit appointment</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {editingQueueAppointment.patientName ?? "Unknown"}
                </p>
              </div>
              <button
                onClick={closeEditAppointment}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Department</label>
                  <SearchableSelect
                    value={editVisitDeptFilter}
                    onChange={(v) => {
                      setEditVisitDeptFilter(v);
                      setEditVisitSpecFilter("all");
                      setEditVisitSelectedDoctor(null);
                    }}
                    options={[
                      { value: "all", label: "All departments" },
                      ...editVisitDeptOptions.map((d) => ({ value: d.id, label: d.name })),
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Specialty</label>
                  <SearchableSelect
                    value={editVisitSpecFilter}
                    onChange={(v) => {
                      setEditVisitSpecFilter(v);
                      setEditVisitSelectedDoctor(null);
                    }}
                    options={[
                      { value: "all", label: "All specialties" },
                      ...editVisitSpecOptions.map((s) => ({ value: s.id, label: s.name })),
                    ]}
                  />
                </div>
              </div>

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

                  <div className="flex items-center gap-4 flex-wrap">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editIsFollowUp}
                        onChange={(e) => setEditIsFollowUp(e.target.checked)}
                      />
                      <span className="font-semibold text-foreground/90">Follow-up visit</span>
                    </label>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-semibold text-foreground/90">Urgency:</span>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          checked={editUrgencyLevel === "Routine"}
                          onChange={() => setEditUrgencyLevel("Routine")}
                        />
                        Routine
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          checked={editUrgencyLevel === "Urgent"}
                          onChange={() => setEditUrgencyLevel("Urgent")}
                        />
                        Urgent
                      </label>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeEditAppointment}
                className="flex-1 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditAppointment}
                disabled={isSavingEditAppointment || !editVisitSelectedDoctor || !editVisitSelectedSlot}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {isSavingEditAppointment ? "Saving..." : "Save changes"}
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Department</label>
                  <SearchableSelect
                    value={editVisitDeptFilter}
                    onChange={(v) => {
                      setEditVisitDeptFilter(v);
                      setEditVisitSpecFilter("all");
                      setEditVisitSelectedDoctor(null);
                    }}
                    options={[
                      { value: "all", label: "All departments" },
                      ...editVisitDeptOptions.map((d) => ({ value: d.id, label: d.name })),
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Specialty</label>
                  <SearchableSelect
                    value={editVisitSpecFilter}
                    onChange={(v) => {
                      setEditVisitSpecFilter(v);
                      setEditVisitSelectedDoctor(null);
                    }}
                    options={[
                      { value: "all", label: "All specialties" },
                      ...editVisitSpecOptions.map((s) => ({ value: s.id, label: s.name })),
                    ]}
                  />
                </div>
              </div>

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

      {/* New Patient Registration Modal */}
      <PatientRegistrationModal
        isOpen={showNewPatientModal}
        onClose={() => setShowNewPatientModal(false)}
        onBooked={() => {
          setBookingSlot(null);
          if (selectedDoctor) fetchSlots(selectedDoctor.doctorId, selectedDate);
        }}
        presetDoctorId={selectedDoctor?.doctorId ?? ""}
        presetSpecId={selectedDoctor?.specializationId ?? ""}
        presetDeptId={specializations.find(s => s.specializationId === selectedDoctor?.specializationId)?.departmentId ?? ""}
        presetSlotStart={bookingSlot?.start ?? ""}
        presetDate={toDateInputValue(selectedDate)}
        doctorName={selectedDoctor?.name ?? ""}
        slotDisplayTime={bookingSlot ? format(new Date(bookingSlot.start), "dd MMM yyyy, h:mm a") : ""}
        specializations={specializations}
      />

      {/* ---- Attachments modal ---- */}
      {attachmentPatient && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col border border-border">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Paperclip size={16} className="text-primary" /> Attachments
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">{attachmentPatient.name}</p>
              </div>
              <button
                onClick={() => setAttachmentPatient(null)}
                className="p-1.5 rounded-full hover:bg-muted transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Document list */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
              {isLoadingDocs ? (
                <div className="flex justify-center py-8"><LoadingSpinner /></div>
              ) : patientDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No documents attached yet.</p>
              ) : (
                patientDocs.map((doc) => {
                  const fileUrl = backendAssetUrl(doc.filePath);
                  const ext = doc.filePath?.split(".").pop()?.toLowerCase() ?? "";
                  const canPreview = PREVIEWABLE_EXTS.includes(ext);
                  return (
                    <div key={doc.patientDocumentId} className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                      <Paperclip size={14} className="shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(doc.createdAt), "dd MMM yyyy, h:mm a")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {fileUrl && canPreview && (
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View"
                            className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                          >
                            <Eye size={13} />
                          </a>
                        )}
                        {fileUrl && !canPreview && (
                          <a
                            href={fileUrl}
                            download
                            title="Download"
                            className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                          >
                            <Eye size={13} />
                          </a>
                        )}
                        <button
                          onClick={() => handleDeleteDoc(doc)}
                          disabled={deletingDocId === doc.patientDocumentId}
                          title="Delete"
                          className="flex items-center justify-center h-7 w-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Upload form */}
            <div className="border-t border-border px-5 py-4 shrink-0 flex flex-col gap-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add document</p>
              <div className="flex items-center gap-2">
                <select
                  value={docUploadType}
                  onChange={(e) => setDocUploadType(e.target.value)}
                  className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {Object.entries(DOC_TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex-1 flex items-center gap-2 h-9 rounded-lg border border-dashed border-border bg-muted/30 hover:bg-muted/50 px-3 text-sm text-muted-foreground cursor-pointer transition-colors">
                  <Upload size={14} />
                  <span className="truncate">{docUploadFile ? docUploadFile.name : "Choose file…"}</span>
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                    className="hidden"
                    onChange={(e) => setDocUploadFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <button
                  onClick={handleUploadDoc}
                  disabled={!docUploadFile || isUploadingDoc}
                  className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {isUploadingDoc ? "Uploading…" : "Upload"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
