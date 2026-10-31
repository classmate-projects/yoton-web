export type SaveStatusKind = "saving" | "saved" | "error" | "slow";

const EVENT = "yoton:save-status";

interface SaveStatusDetail {
  status: SaveStatusKind;
  // Why a save failed (or is slow) - shown by the header indicator.
  message?: string;
}

export function notifySaveStatus(status: SaveStatusKind, message?: string) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent<SaveStatusDetail>(EVENT, { detail: { status, message } }));
}

export function onSaveStatus(cb: (status: SaveStatusKind, message?: string) => void) {
  const handler = (e: Event) => {
    const { status, message } = (e as CustomEvent<SaveStatusDetail>).detail;
    cb(status, message);
  };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
