import axios from "axios";
import { startApiRequest, endApiRequest } from "./apiLoading";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

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

// A 401 here means the bearer token is missing/expired/invalid — stale local
// auth state that a retry can't fix. Clear it and bounce to login. This must
// also clear the httpOnly "token" cookie via /api/logout (same as the sidebar
// logout button): proxy.ts gates page navigation on that cookie, not
// localStorage, and its Max-Age outlives the JWT's own expiry — so if we only
// clear localStorage here, proxy.ts sees the still-present cookie and
// redirects straight back from /login to "/", looping forever.
api.interceptors.response.use(
  (response) => {
    if (typeof window !== "undefined") endApiRequest();
    return response;
  },
  async (error) => {
    if (typeof window !== "undefined") {
      endApiRequest();
      if (error.response?.status === 401 && window.location.pathname !== "/login") {
        localStorage.removeItem("yoton_token");
        localStorage.removeItem("yoton_user_detail");
        await fetch("/api/logout", { method: "POST" });
        window.location.href = "/login";
        // A hard redirect is already underway - never resolve/reject back to the
        // caller. Every page's own catch block would otherwise still run in the
        // brief window before navigation actually tears the app down, logging a
        // scary (but meaningless) "Request failed with status code 401" to the
        // console/Next.js error overlay for something that isn't actually a bug -
        // this is expected on every logout (in-flight or SignalR-triggered
        // refetches losing their token) and the interceptor above already deals
        // with it in full.
        return new Promise(() => {});
      }
    }
    return Promise.reject(error);
  }
);

export default api;