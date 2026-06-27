import * as signalR from "@microsoft/signalr";
import { baseUrl } from "./constants";

let connection: signalR.HubConnection | null = null;

export const getSignalRConnection = async () => {
  if (connection?.state === signalR.HubConnectionState.Connected) {
    return connection;
  }

  connection = new signalR.HubConnectionBuilder()
    .withUrl(`${baseUrl}/notify`)
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Information)
    .build();

  await connection.start();

  console.log("SignalR Connected.");

  return connection;
};