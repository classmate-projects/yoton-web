const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";

// Backend-relative upload paths (e.g. "/Uploads/UserAvatars/x.png") need the
// backend's own origin prefixed - the Next.js app and the API run on different
// origins/ports, so a bare relative path resolves against the wrong one.
export function backendAssetUrl(path: string | null | undefined) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl}${path}`;
}
