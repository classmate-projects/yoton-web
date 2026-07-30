import axios from "axios";

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
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// A 401 here means the bearer token is missing/expired/invalid — stale local
// auth state that a retry can't fix. Clear it and bounce to login. This must
// also clear the httpOnly "token" cookie via /api/logout (same as the sidebar
// logout button): proxy.ts gates page navigation on that cookie, not
// localStorage, and its Max-Age outlives the JWT's own expiry — so if we only
// clear localStorage here, proxy.ts sees the still-present cookie and
// redirects straight back from /login to "/", looping forever.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (typeof window !== "undefined" && error.response?.status === 401 && window.location.pathname !== "/login") {
      localStorage.removeItem("yoton_token");
      localStorage.removeItem("yoton_user_detail");
      await fetch("/api/logout", { method: "POST" });
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;