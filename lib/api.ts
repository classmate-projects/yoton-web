const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

export async function apiFetch(endpoint: string, options?: RequestInit) {
  const res = await fetch(`${baseUrl}${endpoint}`, options);

  const data = await res.json();

  if (!res.ok) {
    throw {
      status: res.status,
      body: data,
    };
  }

  return {
    status: res.status,
    body: data,
  };
}