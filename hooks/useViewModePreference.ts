"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { UserPreferencesService } from "@/services/userPreferences.service";
import { readCachedViewMode, writeCachedViewMode, type ViewMode } from "@/lib/viewModeCache";

export type { ViewMode };

// Grid/list layout choice for a page, defaulting to grid. The source of truth is the
// signed-in user's own server-side preference (see UserPreferencesController), so it follows
// them to any device and never leaks to another user; the per-user localStorage copy (see
// lib/viewModeCache.ts) only lets this browser render their last-known layout immediately
// instead of flashing the grid while the server value loads. Pages under app/(pages) only
// render client-side after the layout's access check, so reading localStorage in the
// initializer can't cause a hydration mismatch.
export function useViewModePreference(key: string) {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => readCachedViewMode(key));
  // Set once the user clicks the toggle, so a slower initial GET can't overwrite that choice.
  const changedByUser = useRef(false);

  useEffect(() => {
    changedByUser.current = false;
    UserPreferencesService.get(key)
      .then((res) => {
        if (changedByUser.current) return;
        const mode: ViewMode = res.data === "list" ? "list" : "grid";
        setViewModeState(mode);
        writeCachedViewMode(key, mode);
      })
      .catch(() => {});
  }, [key]);

  const setViewMode = (mode: ViewMode) => {
    if (mode === viewMode) return;
    changedByUser.current = true;
    setViewModeState(mode);
    writeCachedViewMode(key, mode);
    UserPreferencesService.set(key, mode).catch(() => {
      toast.error("Couldn't save your view preference");
    });
  };

  return [viewMode, setViewMode] as const;
}
