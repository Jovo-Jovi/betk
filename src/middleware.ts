import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import type { Database } from "@/lib/supabase/types";
import { sanitizeReturnUrl } from "@/validations/returnUrl";
import { routing } from "@/i18n/routing";

/**
 * BETK auth middleware — locale negotiation (OD-7) + route-group gates + session
 * refresh.
 * Spec: BETK_ARCHITECTURE.md §4 · ADR-011 (i18n, see ADR.md) · BETK_UI_SPEC.md §2 ·
 *       SESSION_CONTEXT (R-A05, R-S04, OD-4).
 *
 * Responsibilities:
 *  1. Locale (OD-7): next-intl negotiates the locale (ar default/unprefixed, en
 *     under /en) and sets the NEXT_LOCALE cookie + rewrite. This runs FIRST.
 *  2. Refresh the Supabase Auth session on every matched request.
 *  3. Gate route groups on the LOCALE-STRIPPED path: (public) open · (buyer)
 *     auth required · (seller)/seller role=seller · (admin)/admin is_admin().
 *  4. R-A05 block: authenticated users with status != 'active' OR deleted_at
 *     != NULL → /blocked (locale-preserving).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * SECURITY — LOCALE IS NORMALIZED BEFORE GATE EVALUATION (OD-7 invariant).
 *
 * `splitLocale()` strips any `/en` prefix (ar has none) BEFORE `gateFor()` runs,
 * so a route's gate is evaluated on the exact same path regardless of locale.
 * Therefore every prior (pre-OD-7) gate verdict is provably UNCHANGED — each
 * matcher yields the identical Gate for the AR and EN URL:
 *
 *   URL (AR)        URL (EN)            stripped path   gateFor() → verdict
 *   /               /en                 /               public   (unchanged)
 *   /search         /en/search          /search         public   (unchanged)
 *   /listing/x      /en/listing/x       /listing/x      public   (unchanged)
 *   /auth/login     /en/auth/login      /auth/login     public   (unchanged)
 *   /blocked        /en/blocked         /blocked        public   (unchanged)
 *   /account        /en/account         /account        buyer    (unchanged)
 *   /orders         /en/orders          /orders         buyer    (unchanged)
 *   /wishlist,/inbox,/notifications,/checkout,/disputes  → buyer  (unchanged)
 *   /seller         /en/seller          /seller         seller   (unchanged)
 *   /seller/status  /en/seller/status   /seller/status  seller   (unchanged, R-S04 loop-safe)
 *   /seller/onboarding /en/seller/onboarding /seller/onboarding seller-gate → AUTH-ONLY (Phase 04 T02)
 *   /admin          /en/admin           /admin          admin    (unchanged)
 *
 * Phase 04 T02: /seller/onboarding is matched by the seller gate (the /seller/*
 * prefix) but treated as AUTHENTICATION-ONLY inside that branch — any active
 * authenticated user (buyer included) may reach it; an existing seller is
 * redirected per status (active → /seller, else → /seller/status). Every OTHER
 * /seller* verdict is byte-unchanged; only the onboarding rows differ.
 *
 * Redirect targets (login / blocked / role-mismatch / seller-status) are re-
 * localized to the SAME normalized locale, so a gate never drops the user out of
 * their locale and never changes WHO is allowed through.
 *
 * The security boundary is RLS in Postgres (BETK_ERD §3); this gate is a UX
 * convenience + defence-in-depth. Server Actions re-check role/ownership.
 *
 * TODO(OD-4 / Phase 04·07·13): the verified-phone transaction gate
 * (`users.phone_number IS NOT NULL`) is NOT enforced here — it lives in the
 * checkout / become-seller / payout Server Actions + RLS WITH CHECK.
 */

const LOGIN_ROUTE = "/auth/login";

// Buyer (protected) prefixes — any authenticated user (BETK_UI_SPEC §2 "protected").
const BUYER_PREFIXES = [
  "/account",
  "/wishlist",
  "/orders",
  "/inbox",
  "/notifications",
  "/checkout",
  "/disputes",
];

const SELLER_PREFIX = "/seller";
const ADMIN_PREFIX = "/admin";

// Seller landing for pending/rejected/suspended sellers (R-S04) — must be
// reachable while the seller's profile is not yet active.
const SELLER_STATUS_ROUTE = "/seller/status";

// Seller onboarding entry (Phase 04) — AUTHENTICATION-ONLY, not role=seller.
// BETK_UI_SPEC §3: "protected (becomes role: seller on submit)". Any active
// authenticated user (typically a buyer) may reach it; an existing seller is
// bounced out per status (see the gate === "seller" branch below).
const SELLER_ONBOARDING_ROUTE = "/seller/onboarding";

type Gate = "public" | "buyer" | "seller" | "admin";

/**
 * Gate for a LOCALE-STRIPPED pathname. UNCHANGED from the pre-OD-7 logic —
 * callers must pass the path with any `/en` prefix already removed.
 */
function gateFor(pathname: string): Gate {
  if (pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`)) {
    return "admin";
  }
  if (pathname === SELLER_PREFIX || pathname.startsWith(`${SELLER_PREFIX}/`)) {
    return "seller";
  }
  if (
    BUYER_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return "buyer";
  }
  // Homepage ("/"), public catalogue routes, /auth, /blocked → public.
  return "public";
}

/**
 * Split the locale prefix from a pathname (OD-7). The default locale (ar) is
 * unprefixed; only non-default locales (en) carry a `/<locale>` prefix.
 * Returns the normalized locale + the path with the prefix removed (always
 * leading-slash). This is what makes gates locale-invariant.
 */
function splitLocale(pathname: string): { locale: string; path: string } {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue; // ar is unprefixed
    if (pathname === `/${locale}`) return { locale, path: "/" };
    if (pathname.startsWith(`/${locale}/`)) {
      return { locale, path: pathname.slice(locale.length + 1) };
    }
  }
  return { locale: routing.defaultLocale, path: pathname };
}

/** Re-apply the locale prefix to a stripped path for a redirect target. */
function localize(locale: string, path: string): string {
  if (locale === routing.defaultLocale) return path; // ar → unprefixed
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/**
 * PERF-02 — Supabase auth-cookie name prefix, DERIVED from the configured
 * project URL (never hardcode the ref). `@supabase/ssr` stores the session as
 * `sb-<project-ref>-auth-token` (chunked variants append `.0`/`.1`/…, and the
 * PKCE flow adds `sb-<project-ref>-auth-token-code-verifier`) — all share this
 * prefix. A missing/malformed URL degrades to the broad `sb-` prefix, which can
 * only OVER-match (→ never wrongly skips getUser), so the fast-path stays safe.
 */
const SUPABASE_AUTH_COOKIE_PREFIX = ((): string => {
  try {
    const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
    return ref ? `sb-${ref}-auth-token` : "sb-";
  } catch {
    return "sb-";
  }
})();

/**
 * True iff the request carries at least one Supabase auth cookie. When FALSE
 * the caller is provably a guest (no session to refresh) and the getUser()
 * GoTrue round-trip can be skipped. A present-but-invalid cookie returns TRUE
 * here so it still flows through getUser() and fails closed.
 */
function requestHasAuthCookies(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((c) => c.name.startsWith(SUPABASE_AUTH_COOKIE_PREFIX));
}

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Locale negotiation FIRST (OD-7) ────────────────────────────────────
  // next-intl sets the NEXT_LOCALE cookie + rewrites the request to the internal
  // localized path. We keep its response and attach refreshed auth cookies to it
  // (do NOT recreate the response, or the locale rewrite/cookie would be lost).
  const response = intlMiddleware(request);

  // ── 2. Normalize locale BEFORE gating (security invariant) ─────────────────
  // Done before any auth work so the guest fast-path below shares the exact
  // same gate verdict the full path would compute.
  const { locale, path } = splitLocale(pathname);
  const gate = gateFor(path);

  // ── 3. GUEST FAST-PATH (PERF-02) ───────────────────────────────────────────
  // No Supabase auth cookie → the caller is provably a guest: there is no
  // session to refresh, so skip the getUser() GoTrue network hop AND the DB
  // profile read entirely. Verdicts are IDENTICAL to the full path's guest
  // outcome:
  //   • public route → pass (keep the locale rewrite/cookie response)
  //   • protected    → /auth/login?returnUrl=… (locale-preserving)
  // This triggers ONLY on ABSENT auth cookies. A PRESENT-but-invalid cookie is
  // NOT fast-pathed — it flows through getUser() below and fails closed exactly
  // as before (proven by the garbage-cookie row of the gate-regression matrix).
  if (!requestHasAuthCookies(request)) {
    if (gate === "public") {
      return response;
    }
    return loginRedirect(request, response, locale, path);
  }

  // ── 4. Auth cookie present: refresh session (unchanged pre-PERF-02 path) ────
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() revalidates the token with the Auth server and refreshes
  // cookies — do not trust getSession() in middleware. Keep this before gating.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public routes: keep the locale response (rewrite + refreshed cookies). No DB
  // read (keeps the public hot path lean).
  if (gate === "public") {
    return response;
  }

  // All remaining gates require an authenticated session. A present-but-invalid
  // cookie yields no user → fail closed to login (identical to a guest).
  if (!user) {
    return loginRedirect(request, response, locale, path);
  }

  // Single indexed lookup (PK on users.id) for block + role. RLS `users_self`
  // scopes this to the caller's own row.
  const { data: profile, error } = await supabase
    .schema("betk")
    .from("users")
    .select("role, status, deleted_at")
    .eq("id", user.id)
    .maybeSingle();

  // No profile row (or read error) → cannot establish role/status → login.
  if (error || !profile) {
    return loginRedirect(request, response, locale, path);
  }

  // R-A05 block check: suspended / banned / pending / soft-deleted → /blocked.
  if (profile.status !== "active" || profile.deleted_at !== null) {
    return redirect(request, response, localize(locale, "/blocked"));
  }

  if (gate === "admin") {
    // is_admin(): role IN ('admin','superadmin') AND status='active' (checked above).
    if (profile.role !== "admin" && profile.role !== "superadmin") {
      return redirect(request, response, localize(locale, "/"));
    }
    return response;
  }

  if (gate === "seller") {
    // /seller/onboarding — AUTHENTICATION-ONLY entry (Phase 04 T02). The wizard
    // "becomes seller on submit" (BETK_UI_SPEC §3), so any active authenticated
    // user — typically a buyer — may reach it. An EXISTING seller is bounced OUT
    // so the wizard is never re-run: active → /seller (dashboard); any other
    // status → /seller/status. The verified-phone (OD-4) gate is deliberately
    // NOT enforced here — it lives in the T03 become-seller Server Action + RLS
    // WITH CHECK (Phase-02 boundary); the page renders the phone-capture pointer
    // for phone-NULL users. Middleware stays role/status logic only.
    if (path === SELLER_ONBOARDING_ROUTE) {
      if (profile.role === "seller") {
        const { data: sellerProfile } = await supabase
          .schema("betk")
          .from("seller_profiles")
          .select("status")
          .eq("id", user.id)
          .maybeSingle();

        return redirect(
          request,
          response,
          localize(
            locale,
            sellerProfile?.status === "active"
              ? SELLER_PREFIX
              : SELLER_STATUS_ROUTE,
          ),
        );
      }
      // Non-seller (buyer): allowed through to start onboarding.
      return response;
    }

    if (profile.role !== "seller") {
      return redirect(request, response, localize(locale, "/"));
    }
    // R-S04: pending/rejected/suspended sellers go to /seller/status, not the
    // dashboard. /seller/status itself must stay reachable to avoid a loop —
    // the check uses the locale-stripped `path`, so the loop-guard is
    // locale-invariant.
    if (path !== SELLER_STATUS_ROUTE) {
      const { data: sellerProfile } = await supabase
        .schema("betk")
        .from("seller_profiles")
        .select("status")
        .eq("id", user.id)
        .maybeSingle();

      if (!sellerProfile || sellerProfile.status !== "active") {
        return redirect(request, response, localize(locale, SELLER_STATUS_ROUTE));
      }
    }
    return response;
  }

  // gate === "buyer": any active authenticated user is allowed.
  return response;
}

/** Copy accumulated (locale + refreshed auth) cookies onto a redirect response. */
function copyCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

/**
 * Build the locale-preserving `/auth/login?returnUrl=…` redirect for an
 * unauthenticated request to a protected route. Extracted (PERF-02) so the
 * guest fast-path and the full path produce a byte-identical redirect. The
 * `returnUrl` is the original locale-stripped destination + query, sanitised
 * against open-redirect (only local single-'/'-prefixed paths).
 */
function loginRedirect(
  request: NextRequest,
  response: NextResponse,
  locale: string,
  path: string,
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = localize(locale, LOGIN_ROUTE);
  url.search = "";
  const raw = `${path}${request.nextUrl.search}`;
  url.searchParams.set("returnUrl", sanitizeReturnUrl(raw));
  return copyCookies(response, NextResponse.redirect(url));
}

/** Build a same-origin redirect that preserves locale + refreshed auth cookies. */
function redirect(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return copyCookies(response, NextResponse.redirect(url));
}

export const config = {
  /**
   * Run on every path EXCEPT API routes, Next internals, and static assets.
   * `api` is excluded so route handlers are neither localized nor gated here
   * (no API routes exist yet; auth for API is handled per-handler). Keeps
   * middleware off the hot path for `_next/*`, the favicon, and static files.
   */
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf|otf|css|js|map|txt|xml|json)$).*)",
  ],
};
