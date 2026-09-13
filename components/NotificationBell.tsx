"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Bell, BellOff, BellRing, CheckCheck } from "lucide-react";
import { AlertItem } from "@/hooks/useAlertCenter";
import {
  areNotificationsEnabled,
  ensureNotificationPermission,
  getNotificationPermissionState,
  setNotificationsEnabled,
  type NotificationPermissionState,
} from "@/lib/notifications";

interface NotificationBellProps {
  alerts: AlertItem[];
  unreadCount: number;
  isRinging: boolean;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

// Bottom breathing room the portaled panel keeps clear of the viewport edge -
// matches the sidebar's own flyouts (see sidebar.tsx's FLYOUT_BOTTOM_MARGIN).
const PANEL_BOTTOM_MARGIN = 16;

export default function NotificationBell({
  alerts,
  unreadCount,
  isRinging,
  onMarkRead,
  onMarkAllRead,
}: NotificationBellProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const [permission, setPermission] = useState<NotificationPermissionState>("unsupported");
  // App-level mute, independent of the browser's own permission (see lib/notifications.ts) -
  // this is what actually flips when the button is clicked while permission is "granted",
  // since there's no way to make the browser ask again once it's already said yes.
  const [enabled, setEnabled] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);

  const refreshNotificationState = () => {
    setPermission(getNotificationPermissionState());
    setEnabled(areNotificationsEnabled());
  };

  useEffect(() => {
    setMounted(true);
    refreshNotificationState();
  }, []);

  // Re-checks each time the panel opens - the user may have flipped the browser permission
  // from its own site-settings UI (the only way to undo a "denied") since the panel was last
  // open.
  useEffect(() => {
    if (isOpen) refreshNotificationState();
  }, [isOpen]);

  const handleToggleNotifications = async () => {
    // Once denied, no browser re-shows the permission prompt from JS - only the user can
    // flip it back via their own browser's site settings, so there's nothing left to do here
    // besides let the icon/title keep communicating that.
    if (permission === "denied" || permission === "unsupported" || requestingPermission) return;

    if (permission === "granted") {
      // Already granted - toggle the app-level mute instead of re-requesting (a no-op).
      setNotificationsEnabled(!enabled);
      setEnabled(!enabled);
      return;
    }

    setRequestingPermission(true);
    const granted = await ensureNotificationPermission();
    if (granted) setNotificationsEnabled(true);
    refreshNotificationState();
    setRequestingPermission(false);
  };

  // Renders the panel via a portal to document.body instead of laying it out as a normal
  // DOM child, since the sidebar's own nav scroll container clips anything poking out past
  // its edge (see sidebar.tsx's data-sidebar-scroll comment) - so it's positioned here from
  // the trigger's actual on-screen rect, in viewport ("fixed") coordinates, instead.
  useEffect(() => {
    if (!isOpen) {
      setPanelPos(null);
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setPanelPos({
        top: rect.bottom + 4,
        left: rect.left,
        maxHeight: window.innerHeight - rect.bottom - PANEL_BOTTOM_MARGIN,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);

    const navScrollEl = containerRef.current?.closest("[data-sidebar-scroll]");
    const handleScroll = () => setIsOpen(false);
    navScrollEl?.addEventListener("scroll", handleScroll);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      navScrollEl?.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const toggleOpen = () => setIsOpen((prev) => !prev);

  const goTo = (alert: AlertItem) => {
    onMarkRead(alert.id);
    setIsOpen(false);
    router.push(alert.navLink);
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

      {mounted && isOpen && panelPos &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", top: panelPos.top, left: panelPos.left, maxHeight: panelPos.maxHeight }}
            className="z-[100] flex w-80 flex-col rounded-xl border border-border bg-card shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-foreground">Alerts</p>
              <div className="flex items-center gap-1.5">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={onMarkAllRead}
                    title="Mark all as read"
                    className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                  >
                    <CheckCheck size={13} />
                    Read all
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleToggleNotifications}
                  disabled={requestingPermission || permission === "unsupported"}
                  title={
                    permission === "denied"
                      ? "Browser notifications are blocked - enable them in your browser's site settings"
                      : permission === "unsupported"
                        ? "Browser notifications aren't supported here"
                        : permission === "granted" && enabled
                          ? "Notifications are on - click to turn off"
                          : "Click to turn notifications on"
                  }
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    permission === "granted" && enabled
                      ? "bg-primary/10 text-primary"
                      : permission === "denied"
                        ? "bg-red-500/10 text-red-500 hover:bg-red-500/15"
                        : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  } ${permission === "unsupported" ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                >
                  {permission === "granted" && enabled ? <BellRing size={13} /> : <BellOff size={13} />}
                  {permission === "denied" ? "Blocked" : permission === "granted" && enabled ? "On" : "Off"}
                </button>
              </div>
            </div>
            <div className="overflow-y-auto">
              {alerts.length > 0 ? (
                alerts.map((alert) => (
                  <button
                    key={alert.id}
                    onClick={() => goTo(alert)}
                    className="flex w-full items-start gap-2.5 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/40"
                  >
                    <span
                      aria-hidden
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${alert.read ? "bg-transparent" : "bg-primary"}`}
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className={`text-sm ${alert.read ? "font-medium text-muted-foreground" : "font-semibold text-foreground"}`}>
                        {alert.title}
                      </span>
                      <span className={`text-xs ${alert.read ? "text-muted-foreground/70" : "text-muted-foreground"}`}>
                        {alert.message}
                      </span>
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No new alerts
                </p>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
