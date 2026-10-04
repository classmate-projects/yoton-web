"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { onSaveStatus, SaveStatusKind } from "@/lib/saveStatus";

type DisplayState = SaveStatusKind | "idle";

export default function AutoSaveIndicator() {
  const [state, setState] = useState<DisplayState>("idle");
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return onSaveStatus((status) => {
      if (dismissRef.current) clearTimeout(dismissRef.current);
      setState(status);
      if (status === "saved") {
        dismissRef.current = setTimeout(() => setState("idle"), 2500);
      }
    });
  }, []);

  const visible = state !== "idle";

  return (
    <div
      className={`flex items-center gap-1.5 text-xs transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"
      }`}
    >
      {state === "saving" && (
        <>
          <Loader2 size={12} className="animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Saving…</span>
        </>
      )}
      {state === "saved" && (
        <>
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500/15">
            <Check size={10} className="text-green-600 dark:text-green-400" strokeWidth={3} />
          </span>
          <span className="text-green-600 dark:text-green-400 font-medium">Saved</span>
        </>
      )}
      {state === "error" && (
        <span className="text-destructive">Save failed</span>
      )}
    </div>
  );
}
