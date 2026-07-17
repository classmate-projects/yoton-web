import { HubConnection, HubConnectionBuilder } from "@microsoft/signalr";
import { baseUrl } from "./constants";

let connection: HubConnection | null = null;
let connectionPromise: Promise<HubConnection> | null = null;

export async function getSignalRConnection() {
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    connection = new HubConnectionBuilder()
      .withUrl(`${baseUrl}/notify`)
      .withAutomaticReconnect()
      .build();

    await connection.start();

    console.log("SignalR Connected.");

    return connection;
  })();

  return connectionPromise;
}