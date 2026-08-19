"use client";

import { Clock } from "lucide-react";

interface SessionTimeoutModalProps {
  secondsLeft: number;
  onStayLoggedIn: () => void;
}

// Shown by useIdleLogout for the final 30 seconds of the idle window - centered, blocking,
// and requires the explicit "Stay signed in" click rather than dismissing on incidental
// activity, so a genuinely-away user's session actually ends on schedule.
export default function SessionTimeoutModal({ secondsLeft, onStayLoggedIn }: SessionTimeoutModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-md">
      <div className="bg-card w-full max-w-sm rounded-xl border border-border p-6 shadow-2xl mx-4 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
          <Clock size={22} className="text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Still there?</h2>
        <p className="text-sm text-muted-foreground mb-4">
          You&apos;ve been inactive for a while. For your security, you&apos;ll be signed out in
        </p>
        <p className="text-4xl font-bold text-amber-600 dark:text-amber-400 mb-5 tabular-nums">
          {secondsLeft}s
        </p>
        <button
          type="button"
          onClick={onStayLoggedIn}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 cursor-pointer"
        >
          Stay signed in
        </button>
      </div>
    </div>
  );
}
