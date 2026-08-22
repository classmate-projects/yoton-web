"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { AlertItem } from "@/hooks/useAlertCenter";

interface NotificationBellProps {
  alerts: AlertItem[];
  unreadCount: number;
  isRinging: boolean;
  onOpen: () => void;
}

export default function NotificationBell({
  alerts,
  unreadCount,
  isRinging,
  onOpen,
}: NotificationBellProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOpen = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) onOpen();
  };

  const goTo = (navLink: string) => {
    setIsOpen(false);
    router.push(navLink);
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
            <p className="text-sm font-semibold text-foreground">Alerts</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {alerts.length > 0 ? (
              alerts.map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => goTo(alert.navLink)}
                  className="flex w-full flex-col items-start gap-0.5 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/40"
                >
                  <span className="text-sm font-semibold text-foreground">{alert.title}</span>
                  <span className="text-xs text-muted-foreground">{alert.message}</span>
                </button>
              ))
            ) : (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No new alerts
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
