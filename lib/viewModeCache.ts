import { getUserDetail } from "@/lib/userDetail";

export type ViewMode = "grid" | "list";

// Browser-local copy of each page's grid/list choice (see hooks/useViewModePreference.ts),
// namespaced by user id - several staff can share one browser, and one user's choice must
// never show up for the next person who signs in there. The server-side preference stays
// the source of truth; this only lets the page open in the right layout without a flash.
const PREFIX = "yoton_viewMode:";

// Earlier key formats ("<key>" and "<key>:<userId>", without PREFIX) - removed on the next
// login.
const LEGACY_KEY_STARTS = ["userManagement.viewMode", "patientRecords.viewMode"];

// No signed-in user id -> no cache, just the grid default until the server answers.
const cacheKey = (key: string) => {
  const userId = getUserDetail()?.userId;
  return userId ? `${PREFIX}${key}:${userId}` : null;
};

export function readCachedViewMode(key: string): ViewMode {
  const k = cacheKey(key);
  if (!k) return "grid";
  try {
    return localStorage.getItem(k) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

export function writeCachedViewMode(key: string, mode: ViewMode) {
  const k = cacheKey(key);
  if (!k) return;
  try {
    localStorage.setItem(k, mode);
  } catch {}
}

// Called right after a successful login: keeps the signing-in user's own cached choices
// (same person logging back in) and drops everyone else's, so nothing from a previous user
// lingers on a shared device.
export function clearOtherUsersViewModes(userId: string) {
  try {
    const ownSuffix = `:${userId}`;
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (
        (k.startsWith(PREFIX) && !k.endsWith(ownSuffix)) ||
        LEGACY_KEY_STARTS.some((legacy) => k.startsWith(legacy))
      ) {
        stale.push(k);
      }
    }
    stale.forEach((k) => localStorage.removeItem(k));
  } catch {}
}
