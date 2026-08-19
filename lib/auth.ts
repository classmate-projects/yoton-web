import { stopChatConnection } from "@/lib/chatSignalR";

// Single place for "sign this browser out" - used by the sidebar's own Logout button and
// by useIdleLogout (hooks/useIdleLogout.ts) so both go through the exact same steps
// instead of two copies drifting apart.
export async function logout() {
  await fetch("/api/logout", { method: "POST" });
  await stopChatConnection();
  localStorage.removeItem("yoton_token");
  localStorage.removeItem("yoton_user_detail");
}
