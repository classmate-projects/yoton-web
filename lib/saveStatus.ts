export type SaveStatusKind = "saving" | "saved" | "error";

const EVENT = "yoton:save-status";

export function notifySaveStatus(status: SaveStatusKind) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(EVENT, { detail: status }));
}

export function onSaveStatus(cb: (status: SaveStatusKind) => void) {
  const handler = (e: Event) => cb((e as CustomEvent<SaveStatusKind>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
