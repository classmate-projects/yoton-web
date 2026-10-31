"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { notifySaveStatus } from "@/lib/saveStatus";
import { describeSaveError } from "@/lib/saveError";

const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000];
const SLOW_SAVE_MS = 15_000;
// Shared by every auto-saving form, so several failing at once update one notice, not a pile.
const AUTOSAVE_TOAST_ID = "autosave";

interface AutoSaveOptions<T> {
  value: T;
  // False while nothing may be saved (no patient open, a locked/finished encounter, ...).
  enabled: boolean;
  save: (value: T) => Promise<unknown>;
  // What is being saved, for the notices - e.g. "encounter notes".
  label: string;
  delay?: number;
  // Holds off quietly while the value isn't valid to send yet (a required reason still empty...).
  canSave?: (value: T) => boolean;
}

export interface AutoSaveHandle<T> {
  // Saves any pending change straight away - call before a workflow action (Finish, End
  // Encounter...) or leaving the patient. Resolves false if it couldn't be saved.
  flush: () => Promise<boolean>;
  // The value just loaded from (or explicitly saved to) the server - nothing to auto-save.
  markSaved: (value: T) => void;
  isSaving: boolean;
}

// Saves `value` in the background `delay` ms after it stops changing, so routine entry needs no
// Save button. Keeps an eye on every save: one at a time (so an older save can never land after a
// newer one), a notice saying why if it fails, a "still saving" notice on a slow connection,
// automatic retries for connection/server trouble (and straight away once back online), and a
// last attempt when the page is left with changes still pending.
export function useAutoSave<T>({ value, enabled, save, label, delay = 1500, canSave }: AutoSaveOptions<T>): AutoSaveHandle<T> {
  const serialized = JSON.stringify(value);
  const savedRef = useRef(serialized);
  const latest = useRef({ value, serialized, enabled, save, label, canSave });
  const inFlight = useRef<Promise<boolean> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttempt = useRef(0);
  // runSave can't schedule its own retry by name inside its own definition.
  const runSaveRef = useRef<() => Promise<boolean>>(async () => true);
  const hadFailure = useRef(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    latest.current = { value, serialized, enabled, save, label, canSave };
  });

  const clearRetry = () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = null;
  };

  const runSave = useCallback(async (): Promise<boolean> => {
    // One save at a time - wait for the one underway, then save whatever changed since.
    while (inFlight.current) await inFlight.current;

    const current = latest.current;
    if (!current.enabled || current.serialized === savedRef.current) return true;
    if (current.canSave && !current.canSave(current.value)) return false;
    clearRetry();

    const attempt = (async () => {
      setIsSaving(true);
      notifySaveStatus("saving");
      let showedSlowNotice = false;
      const slowTimer = setTimeout(() => {
        showedSlowNotice = true;
        notifySaveStatus("slow", "The connection seems slow - still trying to save.");
        toast.warning(`Still saving ${current.label}...`, {
          id: AUTOSAVE_TOAST_ID,
          description: "The connection seems slow or unstable. Keep this page open until it's saved.",
        });
      }, SLOW_SAVE_MS);
      try {
        await current.save(current.value);
        savedRef.current = current.serialized;
        retryAttempt.current = 0;
        notifySaveStatus("saved");
        if (hadFailure.current) {
          hadFailure.current = false;
          toast.success("Changes saved", { id: AUTOSAVE_TOAST_ID, description: "Everything you entered is saved now." });
        } else if (showedSlowNotice) {
          toast.dismiss(AUTOSAVE_TOAST_ID);
        }
        return true;
      } catch (error) {
        const { reason, retryable } = describeSaveError(error);
        hadFailure.current = true;
        notifySaveStatus("error", reason);
        toast.error(`Couldn't save ${current.label}`, { id: AUTOSAVE_TOAST_ID, description: reason, duration: 10_000 });
        if (retryable) {
          const wait = RETRY_DELAYS_MS[Math.min(retryAttempt.current, RETRY_DELAYS_MS.length - 1)];
          retryAttempt.current++;
          retryTimer.current = setTimeout(() => void runSaveRef.current(), wait);
        }
        return false;
      } finally {
        clearTimeout(slowTimer);
        setIsSaving(false);
      }
    })();

    inFlight.current = attempt;
    try {
      return await attempt;
    } finally {
      if (inFlight.current === attempt) inFlight.current = null;
    }
  }, []);

  useEffect(() => {
    runSaveRef.current = runSave;
  }, [runSave]);

  // Debounced save after the last change.
  useEffect(() => {
    if (!enabled || serialized === savedRef.current) return;
    const timer = setTimeout(() => void runSave(), delay);
    return () => clearTimeout(timer);
  }, [serialized, enabled, delay, runSave]);

  // Back online - don't wait for the retry timer.
  useEffect(() => {
    const onOnline = () => {
      if (latest.current.serialized !== savedRef.current) void runSave();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [runSave]);

  // Warn before closing/refreshing the tab with changes not yet on the server, and make one
  // last attempt if the form goes away (navigating elsewhere in the app) with changes pending.
  useEffect(() => {
    const isDirty = () => latest.current.enabled && latest.current.serialized !== savedRef.current;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      clearRetry();
      if (isDirty()) void runSave();
    };
  }, [runSave]);

  const markSaved = useCallback((saved: T) => {
    savedRef.current = JSON.stringify(saved);
    clearRetry();
  }, []);

  return { flush: runSave, markSaved, isSaving };
}
