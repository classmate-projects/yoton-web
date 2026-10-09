"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { logout } from "@/lib/auth";
import { getUserDetail, onUserDetailChange } from "@/lib/userDetail";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"] as const;
const WARNING_SECONDS = 30;

// Company-wide, admin-configured (Settings > Company settings) - one value for every
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
  // Tracks the real wall-clock time of the last user activity so every check can compute
  // actual elapsed time via Date.now() instead of relying on setTimeout/setInterval tick
  // counts, which Chrome throttles heavily in background/hidden tabs.
  const lastActivityTimeRef = useRef<number>(Date.now());
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

    const getRemainingSeconds = () => {
      const minutes = getUserDetail()?.idleTimeoutMinutes;
      if (!minutes || minutes <= 0) return 0;
      const totalMs = minutes * 60 * 1000;
      return Math.ceil((totalMs - (Date.now() - lastActivityTimeRef.current)) / 1000);
    };

    const startWarning = () => {
      const remainingSeconds = getRemainingSeconds();

      // If the computer slept or the tab was backgrounded long enough that the full
      // idle window has already elapsed, log out immediately instead of showing a
      // stale 30-second countdown — the user was actually away for longer than allowed.
      if (remainingSeconds <= 0) {
        handleIdleTimeout();
        return;
      }

      warningActiveRef.current = true;
      // Clamp to WARNING_SECONDS in case of minor drift; base it on real elapsed time
      // not on a fixed constant so the initial display is always accurate.
      setWarningSecondsLeft(Math.min(WARNING_SECONDS, remainingSeconds));

      intervalRef.current = setInterval(() => {
        // Re-derive from wall clock each tick so Chrome's background-tab throttling
        // (which fires intervals less frequently) can't cause the displayed countdown
        // to drift from reality.
        const secs = getRemainingSeconds();
        if (secs <= 0) {
          handleIdleTimeout();
        } else {
          setWarningSecondsLeft(Math.min(WARNING_SECONDS, secs));
        }
      }, 1000);
    };

    const resetTimer = () => {
      // Once the warning modal is up, only the explicit "Stay signed in" action (which
      // calls this same function) should restart the clock - see the guard's own caller.
      if (warningActiveRef.current) return;
      lastActivityTimeRef.current = Date.now();
      clearAll();
      const minutes = getUserDetail()?.idleTimeoutMinutes;
      if (!minutes || minutes <= 0) return;
      const totalMs = minutes * 60 * 1000;
      const warningMs = Math.min(WARNING_SECONDS * 1000, totalMs);
      timeoutRef.current = setTimeout(startWarning, totalMs - warningMs);
    };
    resetTimerRef.current = resetTimer;

    // When the tab becomes visible again (user switches back from another app/tab),
    // immediately recalculate remaining time rather than waiting for the next interval
    // tick. This ensures the displayed countdown is accurate on return and that a fully-
    // elapsed session is terminated immediately even if timers were throttled.
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (!warningActiveRef.current) return;
      const secs = getRemainingSeconds();
      if (secs <= 0) {
        handleIdleTimeout();
      } else {
        setWarningSecondsLeft(Math.min(WARNING_SECONDS, secs));
      }
    };

    resetTimer();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibilityChange);
    // If an admin changes the idle timeout in Settings mid-session, their own tab picks up
    // the new duration immediately instead of waiting for a reload/re-login.
    const unsubscribe = onUserDetailChange(resetTimer);

    return () => {
      clearAll();
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
