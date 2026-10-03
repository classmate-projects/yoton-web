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
