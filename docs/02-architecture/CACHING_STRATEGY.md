# CACHING_STRATEGY.md

> Per-route rendering/caching posture for the BETK Next.js App Router, the
> anon-vs-cookie Supabase client rule, and the middleware guest fast-path
> contract. Authored by PERF-01/02 (2026-07-21). Cross-linked from
> `BETK_ARCHITECTURE.md §7`. Ground truth is the `next build` route table +
> the per-page `export const revalidate` / `generateStaticParams` — verify
> against a build, never assume.

## 1. Legend

- **`○` Static** — prerendered, no per-request work.
- **`●` SSG/ISR** — prerendered via `generateStaticParams`; with
  `export const revalidate = N` (and the default `dynamicParams = true`), paths
  not prerendered at build are generated on first hit and cached for `N`s
  (Incremental Static Regeneration).
- **`ƒ` Dynamic** — server-rendered on demand (reads a dynamic API:
  `cookies()`/`headers()`, or is a route handler / uses `searchParams` on a
  dynamic segment).

## 2. Per-route posture

Locale note: every route lives under `[locale]` (`/` = AR, `/en/…` = EN). The
`[locale]` layout supplies `generateStaticParams` for `{ar,en}` and calls
`setRequestLocale`, so both locales share one posture. For ISR routes generated
**on demand** (category/listing), the locale must additionally be threaded
**explicitly** through the render tree — see §7 (a hard requirement, not a
nicety: getting it wrong 500s the non-default locale).

### Public routes

| Route | Posture | Client | Why |
|---|---|---|---|
| `/[locale]` (home) | `●` ISR 60s | anon | Identity-free. C3 §8 "cache homepage 60s". Section-level degradation on the strips. |
| `/[locale]/category/[slug]` | `●` ISR 60s | anon | **PERF-02**: identity-free browse. `generateStaticParams` (`[]`, on-demand) + `revalidate = 60` + explicit-locale threading (§7). Pagination moved OFF the URL (see §5). |
| `/[locale]/listing/[id]` | `●` ISR 60s | anon | **PERF-02**: identity-free detail — deliberately does NOT hydrate per-user wishlist state (Phase-03 T06 decision). `generateStaticParams` (`[]`) + `revalidate = 60` + explicit-locale threading (§7). |
| `/[locale]/search` | `●` (prerendered shell), per-request for query | anon | Reads user query params (`?q=…&sort=…&page=…`) → each distinct query is a fresh server render. STAYS query-dynamic (not flipped to a cached page — results are user-driven). |
| `/[locale]/store/[slug]` | `ƒ` Dynamic | **cookie** | Reads the CALLER'S OWN follow state (`getStoreFollowState`) + `getUser()` so the `FollowButton` renders real state (Phase-03 T06). One auth context, one round of `cookies()` → dynamic by nature. See §4 future candidate. |
| `/[locale]/blocked` | `●` static | — | Static content (R-A05 landing). |
| `/[locale]/auth/{login,phone,register,verify}` | `●` static | — | Static forms; interaction is client-side + Server Actions. |
| `/[locale]/auth/callback` | `ƒ` route handler | cookie | OAuth PKCE code exchange — inherently per-request. |

### Authenticated routes (buyer / seller)

| Route | Posture (build) | Why |
|---|---|---|
| `/[locale]/account` | `●` | Authorization is enforced in **middleware** (buyer gate + R-A05), not the page. The page reads the caller's profile via the cookie client at request time; the build emits a prerendered shell but per-user data is request-time. |
| `/[locale]/seller`, `/seller/status`, `/seller/onboarding`, `/seller/store`, `/seller/store/{delivery,payments,returns}` | `●` | Same model: the seller gate (role/status) runs in middleware; pages read/write the caller's own rows via the cookie client + Server Actions. |

> **Note (accuracy over assumption):** the authed pages are build-labelled `●`,
> not `ƒ`, and this is the **pre-existing** posture inherited from Phases 02–04
> — PERF-02 did not touch them. Authorization never depends on the render mode:
> it is the middleware gate (defence-in-depth) + RLS in Postgres (the real
> boundary). A caching audit of the authed surface (are any prerendered shells
> serving stale/again per-user data?) is out of PERF-02 scope and, if wanted,
> belongs to a dedicated pass.

### API routes

| Route | Posture | Client | Why |
|---|---|---|---|
| `/api/category-listings` | `ƒ` route handler | anon | **PERF-02**: public, read-only pagination source for the category page's "load more". Zod-gated, no session, no service-role. See §5. |

## 3. The anon-vs-cookie client rule (load-bearing)

- **`createAnonClient()`** (`src/lib/supabase/anon.ts`) — stateless, anon key,
  `persistSession:false`, **no `cookies()`**. RLS still fully applies (same
  guest/anon role). Use for public, non-personalized reads so the route stays
  static/ISR-cacheable. The cookie client's internal `cookies()` call would
  force the whole route to per-request dynamic and defeat `revalidate`.
- **`createClient()`** (`src/lib/supabase/server.ts`) — cookie-bound, carries
  the caller's session. Use whenever identity matters (follow/wishlist
  membership, order ownership, any authed page/action). Its `cookies()` read
  makes the route dynamic — that is correct and intended for those routes.
- **`createServiceClient()`** — service-role, RLS-bypassing. NEVER reachable
  from `src/app` / `src/features` / `src/components` (the `check-service-import`
  guard enforces this). Not part of any read path here.

Rule of thumb: **ISR/static route → anon client; dynamic/authed route → cookie
client.** A public page that accidentally imports the cookie client silently
loses its cache — grep the render path and confirm via the build symbol.

## 4. REG-37 — standing items

- **`rating_aggregates` TTL.** C3 §8 specified a distinct 5-minute cache for
  `rating_aggregates`. As implemented (Next App-Router ISR), store/listing
  ratings are read inside the homepage / listing / category queries and
  therefore **inherit that page's 60s ISR TTL** — there is no separate 5-minute
  window. Accepted for MVP (60s ≤ 5min is strictly fresher; simpler). If a
  dedicated longer TTL is ever wanted it needs a separate cached read
  (`unstable_cache` tag) — not done now.
- **Unindexed FKs at scale (leg stays OPEN).** ~37 foreign keys on hot read
  paths have no covering index. Harmless on near-empty staging; a covering-index
  pass is wanted **before scale**. This leg of REG-37 remains open (owned) — it
  is a DB indexing task, not a caching-doc change, and is NOT closed by
  PERF-02.
- **Store ISR — future candidate (NOT done now).** `/store/[slug]` is dynamic
  only to render the caller's follow state. A future refactor could make the
  storefront ISR-cached (identity-free HTML) and hydrate the follow state
  client-side (a small authed read after paint), exactly like the listing page
  dropped per-user wishlist hydration. Recorded here as a candidate; it needs
  its own task (client follow-state hydration + a public store read path).

## 5. Category pagination trade-off (PERF-02, accepted)

Making `/category/[slug]` ISR-cacheable required removing the page-level
`searchParams` read (reading `searchParams` forces dynamic rendering — the same
reason `/search` is query-dynamic). Forward pagination therefore moved off the
URL:

- The page renders **page 1 only** (ISR-cached). The PERF-01 Suspense/streaming
  is intact on the ISR **miss** path (first hit / revalidation); a cache **hit**
  serves complete HTML (streaming is a miss-path behavior).
- "Load more" is an **in-place client append** (`CategoryLoadMore`) that calls
  `GET /api/category-listings?category=<uuid>&cursor=<opaque>&locale=<ar|en>`.
- **Handler contract:** public, anon (`createAnonClient`), read-only,
  **Zod-gated** (`categoryListingsRequestSchema`) BEFORE any DB call. A garbage
  cursor → **400** (not a silent page-1). It runs the SAME R-S07-safe
  (`stores!inner`) `getActiveListings` query as the page, so draft / soft-deleted
  / suspended-store listings are excluded identically. Data is live (at least as
  fresh as the page's 60s ISR window — it is not itself cached).
- **Accepted cost:** deep pagination is **no longer URL-addressable** — a shared
  `/category/<slug>` link always opens on page 1, and an old `?cursor=…` deep
  link now simply renders page 1 (the param is ignored). This is the price of
  ISR-caching the route; keyset "load more" (forward-only) still works.

`/store/[slug]`'s Listings tab keeps its URL-based `?cursor=` pagination
(`LoadMoreLink`) because that route is already dynamic — no ISR to protect.

## 6. Middleware guest fast-path contract (PERF-02)

`src/middleware.ts`:

- The Supabase auth-cookie name prefix is **derived** from
  `NEXT_PUBLIC_SUPABASE_URL` (`sb-<project-ref>-auth-token`) — never hardcoded.
- **If the request carries NO auth cookie** (no cookie name starting with that
  prefix), the caller is provably a guest — there is no session to refresh, so
  the `supabase.auth.getUser()` GoTrue round-trip **and** the DB profile read
  are **skipped entirely**. Verdicts are identical to the full path's guest
  outcome:
  - public route → pass (keep the locale rewrite/cookie response);
  - protected route → `/auth/login?returnUrl=…` (locale-preserving).
- **The fast-path triggers ONLY on ABSENT auth cookies.** A present-but-invalid
  (garbage/expired) cookie is NOT fast-pathed — it flows through `getUser()` and
  fails closed exactly as before (redirect to login). This is proven by the
  `guest-garbage-cookie` row of the gate-regression matrix.
- When any auth cookie is present, the path is byte-identical to the pre-PERF-02
  behaviour (create client → `getUser()` + refresh → gates).
- Standing contract: the security boundary remains RLS in Postgres; the gate is
  UX + defence-in-depth. The fast-path is a pure latency optimization for guests
  on the public catalogue (no GoTrue hop, no DB read) and must never change a
  verdict.

## 7. next-intl + on-demand ISR: thread the locale explicitly (load-bearing)

**Symptom this prevents:** the non-default locale (`/en/…`) returns **500**
(`DYNAMIC_SERVER_USAGE`) on an ISR route, while the default locale (`/…`, AR)
serves fine. The default locale is silently masked by next-intl's fallback, so
this is easy to ship unnoticed if you only smoke the AR path.

**Root cause.** next-intl enables static rendering via `setRequestLocale`, which
writes the locale into a React `cache()` store. That store is only guaranteed
inside the **page and layout** scopes that call it *and* only for paths that are
**prerendered at build** (`generateStaticParams`). Our category/listing routes
prerender **nothing** at build (`generateStaticParams` returns `[]`) — every path
is generated **on demand** at first hit / on revalidation. On that runtime
on-demand path the store is NOT reliably resolved across independently-rendered
scopes (the `(public)` layout, the page, and Suspense-wrapped async children each
render separately). Any next-intl server API that then reads the locale from the
store — `getLocale()`, `getTranslations()` **without** an explicit locale, or the
server `<Link>` (which calls `getLocale()` internally) — falls back to
`headers()`, which is a dynamic API → static generation aborts → 500. For the
default locale next-intl returns it without touching `headers()`, so AR survives.

**Rule (required for any ISR route under `[locale]`).** Do not depend on the
`setRequestLocale` store on the render path. Instead:

1. **Layouts/pages** still call `setRequestLocale(locale)` (it primes the client
   provider) AND read `locale` from the validated `[locale]` **param**, passing
   it explicitly: `getTranslations({ locale, namespace })`. This applies to the
   shared `(public)` layout too — it wraps every public page, so a store-based
   `getLocale()`/`getTranslations()` there 500s *all* on-demand `/en` public
   routes, not just the one you changed.
2. **Async server components inside `<Suspense>`** (e.g. `CategoryListingsSection`)
   are neither a page nor a layout — take `locale` as a **prop** from the page
   and pass it to every `getTranslations({ locale })`.
3. **Server `<Link>`** (`@/i18n/navigation`) on an ISR render path — pass an
   explicit `locale={locale}` prop (e.g. `SubcategoryChips`, the category
   empty-state links) so it does not read the store.
4. Client components (`AppChrome`, `ListingCardLink`, …) are fine as-is — they
   read the locale from `NextIntlClientProvider`, never the server store.

**Verify:** `next start` + hit `/en/<isr-route>` twice (first + repeat). A 500 on
`/en` while `/` (AR) is 200 is this bug. Build-time prerendered routes (homepage,
`/en/search` shell, authed shells) mask it because build-time generation *does*
resolve the store — the failure only shows on the on-demand/revalidation path.
