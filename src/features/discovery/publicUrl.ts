/**
 * Absolute public URL for ShareButton (REG-51, E3).
 *
 * The origin is NEXT_PUBLIC_SITE_ORIGIN (docs/08-deployment/BETK_CONFIGURATION.md).
 * The path is a public route helper (routes.listing / routes.store, locale prefix
 * from the page param). This module does not read request headers and does not
 * build an auth, account, inbox, seller, admin, cart, or checkout URL.
 */

import { routes, withLocale } from "@/constants/routes";
import type { AppLocale } from "@/i18n/routing";

function siteOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_ORIGIN;
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  return url.origin;
}

function absolutePublicPath(path: string): string | null {
  const origin = siteOrigin();
  if (!origin) return null;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return `${origin}${path}`;
}

/** P04. `/listing/[id]` or `/en/listing/[id]`. */
export function publicListingShareUrl(listingId: string, locale: AppLocale): string | null {
  return absolutePublicPath(withLocale(routes.listing(listingId), locale));
}

/** P05. `/store/[slug]` or `/en/store/[slug]`. */
export function publicStoreShareUrl(slug: string, locale: AppLocale): string | null {
  return absolutePublicPath(withLocale(routes.store(slug), locale));
}
