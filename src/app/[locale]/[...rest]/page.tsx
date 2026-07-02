import { notFound } from "next/navigation";

/**
 * Catch-all 404 (OD-7). With `localePrefix: 'as-needed'`, an unrecognized locale
 * prefix (e.g. `/fr/...`, `/de`) is treated as default-locale content and lands
 * here as an unmatched pathname — so this guarantees "bad locale → 404" as well
 * as a proper 404 for any unknown path within a valid locale. Renders the
 * locale's not-found UI (this segment is inside the [locale] layout).
 */
export default function CatchAllNotFound() {
  notFound();
}
