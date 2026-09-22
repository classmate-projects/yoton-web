"use client";

import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { getSignalRConnection } from "@/lib/signalR";
import { ReceptionService } from "@/services/reception.service";
import { EmrService } from "@/services/emr.service";
import { PharmacyService } from "@/services/pharmacy.service";
import { SavedMedicalFormService } from "@/services/medicalForm.service";
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

// General alert box - one bell, many sources, instead of the old appointment-request-only
// popover. Each source below normalizes into the same AlertItem shape and gets pushed onto
// one rolling list; who sees which sources is gated per-role inline (not a single
// "canSeeAlerts" flag) since a doctor's alerts (corrections, results) are entirely different
// from admin/reception's (appointment requests, documents, resolved corrections) or a
// pharmacist's (low stock).
export function useAlertCenter(role: string, userId: string | undefined) {
  const isAdmin = role === "admin";
  const isReception = role === "reception";
  const isDoctor = role === "doctor";
  const isPharmacist = role === "pharmacist";
  const canSeeAlerts = isAdmin || isReception || isDoctor || isPharmacist;

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  // Derived, not its own state - unreadCount used to be tracked separately and incremented
  // by hand at every call site, which could only ever drift from the truth. The alert list
  // (specifically each item's own `read` flag - see markAlertRead/markAllRead below) is the
  // single source of truth now.
  const unreadCount = alerts.filter((a) => !a.read).length;
  const [isRinging, setIsRinging] = useState(false);

  const pushAlert = (item: Omit<AlertItem, "read">, toastNode?: ReactNode) => {
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
  const markAlertRead = (id: string) =>
    setAlerts((prev) => prev.map((a) => (a.id === id && !a.read ? { ...a, read: true } : a)));

  const markAllRead = () => setAlerts((prev) => prev.map((a) => (a.read ? a : { ...a, read: true })));

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
            read: false,
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
            read: false,
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
            read: false,
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
            read: false,
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
          read: false,
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
