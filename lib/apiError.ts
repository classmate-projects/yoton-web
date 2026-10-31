import axios from "axios";

// The API's own message for a failed request (its { message } body), or the fallback when
// there isn't one - network error, timeout, or a non-HTTP failure.
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) return error.response?.data?.message || fallback;
  return fallback;
}
