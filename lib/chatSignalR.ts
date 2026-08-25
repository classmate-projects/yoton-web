import { HubConnection, HubConnectionBuilder } from "@microsoft/signalr";
import { baseUrl } from "./constants";

let connection: HubConnection | null = null;
let connectionPromise: Promise<HubConnection> | null = null;

// Separate connection from lib/signalR.ts's `/notify` hub on purpose - that hub is
// unauthenticated and broadcasts to everyone, which is fine for "refetch your dashboard" but
// wrong for private chat delivery. `/chat-hub` requires a JWT; accessTokenFactory is
// SignalR's own mechanism for attaching it (sets the Authorization header on the initial
// negotiate call, then appends ?access_token= on the WebSocket upgrade, which is the only way
// a browser can authenticate that handshake - see Program.cs's OnMessageReceived).
export async function getChatConnection() {
  if (connectionPromise) return connectionPromise;

  // accessTokenFactory below reads the token lazily on every negotiate/reconnect
  // attempt, which is normally fine - but if logout() has already cleared it (see
  // lib/auth.ts) while a connect was in flight, letting this proceed sends an empty
  // token to the server and comes back as a real, noisy 401 instead of the quiet
  // "there's nothing to connect with" case this actually is.
  if (!localStorage.getItem("yoton_token")) {
    throw new Error("No auth token available - not starting chat connection");
  }

  connectionPromise = (async () => {
    connection = new HubConnectionBuilder()
      .withUrl(`${baseUrl}/chat-hub`, {
        accessTokenFactory: () => localStorage.getItem("yoton_token") || "",
      })
      .withAutomaticReconnect()
      .build();

    try {
      await connection.start();
    } catch (error) {
      // A failed first connection (e.g. a stale/expired token) would otherwise leave
      // connectionPromise permanently set to this rejected promise - every future call
      // returns the same rejection forever, even after a fresh login gets a valid token.
      // Clearing it here lets the next call actually retry instead of failing silently.
      connection = null;
      connectionPromise = null;
      throw error;
    }

    return connection;
  })();

  return connectionPromise;
}

// Called on logout so a stale connection (and its stale token) doesn't linger into the next
// login - getSignalRConnection's `/notify` counterpart doesn't need this since it never
// carries identity in the first place.
export async function stopChatConnection() {
  if (!connectionPromise) return;
  const activeConnection = await connectionPromise;
  await activeConnection.stop();
  connection = null;
  connectionPromise = null;
}
