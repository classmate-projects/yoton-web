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

  connectionPromise = (async () => {
    connection = new HubConnectionBuilder()
      .withUrl(`${baseUrl}/chat-hub`, {
        accessTokenFactory: () => localStorage.getItem("yoton_token") || "",
      })
      .withAutomaticReconnect()
      .build();

    await connection.start();

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
