"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { logout } from "@/lib/auth";
import { getUserDetail, onUserDetailChange } from "@/lib/userDetail";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"] as const;

// Company-wide, admin-configured (Settings > Company profile) - one value for every
// signed-in user, no per-user override. Mirrors the mobile app's own idle timeout
// (Yoton-Mobile's App.xaml.cs OnSleep/OnResume), so a session times out consistently
// whether it's the web app left open or the phone app left backgrounded.
export function useIdleLogout() {
  const router = useRouter();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleIdleTimeout = async () => {
      await logout();
      toast.error("You've been signed out after a period of inactivity.");
      router.push("/login");
    };

    const resetTimer = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      const minutes = getUserDetail()?.idleTimeoutMinutes;
      if (!minutes || minutes <= 0) return;
      timeoutRef.current = setTimeout(handleIdleTimeout, minutes * 60 * 1000);
    };

    resetTimer();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    // If an admin changes the idle timeout in Settings mid-session, their own tab picks up
    // the new duration immediately instead of waiting for a reload/re-login.
    const unsubscribe = onUserDetailChange(resetTimer);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
