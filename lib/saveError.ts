import axios from "axios";

export interface SaveFailure {
  // Plain-language cause, shown to the user.
  reason: string;
  // Worth trying again by itself (connection/server trouble), as opposed to a rejected change.
  retryable: boolean;
}

// Turns a failed save into something the user can act on - offline, a flaky connection, the
// server being down, or the server refusing the change - instead of a bare "save failed".
export function describeSaveError(error: unknown): SaveFailure {
  if (typeof navigator !== "undefined" && !navigator.onLine)
    return { reason: "You're offline. Your changes will be saved as soon as the connection is back.", retryable: true };

  if (!axios.isAxiosError(error))
    return { reason: "Something went wrong while saving. Trying again shortly.", retryable: true };

  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT")
    return { reason: "The server took too long to respond - the connection may be unstable. Trying again automatically.", retryable: true };

  const status = error.response?.status;
  if (!status)
    return { reason: "Couldn't reach the server - check your network connection. Trying again automatically.", retryable: true };

  const serverMessage = (error.response?.data as { message?: string } | undefined)?.message;
  if (status === 401) return { reason: "Your session has expired. Sign in again to keep saving.", retryable: false };
  if (status === 403) return { reason: serverMessage ?? "You don't have permission to make this change.", retryable: false };
  if (status === 429) return { reason: "The server is busy. Trying again in a moment.", retryable: true };
  if (status >= 500)
    return { reason: `The server is unavailable right now (error ${status}). Trying again automatically.`, retryable: true };
  return { reason: serverMessage ?? `The server didn't accept the change (error ${status}).`, retryable: false };
}
