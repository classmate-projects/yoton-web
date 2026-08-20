import { stopChatConnection } from "@/lib/chatSignalR";

// Single place for "sign this browser out" - used by the sidebar's own Logout button and
// by useIdleLogout (hooks/useIdleLogout.ts) so both go through the exact same steps
// instead of two copies drifting apart.
//
// Local session state is cleared FIRST, synchronously, before either network call - the
// server-side cookie clear and stopChatConnection() (which awaits the chat SignalR
// connection's own promise) are both best-effort and can be slow or hang if that connection
// is mid-reconnect on a flaky network. Awaiting them before clearing localStorage used to
// mean a stuck chat connection could block the user from logging out at all.
export async function logout() {
  localStorage.removeItem("yoton_token");
  localStorage.removeItem("yoton_user_detail");

  fetch("/api/logout", { method: "POST" }).catch(() => {});
  stopChatConnection().catch(() => {});
}
