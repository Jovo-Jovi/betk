/**
 * Locale-aware navigation APIs — OD-7.
 *
 * Thin wrappers around Next.js' navigation primitives that apply the routing
 * strategy (AR unprefixed, EN under /en) automatically. Prefer these over the
 * raw `next/link` / `next/navigation` equivalents for any INTERNAL app link so
 * the user's current locale is preserved across navigation.
 *
 *   import { Link, redirect, usePathname, useRouter, getPathname } from "@/i18n/navigation";
 *
 * Note (next-intl v4): the `redirect` returned here requires an explicit
 * `locale` — pass the current locale (via `getLocale()` server-side or
 * `useLocale()` client-side) even when you just want to stay on the same locale.
 */

import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
