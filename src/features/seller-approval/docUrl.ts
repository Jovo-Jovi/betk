/** Short expiry for admin document previews. Stated in the P49 report. */
export const SIGNED_URL_EXPIRY_SECONDS = 60;

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);

/** Extension of a storage path. Query strings are ignored. Non-images return null. */
export function imageExtension(path: string): string | null {
  const clean = path.split("?")[0] ?? "";
  const ext = clean.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.has(ext) ? ext : null;
}
