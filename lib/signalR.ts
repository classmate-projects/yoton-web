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

    try {
      await connection.start();
    } catch (error) {
      // Otherwise a failed first attempt (e.g. the API not up yet) caches this rejected
      // promise forever - every later call returns the same failure instead of retrying.
      connection = null;
      connectionPromise = null;
      throw error;
    }

    console.log("SignalR Connected.");

    return connection;
  })();

  return connectionPromise;
}