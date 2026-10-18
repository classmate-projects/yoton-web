import axios from "axios";
import { startApiRequest, endApiRequest } from "./apiLoading";
import { reportServerReachable, reportServerUnreachable } from "./connectionStatus";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// The access token is short-lived by design (Jwt:AccessTokenMinutes on the API), so a 401
// from an expired-but-otherwise-valid session is the expected common case, not an error -
// this silently exchanges it for a new one via the refresh token cookie (see
// app/api/auth/refresh/route.ts) and retries, instead of bouncing the user to /login every
// time the token ages out mid-session. Concurrent requests that 401 at the same moment
// share a single in-flight refresh call rather than each racing to rotate the same refresh
// token (the API only accepts a refresh token once - see RefreshTokenService.RotateAsync).
let isRefreshing = false;
let isRedirectingToLogin = false;
let refreshWaiters: Array<(token: string | null) => void> = [];

function onRefreshed(token: string | null) {
  refreshWaiters.forEach((resolve) => resolve(token));
  refreshWaiters = [];
}

// Exported for useProactiveTokenRefresh - lib/chatSignalR.ts's accessTokenFactory only reads
// localStorage lazily when a connection/reconnect actually happens, so nothing otherwise
// notices the access token going stale while a WebSocket stays open for longer than its
// lifetime. This lets that hook keep the stored token fresh on its own timer.
export async function refreshAccessToken(): Promise<string | null> {
  if (isRefreshing) {
    return new Promise((resolve) => refreshWaiters.push(resolve));
  }

  isRefreshing = true;
  try {
    const res = await fetch("/api/auth/refresh", { method: "POST" });
    if (!res.ok) {
      onRefreshed(null);
      return null;
    }

    const data = await res.json();
    const token = data.token as string;
    localStorage.setItem("yoton_token", token);
    onRefreshed(token);
    return token;
  } catch {
    onRefreshed(null);
    return null;
  } finally {
    isRefreshing = false;
  }
}

api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("yoton_token");

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      startApiRequest();
    }

    return config;
  },
  (error) => {
    if (typeof window !== "undefined") endApiRequest();
    return Promise.reject(error);
  }
);

// A 401 here usually just means the short-lived access token has aged out - try exchanging
// it for a new one via the refresh token cookie and retrying, exactly once per request. Only
// once that also fails (refresh token itself expired/revoked, or there never was one) is this
// treated as truly stale auth state that a retry can't fix: clear it and bounce to login. That
// path must also clear the httpOnly "token" cookie via /api/logout (same as the sidebar logout
// button): proxy.ts gates page navigation on that cookie, not localStorage, so if we only
// clear localStorage here, proxy.ts sees the still-present cookie and redirects straight back
// from /login to "/", looping forever.
api.interceptors.response.use(
  (response) => {
    if (typeof window !== "undefined") {
      endApiRequest();
      reportServerReachable();
    }
    return response;
  },
  async (error) => {
    if (typeof window !== "undefined") {
      endApiRequest();

      // Any HTTP answer at all means the server is up; no answer means it (or the network) isn't.
      if (error.response) reportServerReachable();
      else if (!axios.isCancel(error)) reportServerUnreachable();

      const originalRequest = error.config;

      // Once the redirect to /login is underway (or the pathname is already /login),
      // silently drop every subsequent 401 - window.location.pathname changes
      // asynchronously after window.location.href is set, so concurrent in-flight
      // requests would otherwise all pass the pathname check below, fall through to
      // Promise.reject, and log a spurious console error before navigation completes.
      if (error.response?.status === 401 && (isRedirectingToLogin || window.location.pathname === "/login")) {
        return new Promise(() => {});
      }

      if (
        error.response?.status === 401 &&
        window.location.pathname !== "/login" &&
        originalRequest &&
        !originalRequest._retry
      ) {
        originalRequest._retry = true;
        const newToken = await refreshAccessToken();

        if (newToken) {
          // api(originalRequest) re-enters the request interceptor above, which calls
          // startApiRequest() itself - this would double-count if it were called here too.
          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      }

      if (error.response?.status === 401 && window.location.pathname !== "/login") {
        isRedirectingToLogin = true;
        localStorage.removeItem("yoton_token");
        localStorage.removeItem("yoton_user_detail");
        await fetch("/api/logout", { method: "POST" });
        window.location.href = "/login";
        return new Promise(() => {});
      }
    }
    return Promise.reject(error);
  }
);

export default api;