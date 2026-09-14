// Registers the PWA service worker (public/sw.js) and shows real OS-level notifications
// through it for the app's existing SignalR-driven alerts (see useAlertCenter.tsx's
// pushAlert) - no Push API/VAPID here, this is purely "the tab is open and connected,
// surface what it just heard even if the user isn't looking at it right now".

export type NotificationPermissionState = "granted" | "denied" | "default" | "unsupported";

export function getNotificationPermissionState(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

// The browser's own Notification.permission has no JS-revocable "off" - once granted, only
// the user's own browser site-settings can undo it. So a same-app mute sits on top of that
// as a separate, ordinary app preference: it's what the bell's toggle button actually flips
// when permission is already "granted", and showAlertNotification below checks it before
// ever calling registration.showNotification.
const NOTIFICATIONS_MUTED_KEY = "yoton_notifications_muted";

export function areNotificationsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(NOTIFICATIONS_MUTED_KEY) !== "true";
}

export function setNotificationsEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOTIFICATIONS_MUTED_KEY, String(!enabled));
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {
    // Best-effort - a failed registration just means alerts fall back to the in-app
    // toast (see useAlertCenter.tsx), not a broken app.
  });
}

// Fires once per session, on the first alert a role that can see them receives -
// requesting it eagerly on every page load regardless of activity is what gets browsers
// to auto-deny future prompts, so this waits for a real reason to ask.
export async function ensureNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export async function showAlertNotification(title: string, body: string, navLink: string) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window)) return;
  if (Notification.permission !== "granted" || !areNotificationsEnabled()) return;

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(title, {
    body,
    icon: "/icon-192x192.png",
    badge: "/icon-192x192.png",
    tag: navLink,
    data: { navLink },
  });
}
