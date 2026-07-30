import { useEffect, useRef } from "react";
import { getSignalRConnection } from "@/lib/signalR";

// Generic real-time hook: re-runs `refetch` whenever any of `events` fires on
// the shared SignalR connection. For pages that already own a fetch function,
// this is simpler than hand-splicing partial event payloads into local state
// (see hooks/useRoleSignalR.ts for that alternative pattern).
export function useSignalRRefetch(events: string[], refetch: () => void) {
  // Always call the latest refetch without re-subscribing when its identity
  // changes across renders (it's typically a new inline function each time).
  // Updated in an effect (not during render) per react-hooks/refs.
  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  });

  const eventsKey = events.join(",");

  useEffect(() => {
    let isMounted = true;
    const eventList = eventsKey ? eventsKey.split(",") : [];
    const handler = () => refetchRef.current();

    const connect = async () => {
      const connection = await getSignalRConnection();
      if (!isMounted) return;

      // Prevent duplicate subscriptions across remounts on the shared connection.
      eventList.forEach((event) => {
        connection.off(event, handler);
        connection.on(event, handler);
      });
    };

    connect();

    return () => {
      isMounted = false;
      getSignalRConnection().then((connection) => {
        eventList.forEach((event) => connection.off(event, handler));
      });
    };
  }, [eventsKey]);
}
