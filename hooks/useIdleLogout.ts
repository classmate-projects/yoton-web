"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { logout } from "@/lib/auth";
import { getUserDetail, onUserDetailChange } from "@/lib/userDetail";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"] as const;
const WARNING_SECONDS = 30;

// Company-wide, admin-configured (Settings > Company profile) - one value for every
// signed-in user, no per-user override. Mirrors the mobile app's own idle timeout
// (Yoton-Mobile's App.xaml.cs OnSleep/OnResume), so a session times out consistently
// whether it's the web app left open or the phone app left backgrounded.
//
// The last WARNING_SECONDS of the idle window show a countdown modal (see
// SessionTimeoutModal, rendered by the layout using this hook's return value) that requires
// an explicit "Stay signed in" click to dismiss - ordinary mouse/keyboard activity no longer
// resets the timer once the warning is up, so a user who's genuinely stepped away doesn't
// accidentally keep the session alive via a stray notification or background tab activity.
export function useIdleLogout() {
  const router = useRouter();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const warningActiveRef = useRef(false);
  const [warningSecondsLeft, setWarningSecondsLeft] = useState<number | null>(null);

  const resetTimerRef = useRef<() => void>(() => {});

  useEffect(() => {
    const clearAll = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      timeoutRef.current = null;
      intervalRef.current = null;
    };

    const handleIdleTimeout = async () => {
      clearAll();
      warningActiveRef.current = false;
      setWarningSecondsLeft(null);
      await logout();
      toast.error("You've been signed out after a period of inactivity.");
      router.push("/login");
    };

    const startWarning = () => {
      warningActiveRef.current = true;
      let seconds = WARNING_SECONDS;
      setWarningSecondsLeft(seconds);
      intervalRef.current = setInterval(() => {
        seconds -= 1;
        if (seconds <= 0) {
          handleIdleTimeout();
        } else {
          setWarningSecondsLeft(seconds);
        }
      }, 1000);
    };

    const resetTimer = () => {
      // Once the warning modal is up, only the explicit "Stay signed in" action (which
      // calls this same function) should restart the clock - see the guard's own caller.
      if (warningActiveRef.current) return;
      clearAll();
      const minutes = getUserDetail()?.idleTimeoutMinutes;
      if (!minutes || minutes <= 0) return;
      const totalMs = minutes * 60 * 1000;
      const warningMs = Math.min(WARNING_SECONDS * 1000, totalMs);
      timeoutRef.current = setTimeout(startWarning, totalMs - warningMs);
    };
    resetTimerRef.current = resetTimer;

    resetTimer();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    // If an admin changes the idle timeout in Settings mid-session, their own tab picks up
    // the new duration immediately instead of waiting for a reload/re-login.
    const unsubscribe = onUserDetailChange(resetTimer);

    return () => {
      clearAll();
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stayLoggedIn = () => {
    warningActiveRef.current = false;
    setWarningSecondsLeft(null);
    resetTimerRef.current();
  };

  return { warningSecondsLeft, stayLoggedIn };
}
