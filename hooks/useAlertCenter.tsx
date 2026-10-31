"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { getSignalRConnection } from "@/lib/signalR";
import { ReceptionService } from "@/services/reception.service";
import { EmrService } from "@/services/emr.service";
import { PharmacyService } from "@/services/pharmacy.service";
import { SavedMedicalFormService } from "@/services/medicalForm.service";
import { AttendanceService } from "@/services/attendance.service";
import { ImmunizationService } from "@/services/immunization.service";
import { AutoCheckOutType } from "@/types/attendance.type";
import type { ImmunizationRemindersType } from "@/types/immunization.type";
import { parseDateInputValue } from "@/lib/date";
import { ensureNotificationPermission, showAlertNotification } from "@/lib/notifications";

export interface AlertItem {
  id: string;
  navLink: string;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

const MAX_ALERTS = 30;

// "Priya", "Priya and Arun", "Priya, Arun and 3 others"
function listNames(names: string[]): string {
  if (names.length <= 2) return names.join(" and ");
  const others = names.length - 2;
  return `${names.slice(0, 2).join(", ")} and ${others} other${others === 1 ? "" : "s"}`;
}

// General alert box - one bell, many sources, instead of the old appointment-request-only
// popover. Each source below normalizes into the same AlertItem shape and gets pushed onto
// one rolling list; who sees which sources is gated per-role inline (not a single
// "canSeeAlerts" flag) since a doctor's alerts (corrections, results) are entirely different
// from admin/reception's (appointment requests, documents, resolved corrections), a
// pharmacist's (low stock) or a nurse's (vaccinations due).
export function useAlertCenter(role: string, userId: string | undefined) {
  const isAdmin = role === "admin";
  const isReception = role === "reception";
  const isDoctor = role === "doctor";
  const isPharmacist = role === "pharmacist";
  const isNurse = role === "nurse";
  const canSeeAlerts = isAdmin || isReception || isDoctor || isPharmacist || isNurse;

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  // Derived, not its own state - unreadCount used to be tracked separately and incremented
  // by hand at every call site, which could only ever drift from the truth. The alert list
  // (specifically each item's own `read` flag - see markAlertRead/markAllRead below) is the
  // single source of truth now.
  const unreadCount = alerts.filter((a) => !a.read).length;
  const [isRinging, setIsRinging] = useState(false);

  // Alerts themselves are ephemeral (rebuilt from each source on every load - there is no
  // notification table), so the only thing worth persisting is which ones the user has already
  // read. Without this, "Read all" lived purely in React state and was lost on refresh, so every
  // reload showed everything as unread again. The read ids are kept per-user in localStorage and
  // consulted wherever an AlertItem is (re)built below, so a read alert stays read across reloads.
  const readIdsRef = useRef<Set<string>>(new Set());
  const storageKeyFor = (uid: string) => `yoton:alertRead:${uid}`;
  const MAX_PERSISTED_READ = 500;

  const persistReadIds = () => {
    if (!userId || typeof window === "undefined") return;
    try {
      // Bounded, keeping the most-recently-added ids, so the set can't grow without limit.
      const ids = [...readIdsRef.current].slice(-MAX_PERSISTED_READ);
      readIdsRef.current = new Set(ids);
      window.localStorage.setItem(storageKeyFor(userId), JSON.stringify(ids));
    } catch {
      /* storage unavailable (private mode, quota) - read-state just won't persist */
    }
  };

  // Load the persisted read ids for this user, and re-apply them to anything already on screen.
  // Declared before the source effects below so, on the render where userId first resolves, the
  // set is populated before those effects' async fetches build their AlertItems.
  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKeyFor(userId));
      readIdsRef.current = new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      readIdsRef.current = new Set();
    }
    setAlerts((prev) => prev.map((a) => (readIdsRef.current.has(a.id) ? { ...a, read: true } : a)));
  }, [userId]);

  const pushAlert = (item: Omit<AlertItem, "read">, toastNode?: ReactNode) => {
    // A fresh live event rings as unread even if an older alert with this id was read before
    // (e.g. stock dropped low again), so clear any stale read flag for it.
    if (readIdsRef.current.delete(item.id)) persistReadIds();
    const unread: AlertItem = { ...item, read: false };
    setAlerts((prev) => [unread, ...prev.filter((a) => a.id !== item.id)].slice(0, MAX_ALERTS));
    setIsRinging(true);
    window.setTimeout(() => setIsRinging(false), 700);
    if (toastNode) toast(toastNode);

    // Every alert that reaches the bell also goes out as a real OS notification via the
    // service worker (not just when the tab is backgrounded) - showAlertNotification itself
    // is a no-op if permission was never granted or was explicitly muted (see
    // lib/notifications.ts), so this is safe to call unconditionally.
    ensureNotificationPermission().then((granted) => {
      if (granted) showAlertNotification(item.title, item.message, item.navLink);
    });
  };

  const dropAlert = (id: string) => setAlerts((prev) => prev.filter((a) => a.id !== id));

  // Individual alerts are marked read as the user opens each one (NotificationBell's goTo);
  // markAllRead backs the panel's "Read all" button for clearing the whole list in one go.
  const markAlertRead = (id: string) => {
    if (!readIdsRef.current.has(id)) {
      readIdsRef.current.add(id);
      persistReadIds();
    }
    setAlerts((prev) => prev.map((a) => (a.id === id && !a.read ? { ...a, read: true } : a)));
  };

  const markAllRead = () =>
    setAlerts((prev) => {
      let changed = false;
      prev.forEach((a) => {
        if (!readIdsRef.current.has(a.id)) {
          readIdsRef.current.add(a.id);
          changed = true;
        }
      });
      if (changed) persistReadIds();
      return prev.map((a) => (a.read ? a : { ...a, read: true }));
    });

  // Which automatic check-outs already have an alert, so a live refetch only rings for new ones.
  const knownAutoCheckOutIds = useRef(new Set<string>());

  // Last-seen immunization reminder counts (-1 = not loaded yet), so only a rise rings the bell.
  const immunizationCounts = useRef({ overdue: -1, soon: -1 });

  // ---------------- Appointment requests (admin, reception) ----------------
  useEffect(() => {
    if (!isAdmin && !isReception) return;
    let isMounted = true;
    ReceptionService.getAppointmentRequests()
      .then((data) => {
        if (!isMounted) return;
        const existing: AlertItem[] = (data.data ?? []).map(
          (r: { appointmentId: string; patientName: string | null; doctorName: string | null; appointmentDate: string }) => ({
            id: `appt-${r.appointmentId}`,
            navLink: "/appointments",
            title: "Appointment request",
            message: `${r.patientName ?? "A patient"} requested ${r.doctorName ?? "a doctor"} for ${new Date(r.appointmentDate).toLocaleString()}`,
            timestamp: Date.now(),
            read: readIdsRef.current.has(`appt-${r.appointmentId}`),
          })
        );
        setAlerts((prev) => [...existing, ...prev].slice(0, MAX_ALERTS));
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [isAdmin, isReception]);

  useEffect(() => {
    if (!isAdmin && !isReception) return;
    let isMounted = true;

    const handleRequested = (event: { appointmentId: string; patientName: string | null; doctorName: string | null; appointmentDate: string }) => {
      if (!isMounted) return;
      pushAlert(
        {
          id: `appt-${event.appointmentId}`,
          navLink: "/appointments",
          title: "Appointment request",
          message: `${event.patientName ?? "A patient"} requested ${event.doctorName ?? "a doctor"} for ${new Date(event.appointmentDate).toLocaleString()}`,
          timestamp: Date.now(),
        },
        <span>New appointment request from <b>{event.patientName ?? "a patient"}</b></span>
      );
    };
    const handleStatusUpdated = (payload: { appointmentId?: string; AppointmentId?: string }) => {
      if (!isMounted) return;
      const id = payload.appointmentId ?? payload.AppointmentId;
      if (id) dropAlert(`appt-${id}`);
    };

    const connect = async () => {
      const connection = await getSignalRConnection();
      if (!isMounted) return;
      connection.off("appointmentRequested", handleRequested);
      connection.off("appointmentStatusUpdated", handleStatusUpdated);
      connection.on("appointmentRequested", handleRequested);
      connection.on("appointmentStatusUpdated", handleStatusUpdated);
    };
    connect().catch(() => {});

    return () => {
      isMounted = false;
      getSignalRConnection().then((connection) => {
        connection.off("appointmentRequested", handleRequested);
        connection.off("appointmentStatusUpdated", handleStatusUpdated);
      }).catch(() => {});
    };
  }, [isAdmin, isReception]);

  // ---------------- Doctor-requested follow-ups (admin, reception) ----------------
  // A follow-up isn't a confirmed appointment - reception sees the alert, then either
  // confirms it into a real slot or dismisses it (see app/(pages)/appointments/page.tsx's
  // "Pending Follow-Ups" section and ReceptionController.ConfirmFollowUp/DismissFollowUp).
  useEffect(() => {
    if (!isAdmin && !isReception) return;
    let isMounted = true;
    ReceptionService.getPendingFollowUps()
      .then((data) => {
        if (!isMounted) return;
        const existing: AlertItem[] = (data.data ?? []).map(
          (f: { followUpId: string; patientName: string | null; doctorName: string | null; followUpDate: string }) => ({
            id: `followup-${f.followUpId}`,
            navLink: "/appointments",
            title: "Follow-up requested",
            message: `Dr. ${f.doctorName ?? "—"} requested a follow-up for ${f.patientName ?? "a patient"} around ${new Date(f.followUpDate).toLocaleDateString()}`,
            timestamp: Date.now(),
            read: readIdsRef.current.has(`followup-${f.followUpId}`),
          })
        );
        setAlerts((prev) => [...existing, ...prev].slice(0, MAX_ALERTS));
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [isAdmin, isReception]);

  useEffect(() => {
    if (!isAdmin && !isReception) return;
    let isMounted = true;

    const handleAdded = (event: { followUpId: string; patientName: string | null; doctorName: string | null; followUpDate: string }) => {
      if (!isMounted) return;
      pushAlert(
        {
          id: `followup-${event.followUpId}`,
          navLink: "/appointments",
          title: "Follow-up requested",
          message: `Dr. ${event.doctorName ?? "—"} requested a follow-up for ${event.patientName ?? "a patient"} around ${new Date(event.followUpDate).toLocaleDateString()}`,
          timestamp: Date.now(),
        },
        <span>Dr. {event.doctorName ?? "—"} requested a follow-up for <b>{event.patientName ?? "a patient"}</b></span>
      );
    };
    const handleResolved = (event: { followUpId: string }) => {
      if (!isMounted) return;
      dropAlert(`followup-${event.followUpId}`);
    };

    const connect = async () => {
      const connection = await getSignalRConnection();
      if (!isMounted) return;
      connection.off("followUpAdded", handleAdded);
      connection.off("followUpResolved", handleResolved);
      connection.on("followUpAdded", handleAdded);
      connection.on("followUpResolved", handleResolved);
    };
    connect().catch(() => {});

    return () => {
      isMounted = false;
      getSignalRConnection().then((connection) => {
        connection.off("followUpAdded", handleAdded);
        connection.off("followUpResolved", handleResolved);
      }).catch(() => {});
    };
  }, [isAdmin, isReception]);

  // ---------------- Encounter corrections proposed (doctor - needs their acknowledgment) ----------------
  useEffect(() => {
    if (!isDoctor) return;
    let isMounted = true;
    EmrService.getMyPendingCorrections()
      .then((res) => {
        if (!isMounted) return;
        const existing: AlertItem[] = (res.data ?? []).map(
          (c: { encounterCorrectionId: string; patientName: string | null; proposedByName: string | null }) => ({
            id: `corr-${c.encounterCorrectionId}`,
            navLink: "/doctor",
            title: "Correction needs your review",
            message: `${c.proposedByName ?? "An admin"} proposed a correction for ${c.patientName ?? "a patient"}'s encounter`,
            timestamp: Date.now(),
            read: readIdsRef.current.has(`corr-${c.encounterCorrectionId}`),
          })
        );
        setAlerts((prev) => [...existing, ...prev].slice(0, MAX_ALERTS));
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [isDoctor]);

  useEffect(() => {
    if (!isDoctor || !userId) return;
    let isMounted = true;

    const handleProposed = (event: { encounterCorrectionId: string; targetUserId: string; patientName: string | null }) => {
      if (!isMounted || event.targetUserId !== userId) return;
      pushAlert(
        {
          id: `corr-${event.encounterCorrectionId}`,
          navLink: "/doctor",
          title: "Correction needs your review",
          message: `An admin proposed a correction for ${event.patientName ?? "a patient"}'s encounter`,
          timestamp: Date.now(),
        },
        <span>A correction needs your review for <b>{event.patientName ?? "a patient"}</b></span>
      );
    };
    const handleResolved = (event: { encounterCorrectionId: string }) => {
      if (!isMounted) return;
      dropAlert(`corr-${event.encounterCorrectionId}`);
    };

    const connect = async () => {
      const connection = await getSignalRConnection();
      if (!isMounted) return;
      connection.off("encounterCorrectionProposed", handleProposed);
      connection.off("encounterCorrectionResolved", handleResolved);
      connection.on("encounterCorrectionProposed", handleProposed);
      connection.on("encounterCorrectionResolved", handleResolved);
    };
    connect().catch(() => {});

    return () => {
      isMounted = false;
      getSignalRConnection().then((connection) => {
        connection.off("encounterCorrectionProposed", handleProposed);
        connection.off("encounterCorrectionResolved", handleResolved);
      }).catch(() => {});
    };
  }, [isDoctor, userId]);

  // ---------------- Encounter corrections resolved (admin - the one who proposed it) ----------------
  useEffect(() => {
    if (!isAdmin || !userId) return;
    let isMounted = true;

    const handleResolved = (event: { encounterCorrectionId: string; status: string; proposedByUserId?: string }) => {
      if (!isMounted || event.proposedByUserId !== userId) return;
      const verb = event.status === "Acknowledged" ? "accepted" : "rejected";
      pushAlert(
        {
          id: `corr-resolved-${event.encounterCorrectionId}`,
          navLink: "/doctor",
          title: "Correction " + verb,
          message: `The doctor ${verb} your proposed correction`,
          timestamp: Date.now(),
        },
        <span>Your proposed correction was <b>{verb}</b></span>
      );
    };

    const connect = async () => {
      const connection = await getSignalRConnection();
      if (!isMounted) return;
      connection.off("encounterCorrectionResolved", handleResolved);
      connection.on("encounterCorrectionResolved", handleResolved);
    };
    connect().catch(() => {});

    return () => {
      isMounted = false;
      getSignalRConnection().then((connection) => {
        connection.off("encounterCorrectionResolved", handleResolved);
      }).catch(() => {});
    };
  }, [isAdmin, userId]);

  // ---------------- Medical form handed over to me (any role that can fill one) ----------------
  // Same "broadcast + client-side targetUserId filter" shape as encounter corrections above -
  // gated on userId being present rather than one specific role, since a form can be handed
  // to whichever doctor/nurse/other clinical role the sender picked.
  useEffect(() => {
    if (!userId) return;
    let isMounted = true;
    SavedMedicalFormService.getMyPendingHandovers()
      .then((res) => {
        if (!isMounted) return;
        const existing: AlertItem[] = (res.data ?? []).map(
          (h: { savedMedicalFormId: string; formTemplateName: string; patientName: string | null; fromUserName: string | null }) => ({
            id: `handover-${h.savedMedicalFormId}`,
            navLink: "/doctor",
            title: "Medical form awaiting your response",
            message: `${h.fromUserName ?? "A colleague"} handed you "${h.formTemplateName}" for ${h.patientName ?? "a patient"}`,
            timestamp: Date.now(),
            read: readIdsRef.current.has(`handover-${h.savedMedicalFormId}`),
          })
        );
        setAlerts((prev) => [...existing, ...prev].slice(0, MAX_ALERTS));
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;

    const handleRequested = (event: { savedMedicalFormId: string; targetUserId: string; formTemplateName: string; patientName: string | null }) => {
      if (!isMounted || event.targetUserId !== userId) return;
      pushAlert(
        {
          id: `handover-${event.savedMedicalFormId}`,
          navLink: "/doctor",
          title: "Medical form awaiting your response",
          message: `A colleague handed you "${event.formTemplateName}" for ${event.patientName ?? "a patient"}`,
          timestamp: Date.now(),
        },
        <span>A medical form was handed to you for <b>{event.patientName ?? "a patient"}</b></span>
      );
    };
    const handleResolved = (event: { savedMedicalFormId: string }) => {
      if (!isMounted) return;
      dropAlert(`handover-${event.savedMedicalFormId}`);
    };

    const connect = async () => {
      const connection = await getSignalRConnection();
      if (!isMounted) return;
      connection.off("savedMedicalFormHandoverRequested", handleRequested);
      connection.off("savedMedicalFormHandoverResolved", handleResolved);
      connection.on("savedMedicalFormHandoverRequested", handleRequested);
      connection.on("savedMedicalFormHandoverResolved", handleResolved);
    };
    connect().catch(() => {});

    return () => {
      isMounted = false;
      getSignalRConnection().then((connection) => {
        connection.off("savedMedicalFormHandoverRequested", handleRequested);
        connection.off("savedMedicalFormHandoverResolved", handleResolved);
      }).catch(() => {});
    };
  }, [userId]);

  // ---------------- New patient documents (admin, reception) ----------------
  useEffect(() => {
    if (!isAdmin && !isReception) return;
    let isMounted = true;

    const handleUploaded = (event: { patientDocumentId: string; documentType: string }) => {
      if (!isMounted) return;
      pushAlert(
        {
          id: `doc-${event.patientDocumentId}`,
          navLink: "/patient-records",
          title: "New patient document",
          message: `A new ${event.documentType || "document"} was uploaded`,
          timestamp: Date.now(),
        },
        <span>New patient document uploaded: <b>{event.documentType || "document"}</b></span>
      );
    };

    const connect = async () => {
      const connection = await getSignalRConnection();
      if (!isMounted) return;
      connection.off("patientDocumentUploaded", handleUploaded);
      connection.on("patientDocumentUploaded", handleUploaded);
    };
    connect().catch(() => {});

    return () => {
      isMounted = false;
      getSignalRConnection().then((connection) => {
        connection.off("patientDocumentUploaded", handleUploaded);
      }).catch(() => {});
    };
  }, [isAdmin, isReception]);

  // ---------------- Low medicine stock (admin, pharmacist) ----------------
  useEffect(() => {
    if (!isAdmin && !isPharmacist) return;
    let isMounted = true;
    PharmacyService.getLowStock()
      .then((res) => {
        if (!isMounted) return;
        const existing: AlertItem[] = (res.data ?? []).map((m: { medicineId: string; name: string; stock: number }) => ({
          id: `stock-${m.medicineId}`,
          navLink: "/pharmacy",
          title: "Low stock",
          message: `${m.name} is down to ${m.stock} units`,
          timestamp: Date.now(),
          read: readIdsRef.current.has(`stock-${m.medicineId}`),
        }));
        setAlerts((prev) => [...existing, ...prev].slice(0, MAX_ALERTS));
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [isAdmin, isPharmacist]);

  useEffect(() => {
    if (!isAdmin && !isPharmacist) return;
    let isMounted = true;

    const handleLowStock = (event: { medicineId: string; name: string; stock: number }) => {
      if (!isMounted) return;
      pushAlert(
        {
          id: `stock-${event.medicineId}`,
          navLink: "/pharmacy",
          title: "Low stock",
          message: `${event.name} is down to ${event.stock} units`,
          timestamp: Date.now(),
        },
        <span><b>{event.name}</b> is running low ({event.stock} left)</span>
      );
    };

    const connect = async () => {
      const connection = await getSignalRConnection();
      if (!isMounted) return;
      connection.off("medicineLowStock", handleLowStock);
      connection.on("medicineLowStock", handleLowStock);
    };
    connect().catch(() => {});

    return () => {
      isMounted = false;
      getSignalRConnection().then((connection) => {
        connection.off("medicineLowStock", handleLowStock);
      }).catch(() => {});
    };
  }, [isAdmin, isPharmacist]);

  // ---------------- Missed check-outs (admin - the supervisor's view) ----------------
  // One alert per day the end-of-day job had to check someone out (see EodAutoCheckOutService),
  // linking to that day on Staff Attendance. Loaded on start too, since the job runs at
  // midnight when hardly any admin is online to catch the live event.
  useEffect(() => {
    if (!isAdmin) return;
    let isMounted = true;

    const load = (announce: boolean) =>
      AttendanceService.getRecentAutoCheckOuts()
        .then((res) => {
          if (!isMounted) return;
          const records: AutoCheckOutType[] = res.data ?? [];
          const byDate = new Map<string, AutoCheckOutType[]>();
          records.forEach((r) => byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]));

          byDate.forEach((group, date) => {
            if (group.every((r) => knownAutoCheckOutIds.current.has(r.attendanceRecordId))) return;
            const day = (parseDateInputValue(date) ?? new Date(date)).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
            const who = listNames(group.map((r) => r.name));
            const item = {
              id: `autocheckout-${date}`,
              navLink: `/staff-attendance?date=${date}`,
              title: "Missed check-out",
              message: `${who} didn't check out on ${day}, so the system checked them out automatically at 11:59:59 PM`,
              timestamp: Date.now(),
            };
            if (announce) {
              pushAlert(item, <span><b>{who}</b> didn&apos;t check out on {day} - checked out automatically</span>);
            } else {
              setAlerts((prev) => [{ ...item, read: readIdsRef.current.has(item.id) }, ...prev.filter((a) => a.id !== item.id)].slice(0, MAX_ALERTS));
            }
          });
          records.forEach((r) => knownAutoCheckOutIds.current.add(r.attendanceRecordId));
        })
        .catch(() => {});

    load(false);
    // The event isn't company-scoped, so just refetch - the API only ever returns this admin's own staff.
    const handleAutoCheckedOut = () => load(true);

    const connect = async () => {
      const connection = await getSignalRConnection();
      if (!isMounted) return;
      connection.off("attendanceAutoCheckedOut", handleAutoCheckedOut);
      connection.on("attendanceAutoCheckedOut", handleAutoCheckedOut);
    };
    connect().catch(() => {});

    return () => {
      isMounted = false;
      getSignalRConnection().then((connection) => {
        connection.off("attendanceAutoCheckedOut", handleAutoCheckedOut);
      }).catch(() => {});
    };
  }, [isAdmin]);

  // ---------------- Immunization reminders (doctor - doses they ordered; nurse, admin - everyone's) ----------------
  // Two rolling alerts (overdue, and due today/soon) rather than one per vaccination, so a busy
  // pediatric list can't flood the bell. Refetched whenever an order changes or the reminder
  // job raises new ones (ImmunizationReminderService); only a rise in either count rings.
  useEffect(() => {
    if (!isDoctor && !isNurse && !isAdmin) return;
    let isMounted = true;
    const navLink = isDoctor ? "/doctor" : "/nursing";

    const upsert = (id: string, count: number, previous: number, item: Omit<AlertItem, "read">, toastNode: ReactNode) => {
      if (count === 0) {
        dropAlert(id);
      } else if (previous >= 0 && count > previous) {
        pushAlert(item, toastNode);
      } else {
        setAlerts((prev) => {
          const existing = prev.find((a) => a.id === id);
          return [{ ...item, read: existing?.read ?? readIdsRef.current.has(id) }, ...prev.filter((a) => a.id !== id)].slice(0, MAX_ALERTS);
        });
      }
    };

    const load = () =>
      ImmunizationService.getReminders()
        .then((res) => {
          if (!isMounted) return;
          const data: ImmunizationRemindersType | null = res.data ?? null;
          const overdue = data?.overdue ?? 0;
          const dueToday = data?.dueToday ?? 0;
          const upcoming = data?.upcoming ?? 0;
          const soon = dueToday + upcoming;
          const previous = immunizationCounts.current;
          immunizationCounts.current = { overdue, soon };

          upsert(
            "immunization-overdue",
            overdue,
            previous.overdue,
            {
              id: "immunization-overdue",
              navLink,
              title: "Vaccinations overdue",
              message: `${overdue} scheduled vaccination${overdue === 1 ? " is" : "s are"} overdue`,
              timestamp: Date.now(),
            },
            <span><b>{overdue}</b> scheduled vaccination{overdue === 1 ? " is" : "s are"} overdue</span>
          );
          const soonParts = [
            dueToday > 0 ? `${dueToday} due today` : null,
            upcoming > 0 ? `${upcoming} in the next ${data?.windowDays ?? 7} days` : null,
          ].filter(Boolean).join(", ");
          upsert(
            "immunization-due-soon",
            soon,
            previous.soon,
            {
              id: "immunization-due-soon",
              navLink,
              title: "Vaccinations due soon",
              message: `Scheduled vaccinations: ${soonParts}`,
              timestamp: Date.now(),
            },
            <span>Scheduled vaccinations: <b>{soonParts}</b></span>
          );
        })
        .catch(() => {});

    load();
    const handleChanged = () => load();

    const connect = async () => {
      const connection = await getSignalRConnection();
      if (!isMounted) return;
      connection.off("immunizationOrderChanged", handleChanged);
      connection.off("immunizationRemindersUpdated", handleChanged);
      connection.on("immunizationOrderChanged", handleChanged);
      connection.on("immunizationRemindersUpdated", handleChanged);
    };
    connect().catch(() => {});

    return () => {
      isMounted = false;
      getSignalRConnection().then((connection) => {
        connection.off("immunizationOrderChanged", handleChanged);
        connection.off("immunizationRemindersUpdated", handleChanged);
      }).catch(() => {});
    };
  }, [isDoctor, isNurse, isAdmin]);

  // ---------------- Lab/radiology results ready (doctor - the one who ordered it) ----------------
  useEffect(() => {
    if (!isDoctor || !userId) return;
    let isMounted = true;

    const handleLabUpdated = (event: { labRequestId: string; status: string; doctorUserId?: string; patientName?: string }) => {
      if (!isMounted || event.doctorUserId !== userId || event.status !== "Completed") return;
      pushAlert(
        {
          id: `lab-${event.labRequestId}`,
          navLink: "/lab",
          title: "Lab result ready",
          message: `Lab result for ${event.patientName ?? "a patient"} is ready`,
          timestamp: Date.now(),
        },
        <span>Lab result ready for <b>{event.patientName ?? "a patient"}</b></span>
      );
    };
    const handleRadiologyUpdated = (event: { radiologyRequestId: string; status: string; doctorUserId?: string; patientName?: string }) => {
      if (!isMounted || event.doctorUserId !== userId || event.status !== "Completed") return;
      pushAlert(
        {
          id: `rad-${event.radiologyRequestId}`,
          navLink: "/radiology",
          title: "Radiology result ready",
          message: `Radiology result for ${event.patientName ?? "a patient"} is ready`,
          timestamp: Date.now(),
        },
        <span>Radiology result ready for <b>{event.patientName ?? "a patient"}</b></span>
      );
    };

    const connect = async () => {
      const connection = await getSignalRConnection();
      if (!isMounted) return;
      connection.off("labStatusUpdated", handleLabUpdated);
      connection.off("radiologyStatusUpdated", handleRadiologyUpdated);
      connection.on("labStatusUpdated", handleLabUpdated);
      connection.on("radiologyStatusUpdated", handleRadiologyUpdated);
    };
    connect().catch(() => {});

    return () => {
      isMounted = false;
      getSignalRConnection().then((connection) => {
        connection.off("labStatusUpdated", handleLabUpdated);
        connection.off("radiologyStatusUpdated", handleRadiologyUpdated);
      }).catch(() => {});
    };
  }, [isDoctor, userId]);

  return { canSeeAlerts, alerts, unreadCount, isRinging, markAlertRead, markAllRead };
}
