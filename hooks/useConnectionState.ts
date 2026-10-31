"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ConnectionState, getConnectionState, subscribeConnectionState } from "@/lib/connectionStatus";

export function useConnectionState(): ConnectionState {
  return useSyncExternalStore(subscribeConnectionState, getConnectionState, () => "online");
}

const CONNECTION_TOAST_ID = "connection-state";

// One non-blocking notice that follows the connection: stays up while offline or while the
// server can't be reached (nothing typed in the meantime can be saved), and turns into a brief
// "back online" once it recovers. Mounted once, in the signed-in layout.
export function useConnectionAlerts() {
  const state = useConnectionState();
  const previous = useRef<ConnectionState>("online");

  useEffect(() => {
    const was = previous.current;
    previous.current = state;
    if (state === was) return;

    if (state === "offline") {
      toast.warning("You're offline", {
        id: CONNECTION_TOAST_ID,
        description: "Changes can't be saved until your internet connection is back - keep this page open.",
        duration: Infinity,
      });
    } else if (state === "server-down") {
      toast.warning("Can't reach the server", {
        id: CONNECTION_TOAST_ID,
        description: "Changes may not be saved right now. Reconnecting automatically...",
        duration: Infinity,
      });
    } else {
      toast.success("Back online", { id: CONNECTION_TOAST_ID, description: "Saving has resumed.", duration: 3000 });
    }
  }, [state]);
}
