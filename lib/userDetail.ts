import { CurrentUserDetail } from "@/types/user.type";
import { updateRecentAccountImage } from "@/lib/recentAccounts";

const KEY = "yoton_user_detail";
const EVENT = "yoton:user-detail-updated";

export function getUserDetail(): CurrentUserDetail | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

// Merges into the stored user detail (never overwrites fields the caller
// doesn't pass) and notifies any mounted listeners - the sidebar is already
// mounted when a photo/logo is uploaded from the settings page, so it can't
// pick up a plain localStorage write without this.
export function patchUserDetail(patch: Partial<CurrentUserDetail>) {
  const next = { ...(getUserDetail() ?? {}), ...patch } as CurrentUserDetail;
  localStorage.setItem(KEY, JSON.stringify(next));

  // Keep the login page's "recent accounts" shortcut (a separate localStorage snapshot
  // taken at login time) from showing a stale photo until the next full login.
  if ("userImage" in patch && next.userId) {
    updateRecentAccountImage(next.userId, patch.userImage);
  }

  window.dispatchEvent(new Event(EVENT));
  return next;
}

export function onUserDetailChange(callback: () => void) {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}
