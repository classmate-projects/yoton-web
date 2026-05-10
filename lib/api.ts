const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

export async function apiFetch(endpoint: string, options?: RequestInit) {
    const res = await fetch(`${baseUrl}${endpoint}`, options);

    if (!res.ok) {
        throw new Error(`API request failed with status ${res.status}`);
    }

    return res.json();
}