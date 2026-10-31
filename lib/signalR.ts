import { HubConnection, HubConnectionBuilder } from "@microsoft/signalr";
import { baseUrl } from "./constants";
import { signalRLogger } from "./signalRLogger";
import { reportServerReachable, reportServerUnreachable } from "./connectionStatus";

let connection: HubConnection | null = null;
let connectionPromise: Promise<HubConnection> | null = null;

export async function getSignalRConnection() {
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    connection = new HubConnectionBuilder()
      .withUrl(`${baseUrl}/notify`)
      .withAutomaticReconnect()
      .configureLogging(signalRLogger)
      // Default 30s is too tight for a throttled background tab - Chrome/Edge slow down
      // timers on inactive tabs, which can delay the server's 15s keep-alive ping past the
      // client's timeout even though the socket is perfectly healthy. 60s gives that slack
      // without meaningfully delaying detection of an actually-dead connection.
      .withServerTimeout(60_000)
      .build();

    // The always-open link to the server - losing it is the earliest sign the server (or the
    // network) is gone, even while nothing is being saved.
    connection.onreconnecting(() => {
      console.warn("[SignalR] Reconnecting to /notify...");
      reportServerUnreachable();
    });
    connection.onreconnected(() => {
      console.info("[SignalR] Reconnected to /notify.");
      reportServerReachable();
    });
    connection.onclose((error) => {
      if (error) {
        console.error("[SignalR] /notify connection closed and gave up reconnecting:", error);
        reportServerUnreachable();
      }
      connection = null;
      connectionPromise = null;
    });

    try {
      await connection.start();
    } catch (error) {
      reportServerUnreachable();
      // Otherwise a failed first attempt (e.g. the API not up yet) caches this rejected
      // promise forever - every later call returns the same failure instead of retrying.
      connection = null;
      connectionPromise = null;
      throw error;
    }

    console.log("SignalR Connected.");
    reportServerReachable();

    return connection;
  })();

  return connectionPromise;
}