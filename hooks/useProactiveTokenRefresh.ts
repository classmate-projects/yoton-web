"use client";

import { useEffect } from "react";
import { refreshAccessToken } from "@/lib/axios";

// Comfortably inside the API's Jwt:AccessTokenMinutes (30) window, so a tick always finds a
// still-valid token to trade in rather than racing its expiry.
const REFRESH_INTERVAL_MS = 20 * 60 * 1000;

// lib/chatSignalR.ts's accessTokenFactory (and getSignalRConnection's own hub) only reads
// the stored access token lazily, at connect/reconnect time - a healthy WebSocket has no
// reason to reconnect, so nothing else ever notices the token going stale underneath it.
// If that socket then drops (network blip, laptop sleep) after the token has aged past its
// lifetime, automatic reconnection hands the server an already-expired token with no way to
// recover on its own. Running independently of any REST call keeps the stored token fresh
// so a reconnect always has something valid to send.
export function useProactiveTokenRefresh() {
  useEffect(() => {
    const interval = setInterval(() => {
      if (localStorage.getItem("yoton_token")) {
        refreshAccessToken();
      }
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);
}
