"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AppointmentRequestedEvent,
  useAppointmentRequestSignalR,
} from "@/hooks/useAppointmentRequestSignalR";
import { ReceptionService } from "@/services/reception.service";
import { getSignalRConnection } from "@/lib/signalR";

// Single source of truth for "unread appointment requests", shared by the
// sidebar's collapsed-logo badge and the expanded bell so both always agree on
// the same count instead of running two independent SignalR subscriptions.
export function useUnreadAppointmentRequests(role: string) {
  const canSeeRequests = role === "admin" || role === "reception";

  const [notifications, setNotifications] = useState<AppointmentRequestedEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isRinging, setIsRinging] = useState(false);

  // Live SignalR events only cover requests submitted while this tab is open —
  // without this, a fresh login or page refresh shows an empty bell even when
  // Pending requests already exist server-side.
  useEffect(() => {
    if (!canSeeRequests) return;

    let isMounted = true;
    ReceptionService.getAppointmentRequests()
      .then((data) => {
        if (!isMounted) return;
        const existing: AppointmentRequestedEvent[] = (data.data ?? []).map(
          (request: {
            appointmentId: string;
            patientId: string | null;
            patientName: string | null;
            doctorId: string | null;
            doctorName: string | null;
            appointmentDate: string;
            notes: string | null;
          }) => ({
            appointmentId: request.appointmentId,
            patientId: request.patientId,
            patientName: request.patientName,
            doctorId: request.doctorId,
            doctorName: request.doctorName,
            appointmentDate: request.appointmentDate,
            status: "Pending",
            notes: request.notes,
          })
        );
        setNotifications(existing.slice(0, 20));
        setUnreadCount(existing.length);
      })
      .catch((error) => {
        console.error("Failed to fetch pending appointment requests:", error);
      });

    return () => {
      isMounted = false;
    };
  }, [canSeeRequests]);

  // Once reception confirms/declines a request (from the Appointments page or
  // any other tab), drop it here too so the bell can't show an already-resolved
  // request as if it were still new.
  useEffect(() => {
    if (!canSeeRequests) return;

    let isMounted = true;
    const handleStatusUpdated = (payload: { appointmentId?: string; AppointmentId?: string }) => {
      if (!isMounted) return;
      const resolvedId = payload.appointmentId ?? payload.AppointmentId;
      if (!resolvedId) return;
      setNotifications((prev) => prev.filter((n) => n.appointmentId !== resolvedId));
    };

    const connect = async () => {
      const connection = await getSignalRConnection();
      if (!isMounted) return;
      connection.off("appointmentStatusUpdated", handleStatusUpdated);
      connection.on("appointmentStatusUpdated", handleStatusUpdated);
    };
    connect().catch(() => {});

    return () => {
      isMounted = false;
      getSignalRConnection().then((connection) => {
        connection.off("appointmentStatusUpdated", handleStatusUpdated);
      }).catch(() => {});
    };
  }, [canSeeRequests]);

  useAppointmentRequestSignalR((event) => {
    if (!canSeeRequests) return;

    setNotifications((prev) => [event, ...prev].slice(0, 20));
    setUnreadCount((prev) => prev + 1);

    setIsRinging(true);
    window.setTimeout(() => setIsRinging(false), 700);

    toast(
      <span>
        New appointment request from{" "}
        <b>{event.patientName ?? "a patient"}</b>
      </span>
    );
  });

  const clearUnread = () => setUnreadCount(0);

  return { canSeeRequests, notifications, unreadCount, isRinging, clearUnread };
}
