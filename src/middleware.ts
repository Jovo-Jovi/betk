import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";
import { sanitizeReturnUrl } from "@/validations/returnUrl";

/**
 * BETK auth middleware — route-group gates + session refresh.
 * Spec: BETK_ARCHITECTURE.md §4 · BETK_UI_SPEC.md §2 · SESSION_CONTEXT (R-A05, R-S04, OD-4).
 *
 * Responsibilities (skeleton — Phase 01/T10):
 *  1. Refresh the Supabase Auth session on every matched request (cookie-bound SSR pattern).
 *  2. Gate route groups: (public) open · (buyer) auth required · (seller)/seller role=seller
 *     · (admin)/admin is_admin().
 *  3. Block check (R-A05): authenticated users with status != 'active' OR deleted_at != NULL
 *     are routed to /blocked.
 *
 * The security boundary is RLS in Postgres (BETK_ERD §3); this gate is a UX convenience
 * and a defence-in-depth layer. Server Actions re-check role/ownership before mutating.
 *
 * TODO(OD-4 / Phase 04·07·13): the verified-phone transaction gate
 * (`users.phone_number IS NOT NULL`) is NOT enforced here. Google-OAuth users may browse,
 * wishlist, and follow with no phone. Checkout, become-seller, and payout are gated in their
 * respective Server Actions + RLS WITH CHECK — never in this middleware.
 */

// Login route (BETK_UI_SPEC §2). Phase 02 builds the page; here we only redirect to it.
const LOGIN_ROUTE = "/auth/login";

// Public routes (BETK_UI_SPEC §2 "public") need no session: "/" (homepage), /search,
// /category, /listing, /store, /auth/* (login·verify·register), and /blocked (kept
// reachable so blocked users never loop). These are the default — anything NOT matched
// by the protected/role prefixes below is treated as public.

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

// Seller landing for pending/rejected/suspended sellers (R-S04) — must be reachable while
// the seller's profile is not yet active.
const SELLER_STATUS_ROUTE = "/seller/status";

type Gate = "public" | "buyer" | "seller" | "admin";

function gateFor(pathname: string): Gate {
  if (pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`)) {
    return "admin";
  }
  if (pathname === SELLER_PREFIX || pathname.startsWith(`${SELLER_PREFIX}/`)) {
    return "seller";
  }
  if (
    BUYER_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    )
  ) {
    return "buyer";
  }
  // Homepage ("/"), public catalogue routes, /auth, /blocked → public.
  return "public";
}

export async function middleware(request: NextRequest) {
  // Mutable response that accumulates refreshed auth cookies (Supabase SSR pattern).
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() revalidates the token with the Auth server and refreshes
  // cookies — do not trust getSession() in middleware. Keep this call before any gating.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const gate = gateFor(pathname);

  // Public routes: refresh session and pass through. No DB read (keeps homepage lean).
  if (gate === "public") {
    return response;
  }

  // All remaining gates require an authenticated session.
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_ROUTE;
    url.search = "";
    // Preserve the original destination so Phase 02 login can bounce the user back.
    // sanitizeReturnUrl guards against open-redirect: only local paths (single '/' prefix,
    // not protocol-relative or absolute) are forwarded; anything else falls back to '/'.
    const raw = `${pathname}${request.nextUrl.search}`;
    const safeReturn = sanitizeReturnUrl(raw);
    url.searchParams.set("returnUrl", safeReturn);
    return copyCookies(response, NextResponse.redirect(url));
  }

  // Single indexed lookup (PK on users.id) for block + role. RLS policy `users_self`
  // scopes this to the caller's own row. Select only what the gates need.
  const { data: profile, error } = await supabase
    .schema("betk")
    .from("users")
    .select("role, status, deleted_at")
    .eq("id", user.id)
    .maybeSingle();

  // No profile row (or read error) → cannot establish role/status. Send to login rather
  // than leak access. (A fully onboarded user always has a betk.users row.)
  if (error || !profile) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_ROUTE;
    url.search = "";
    const raw2 = `${pathname}${request.nextUrl.search}`;
    url.searchParams.set("returnUrl", sanitizeReturnUrl(raw2));
    return copyCookies(response, NextResponse.redirect(url));
  }

  // R-A05 block check: suspended / banned / pending / soft-deleted → /blocked.
  if (profile.status !== "active" || profile.deleted_at !== null) {
    return redirect(request, response, "/blocked");
  }

  if (gate === "admin") {
    // is_admin(): role IN ('admin','superadmin') AND status='active' (status already checked).
    if (profile.role !== "admin" && profile.role !== "superadmin") {
      return redirect(request, response, "/");
    }
    return response;
  }

  if (gate === "seller") {
    if (profile.role !== "seller") {
      return redirect(request, response, "/");
    }
    // R-S04: pending/rejected/suspended sellers go to /seller/status, not the dashboard.
    // /seller/status itself must stay reachable to avoid a redirect loop.
    if (pathname !== SELLER_STATUS_ROUTE) {
      const { data: sellerProfile } = await supabase
        .schema("betk")
        .from("seller_profiles")
        .select("status")
        .eq("id", user.id)
        .maybeSingle();

      if (!sellerProfile || sellerProfile.status !== "active") {
        return redirect(request, response, SELLER_STATUS_ROUTE);
      }
    }
    return response;
  }

  // gate === "buyer": any active authenticated user is allowed.
  return response;
}

/** Copy accumulated (refreshed) auth cookies onto a redirect response. */
function copyCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

/** Build a same-origin redirect that preserves refreshed auth cookies. */
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
   * Run on every path EXCEPT Next internals and static assets. Keeps middleware off the
   * hot path for `_next/*`, the favicon, and common static file extensions.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf|otf|css|js|map|txt|xml|json)$).*)",
  ],
};
