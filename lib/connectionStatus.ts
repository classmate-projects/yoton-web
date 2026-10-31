import { baseUrl } from "./constants";

// Whether this browser can currently save anything: "offline" = no network at all,
// "server-down" = online but the API isn't answering. Fed by the browser's own online/offline
// events, every API response (lib/axios.ts) and the live SignalR link (lib/signalR.ts), so it
// notices trouble even while nobody is saving.
export type ConnectionState = "online" | "offline" | "server-down";

const PROBE_INTERVAL_MS = 10_000;

let state: ConnectionState = typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "online";
const listeners = new Set<() => void>();
let probeTimer: ReturnType<typeof setInterval> | null = null;

function setState(next: ConnectionState) {
  if (next === state) return;
  state = next;
  if (next === "server-down") startProbing();
  else stopProbing();
  listeners.forEach((listener) => listener());
}

// While the API looks down, check every few seconds whether it's back rather than waiting for
// the next real request to find out.
function startProbing() {
  if (probeTimer || typeof window === "undefined") return;
  probeTimer = setInterval(async () => {
    try {
      const res = await fetch(`${baseUrl}/`, { cache: "no-store" });
      if (res.ok) reportServerReachable();
    } catch {
      // still down
    }
  }, PROBE_INTERVAL_MS);
}

function stopProbing() {
  if (probeTimer) clearInterval(probeTimer);
  probeTimer = null;
}

export function getConnectionState(): ConnectionState {
  return state;
}

export function subscribeConnectionState(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function reportServerReachable() {
  if (typeof navigator === "undefined" || navigator.onLine) setState("online");
}

export function reportServerUnreachable() {
  setState(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "server-down");
}

if (typeof window !== "undefined") {
  window.addEventListener("offline", () => setState("offline"));
  window.addEventListener("online", () => setState("online"));
}
