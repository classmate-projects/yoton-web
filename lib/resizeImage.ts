// Profile photos come straight off phone cameras (often several MB at 3000px+) but are
// only ever shown at a few dozen px in this app - uploading the original wastes storage
// for no visible benefit. This downscales to a max dimension and re-encodes as JPEG
// client-side before the file ever reaches the network, so the saving applies to upload
// bandwidth too, not just server storage.
export async function resizeImageFile(
  file: File,
  { maxDimension = 512, quality = 0.85 }: { maxDimension?: number; quality?: number } = {}
): Promise<File> {
  // A canvas round-trip would drop GIF animation and rasterize SVG's whole point (infinite
  // scalability) - upload those as-is rather than "fixing" them into something worse.
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file; // Unsupported/corrupt image - let the server's own validation handle it.

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );

  // Never ship something bigger than what the user picked (a already-small/optimized image
  // re-encoded at a fixed quality can occasionally grow slightly).
  if (!blob || blob.size >= file.size) return file;

  const baseName = file.name.replace(/\.\w+$/, "") || "avatar";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
}

// ─── Universal upload compression ────────────────────────────────────────────
// Applied to every upload flow (avatars, logos, clinical photos, documents).
// Non-image files (PDF, xlsx, etc.) pass through unchanged.
// Images already ≤120 KB are returned as-is — no point degrading quality for zero gain.
// Images >120 KB are re-encoded as JPEG (white background fills any transparency) via a
// binary search over quality values until the result lands in the 80–120 KB window or
// 8 iterations are exhausted.
const COMPRESS_TARGET = 100 * 1024; // aim for centre of target window
const COMPRESS_MAX    = 120 * 1024;
const COMPRESS_MAXDIM = 1920;       // longest side cap — keeps clinical photos readable

export async function compressImageForUpload(
  file: File,
  maxDimension = COMPRESS_MAXDIM,
): Promise<File> {
  if (typeof window === "undefined") return file;
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= COMPRESS_MAX) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width  * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width  = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) { bitmap.close(); return file; }

  // White fill handles PNG/WebP transparency before JPEG conversion.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const toBlob = (q: number): Promise<Blob | null> =>
    new Promise((res) => canvas.toBlob(res, "image/jpeg", q));

  let lo = 0.1, hi = 0.92, q = 0.75, best: Blob | null = null;
  for (let i = 0; i < 8; i++) {
    const blob = await toBlob(q);
    if (!blob) break;
    if (blob.size <= COMPRESS_MAX) best = blob;
    if (Math.abs(blob.size - COMPRESS_TARGET) < 4 * 1024) break;
    if (blob.size > COMPRESS_TARGET) { hi = q; q = (lo + q) / 2; }
    else                             { lo = q; q = (q + hi) / 2; }
  }

  const out = best ?? (await toBlob(0.6));
  if (!out || out.size >= file.size) return file;

  const name = file.name.replace(/\.[^.]+$/, ".jpg");
  return new File([out], name, { type: "image/jpeg", lastModified: Date.now() });
}
