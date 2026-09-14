import { LogLevel, type ILogger } from "@microsoft/signalr";

// SignalR logs every dropped connection at Error level - including the ones
// withAutomaticReconnect() is about to silently recover from (a server timeout from a
// throttled background tab, or the dev API restarting). That's indistinguishable in the
// console from a real, unrecovered failure. Downgrade the known "about to reconnect" message
// to a warning so genuine problems (auth failures, a connection that gives up for good) still
// stand out as errors.
class ReconnectAwareLogger implements ILogger {
  log(logLevel: LogLevel, message: string) {
    if (logLevel === LogLevel.Error && message.startsWith("Connection disconnected with error")) {
      console.warn(`[SignalR] ${message} Reconnecting...`);
      return;
    }
    if (logLevel >= LogLevel.Warning) {
      const prefix = LogLevel[logLevel];
      (logLevel >= LogLevel.Error ? console.error : console.warn)(`[SignalR] ${prefix}: ${message}`);
    }
  }
}

export const signalRLogger = new ReconnectAwareLogger();
