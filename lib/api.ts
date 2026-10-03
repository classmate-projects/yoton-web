const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

// Used when the API's response has no message of its own - e.g. a rate-limit rejection or a
// gateway error can come back with an empty or non-JSON body.
const FALLBACK_MESSAGES: Record<number, string> = {
  429: "Too many attempts. Please wait a few minutes and try again.",
  502: "The server is temporarily unavailable. Please try again in a moment.",
  503: "The server is temporarily unavailable. Please try again in a moment.",
  504: "The server took too long to respond. Please try again in a moment.",
};

export async function apiFetch(endpoint: string, options?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${endpoint}`, options);
  } catch {
    throw {
      status: 503,
      body: { message: "Couldn't reach the server. Please try again in a moment." },
    };
  }

  // Read as text first: an empty or non-JSON body must not turn into an unreadable parse
  // error for whoever is signing in.
  const text = await res.text();
  // Callers read arbitrary fields off body (data.body.token, ...), same as when this was res.json().
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const body = data && typeof data === "object" ? data : {};
    throw {
      status: res.status,
      body: {
        message: FALLBACK_MESSAGES[res.status] ?? `Request failed (${res.status})`,
        ...body,
      },
    };
  }

  return {
    status: res.status,
    body: data,
  };
}
