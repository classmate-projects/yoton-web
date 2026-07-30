"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import {
  AppointmentRequestedEvent,
  useAppointmentRequestSignalR,
} from "@/hooks/useAppointmentRequestSignalR";

interface NotificationBellProps {
  role: string;
}

export default function NotificationBell({ role }: NotificationBellProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<AppointmentRequestedEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isRinging, setIsRinging] = useState(false);

  const canSeeRequests = role === "admin" || role === "reception";

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!canSeeRequests) return null;

  const toggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) setUnreadCount(0);
      return next;
    });
  };

  const goToAppointments = () => {
    setIsOpen(false);
    router.push("/appointments");
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={toggleOpen}
        aria-label="Notifications"
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground ${
          isRinging ? "animate-bell-ring" : ""
        }`}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-12 z-50 w-80 rounded-xl border border-border bg-card shadow-2xl">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Appointment requests</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((notification, index) => (
                <button
                  key={`${notification.appointmentId}-${index}`}
                  onClick={goToAppointments}
                  className="flex w-full flex-col items-start gap-0.5 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/40"
                >
                  <span className="text-sm font-semibold text-foreground">
                    {notification.patientName ?? "A patient"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    requested {notification.doctorName ?? "a doctor"} for{" "}
                    {new Date(notification.appointmentDate).toLocaleString()}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No new requests
              </p>
            )}
          </div>
          <button
            onClick={goToAppointments}
            className="block w-full rounded-b-xl border-t border-border px-4 py-2.5 text-center text-sm font-semibold text-primary hover:bg-primary/10"
          >
            View all appointments
          </button>
        </div>
      )}
    </div>
  );
}
