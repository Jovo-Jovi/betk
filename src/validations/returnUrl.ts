/**
 * returnUrl open-redirect guard — shared validator.
 *
 * Accepts only same-origin relative paths that start with a single '/' and do
 * NOT resemble a full URL (scheme, authority, or protocol-relative).
 *
 * Rejection cases (all fall back to '/'):
 *   - starts with '//' → protocol-relative URL (can route off-origin)
 *   - starts with 'http://' or 'https://' → absolute URL
 *   - contains '\' → browsers (IE, legacy Chrome) treat /\ as // (protocol-relative)
 *   - contains control chars or whitespace other than a plain space → header injection
 *   - any other non-'/' prefix → not a path
 *   - empty string or missing → safe default
 *
 * Usage:
 *   import { sanitizeReturnUrl } from "@/validations/returnUrl"
 *   const safe = sanitizeReturnUrl(searchParams.get("returnUrl"))
 */

/** The fallback applied when returnUrl is absent or unsafe. */
export const RETURN_URL_FALLBACK = "/";

/**
 * Sanitise a candidate returnUrl string.
 *
 * Returns the original value when it is safe (starts with exactly one '/'
 * and passes all open-redirect checks). Returns '/' otherwise.
 */
export function sanitizeReturnUrl(candidate: string | null | undefined): string {
  if (!candidate) return RETURN_URL_FALLBACK;

  // Reject backslash: browsers treat /\ as // (protocol-relative redirect).
  if (candidate.includes("\\")) return RETURN_URL_FALLBACK;

  // Reject control characters (0x00–0x1F) and common header-injection chars
  // (\r, \n, \t). A plain space is technically allowed in a path but is a smell;
  // reject all ASCII control chars to be safe.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F]/.test(candidate)) return RETURN_URL_FALLBACK;

  // Reject protocol-relative ('//...'), absolute URLs, or any non-path.
  if (
    candidate.startsWith("//") ||
    /^https?:\/\//i.test(candidate) ||
    !candidate.startsWith("/")
  ) {
    return RETURN_URL_FALLBACK;
  }

  return candidate;
}

/**
 * Returns true when candidate is a safe local path.
 * Useful for conditional rendering (e.g. rendering a "back" link).
 */
export function isLocalPath(candidate: string | null | undefined): boolean {
  return sanitizeReturnUrl(candidate) !== RETURN_URL_FALLBACK || candidate === "/";
}
