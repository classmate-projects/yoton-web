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
  // Captured before clearing localStorage below - the .NET API call needs it in the
  // Authorization header (it's the only way that request is attributable to a user for the
  // audit log's "Logout" entry), and by design nothing here is awaited before the token is
  // gone from storage.
  const token = localStorage.getItem("yoton_token");

  localStorage.removeItem("yoton_token");
  localStorage.removeItem("yoton_user_detail");

  fetch("/api/logout", { method: "POST" }).catch(() => {});
  if (token) {
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  stopChatConnection().catch(() => {});
}
