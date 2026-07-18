# PHASE_03_CATALOG.md — Catalog & Discovery (public)

> Step 15 task pack (BETK Dev OS). FR-PUB-1..5: Homepage, Search, Category, Listing Detail, Storefront.
> Generated 2026-06-30 by the Phase-02 review chat after Phase 02 sign-off.
> **Design-system placement decision: Option A (DS early).** Phase 03 composes *real* Claude-Design components, not placeholders.
>
> **✅ T02 RESUMED (OD-7 CLOSED, merged to `main` @ `648ed4f`, 2026-07-02).** The Bilingual AR/EN + Theme (BL) track's **BL-05** gate PASSED and merged — T01/T01-FIX + the full BL-00..BL-05 foundation (next-intl, next-themes, `[locale]` routing, locale-safe gates, DS-I18N shared-kit wiring) are now on `main`. **T02 onward, every page is authored bilingual + themed**, consuming the already-wired `src/i18n/catalogLabels.ts` builder helpers + the `catalog.*` next-intl namespace (`messages/{ar,en}.json`, 198/198 key parity) against the 16 DS-I18N-refactored `components/shared/*` components: an EN shell (`next-intl`, EN under `/en`) alongside the Arabic-first RTL layout, **bilingual names/titles** via the existing `*_ar`/`*_en` columns displayed `COALESCE(locale column, other)` (never blank), and **light/dark** theming (`next-themes`, `.dark` class on `<html>`). **Descriptions/bios render as-authored (single language, no translation).** Wherever this pack says "Arabic-first / RTL", read it as **"+ EN shell + bilingual names/titles + light/dark"** (the Arabic-first default is unchanged). Full track record: `OD7_BILINGUAL_THEME_TRACK.md`.

---

## Phase scope & invariants

- **Read-only public surface + exactly 2 auth-gated writes** (`toggleWishlist`, `toggleFollow`). No new tables, no new RLS policies — the public-SELECT RLS and the `wishlist_own` / `store_follows` self-scope policies are already live from Phase 01.
- **Public RLS is the security boundary** (ARCHITECTURE §4). Guest reads only; guest write-actions redirect to `/auth/login?returnUrl=…`. Server Actions re-check auth; never trust the client.
- **Frozen scope (OD-1…OD-6) respected** — no new pages/tables/features beyond FR-PUB.
- **Arabic-first / RTL-first + EN shell + bilingual names/titles + light/dark (OD-7, from T02 onward).** `name_ar`/`title_ar` remain the primary/default; logical CSS properties only. Add an EN shell (`next-intl`, EN under `/en`) and display bilingual names/titles via existing `*_ar`/`*_en` columns as `COALESCE(locale column, other)` (never blank); support light/dark theme (`next-themes`). Descriptions/bios render as-authored (single language, no translation).
- **Compose, don't restyle.** Wire data into `components/shared` (Claude-Design-owned). No hardcoded colors, no editing `components/ui/*`, no forking shared components. Visual gaps → flag to Claude Design, do not patch in a feature folder (BETK_CODEBASE_ARCHITECTURE §Design-system ownership).
- **Caching** (ARCHITECTURE §search/cache): homepage strips 60s TTL, `rating_aggregates` 5-min TTL. Section-level degradation — a failed strip never hard-fails the page.
- **Search scale:** GIN on `listings.search_vector`, `unaccent` for Arabic; safe to ~500K listings on tsvector+GIN.
- **CLI:** direct `supabase` binary (npx wrapper hangs on Windows). One task per Cursor window. Close-out rhythm: update `SESSION_CONTEXT.md` + `DEVELOPMENT_JOURNAL.md` → commit → new window.
- **Zod** on both Server Actions (CI `check-zod-coverage` stays green). `posthog.server` for any server capture; Sentry tag by feature (`discovery` / `discovery-actions`).

### Verified DB facts this pack relies on (from BETK_ERD.md / BETK_DATABASE_SCHEMA.sql)
- `wishlists` → `wishlist_own` policy (self or admin SELECT; self INSERT/DELETE). **Hard delete allowed** → toggle = real insert/delete.
- `store_follows` → self-scope (self or admin SELECT; self INSERT/DELETE), `UNIQUE(buyer_id, store_id)`. **Hard delete allowed**.
  → **Neither hits the orders/seller_profiles default-deny pattern.** T06 verifies this but is expected to PASS, not flag.
- `listings` soft delete (`deleted_at`) — the ONLY soft-deleted table (R-L10); historical `order_items` reference it.
- Status-based hiding (not deletion) for suspended stores/sellers/listings (R-S07).
- `update_listing_search_vector` trigger (BEFORE INSERT/UPDATE on `listings`) builds `search_vector` from `title_ar + title_en + description_ar` via `unaccent` — live since Phase 01 (T05/T14).
- `decrement_stock_on_confirm` trigger (R-L05/06) — **still owed to source** (confirmed absent at T14). Not a Phase 03 concern (no order confirmation here), but listing stock display must read live `stock_qty`/`status`.
- Indexes present: GIN(`search_vector`); partial `(created_at DESC) WHERE active&!deleted` (new arrivals); partial `(view_count DESC) WHERE active&!deleted` (popularity); `(store_id,status)`, `(category_id,status)`, `(store_id) WHERE active&!deleted` (storefront).
- Boost guard: partial unique `boosts(listing_id) WHERE active` (R-B01). Boosted set = `boosts` (status='active') joined to active `listings`.

### Business rules referenced
- **R-B04** boosted ranking — *exact weight/formula not pinned in the available docs.* Tasks must CONFIRM the rule against PRD/ERD before coding and STATE what was implemented. Do not invent a weight.
- **R-S07** suspended store hidden (status filter, 404).
- **R-L09** `price_type` handling (fixed / per_hour / starting_from / quote_only; quote_only hides quantity/price-paid).
- **R-L10** removed/soft-deleted listing → 404.
- **R-N06** sold_out → restock-alert CTA.

---

## Task list
- **T00** — Claude-Design handoff (DS gate, runs in **Claude Design**, not Cursor)
- **T01** — Public read query layer (queries + types, no UI)
- **T02** — Homepage `/`
- **T03** — Search & filter `/search` (tsvector + Arabic unaccent + R-B04) · **Opus**
- **T04** — Category browse `/category/[slug]`
- **T05** — Listing detail `/listing/[id]`
- **T06** — Storefront `/store/[slug]` + wishlist & follow actions · **Opus**
- **T07** — Phase 03 exit verification · **Opus**

---

## T00 — Claude-Design handoff (DS gate)
- **Surface:** **Claude Design** (NOT Cursor) · **Source:** `00-design/BETK_DESIGN_BRIEF.md`, `BETK_UI_SPEC.md` §1 + Homepage/Search/Listing/Storefront, BETK_CODEBASE_ARCHITECTURE §Design-system ownership, `phase-packs/PHASE_DS_DESIGN_SYSTEM.md`
- **Deliverable:** the catalog shared components in `components/shared`, RTL-first, **token-only** (UI Spec §1 CSS vars — no hardcoded colors), extending shadcn (never editing `components/ui/*`), with **all states** (default / loading-skeleton / empty / error) per UI Spec:
  - `ListingCard`, `StoreCard`
  - `CategoryGrid` (icon tiles), `CollectionStrip` (horizontal carousel)
  - `ImageGallery` (≤5, hero-first), `PriceBlock` (price_type: fixed / per_hour / starting_from / quote_only), `StockBadge` (product / service / made-to-order / sold_out)
  - `SellerMiniCard`, `RatingSummary` (avg + distribution bars)
  - `SearchBar`, `FilterSheet`/sidebar, `FilterChips`
  - `WishlistButton`, `FollowButton` (presentational; Cursor wires the action in T06)
  - skeletons for each grid/carousel
- **Done when:** components exist on a `feature/design-*` branch, merged/available to Cursor; each uses tokens not hardcoded colors; RTL verified; every state present.
- **Gate:** Phase 03 Cursor tasks (T01+) do not start until these exist. If a component or state is missing mid-task, Cursor **STOPS and flags it back to Claude Design** — it does not improvise a styled component.

---

## T01 — Public read query layer (queries + types)
- **Model:** Sonnet · **Skill:** skill-supabase-engineer, skill-nextjs-engineer · **Source:** FR-PUB-1/3, ERD
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 03 / T01 — public read query layer for catalog (no UI yet; queries + types only).

Build the discovery queries (src/features/discovery/queries/*) using the cookie/anon server client — public RLS applies, NO service-role:
- getActiveListings({ category?, sort?, cursor? }) — listings WHERE status='active' AND deleted_at IS NULL; hero image (listing_images sort_order=0); rating_aggregates per store. Default sort created_at DESC. Cursor-paginate.
- getCategoryTree() — categories WHERE is_active; self-referential parent_id assembled into top-level + children.
- getHomepageData() — live collections (status='live', ordered homepage_position) → collection_listings (sort_order) → listings; new-arrivals (active, !deleted, created_at DESC); boosted set (boosts status='active' joined to active listings). Each strip INDEPENDENTLY fetchable (section-level degradation).
- getListingById(id) — full listings row + listing_images (ordered) + listing_tags + stores + seller_profiles + rating_aggregates + visible reviews (is_visible) + review_photos. Returns null for missing/soft-deleted (→ 404 at page).
- getStoreBySlug(slug) — stores WHERE slug AND status='active' (suspended/unknown → null → 404, R-S07); + seller_profiles + rating_aggregates + active listings + visible reviews.

Type every return shape (reuse generated types.ts + jsonb.ts interfaces for stores.payment_methods/delivery_options). NO writes. NO new policies — if any read is unexpectedly RLS-denied, STOP and flag (do not add a policy).

Integration test (staging, anon client): active listing visible; draft + soft-deleted hidden; suspended store returns null; category tree assembles parent/child.
pnpm typecheck + lint clean. Close-out → commit.
```
- **Files:** `src/features/discovery/queries/*`, `src/features/discovery/types/*`, `src/features/discovery/index.ts`, test.
- **Done when:** five typed query fns; anon-client (public RLS); soft-deleted/suspended hidden; tree assembles; tests green. No service-role, no new policy.

---

## T02 — Homepage (`/`)
- **Model:** Sonnet · **Skill:** skill-nextjs-engineer, skill-ui-engineer · **Source:** FR-PUB-1, UI_SPEC Homepage
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 03 / T02 — Homepage (RSC, public,
bilingual + themed per the pack header). Branch feature/phase-03-catalog cut from
current origin/main after git fetch.

ROUTE (repo-state expansion): the homepage is src/app/[locale]/(public)/page.tsx —
currently the BL-01-FIX stub (return null). Replace its body; do NOT recreate
chrome — AppChrome (AppTopbar + MobileBottomNav) + Footer already wrap this route
via the (public) layout. Do not touch layout.tsx unless a Suspense boundary needs
adjusting; report any layout diff.

COMPOSE (Claude-Design components — compose only, never restyle; missing
component/state → STOP and flag):
- Hero per BETK_DESIGN_BRIEF.md §5.31: page-level section composing SearchBar
  (submits/links to /search via @/i18n/navigation). The §5.31 gradient values
  (175 60% 20% → 175 45% 10%, dark deepened) are the ONLY sanctioned literals;
  everything else tokens. Copy via a new home.* namespace in messages/{ar,en}.json
  (both locales, report parity count).
- CategoryGrid from getCategoryTree() — names via localizedName COALESCE.
- CollectionStrip per live collection (homepage_position order), dir from locale
  server-side; collection names COALESCE.
- ListingCard grids: New Arrivals + Featured/Boosted from getHomepageData();
  titles COALESCE; labels via src/i18n/catalogLabels.ts builders.
- FEATURED STORES (pack↔T01 mismatch — resolve, don't invent): the canonical
  prompt lists a StoreCard row, but getHomepageData() (T01) returns no store
  strip. CONFIRM against BETK_UI_SPEC.md §3 Homepage: if a featured-stores row
  is specced WITH a pinned selection rule, add a read-only anon query following
  T01 conventions and STATE the rule + its source; if the selection rule is not
  pinned in the docs, OMIT the row and flag it — do not invent one.

BEHAVIOR:
- Section-level degradation: each strip independent; failed strip → its own
  ErrorRetryCard (already wired to i18n); page never hard-fails. Per-strip
  skeletons; progressive render.
- Empty: no live collections → New Arrivals only; zero active listings
  platform-wide → "getting started" panel + Become-a-Seller CTA (both locales,
  keyed) routing to seller onboarding (guest → login returnUrl, locale-preserving).
- WishlistButton renders; guest click → /auth/login?returnUrl (locale-preserving
  via the middleware pattern) — toggle wiring is T06, entry/redirect only here.
- Caching: strips 60s TTL; rating_aggregates 5-min (per ARCHITECTURE).
- generateMetadata via getTranslations, both locales.

VERIFY: pnpm typecheck · lint · 3 guards · unit · build (both locales prerender).
Runtime smoke: / and /en render hero + categories + strips inside real chrome,
correct dir/lang; a strip with no data degrades not crashes; dark class intact.
No new RLS policies, no service-role, no ui/* or shared/* edits (git diff proof).
Close-out → SESSION_CONTEXT + journal → commit + push. HOLD PR for verdict.
```
- **Files:** `src/app/(public)/page.tsx`, `src/features/discovery/components/*` (composition only).
- **Done when:** `/` renders collections/categories/new-arrivals/boosted from real data; section-level degradation works; empty/loading/error states present; guest wishlist routes to login. No restyle.

---

## T03 — Search & filter (`/search`)
- **Model:** **Opus** (search-ranking correctness + Arabic unaccent + R-B04 = the phase's hardest logic) · **Skill:** skill-supabase-engineer, skill-nextjs-engineer · **Source:** FR-PUB-2, R-B04, ARCHITECTURE §search
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 03 / T03 — Search & filter at /search
(public, bilingual + themed). Branch feature/phase-03-catalog (continue, git pull first).

ROUTE: src/app/[locale]/(public)/search/page.tsx. Chrome comes from the (public)
layout — do not touch it.

QUERY (src/features/discovery/queries/searchListings.ts, T01 conventions: anon/
injectable DiscoveryClient, typed returns, Zod-validated params, NO service-role,
NO new policies):
- Full-text over listings.search_vector; status='active' AND deleted_at IS NULL
  always enforced.
- KNOWN REPO FACT (OD-7 §7 carry): update_listing_search_vector uses 'arabic'/
  'english' TS configs, NOT unaccent, and runs description_ar through the English
  stemmer. Do not assume the pack's "unaccent" line holds. VERIFY live behavior:
  seed a listing whose title contains Arabic WITH diacritics, query WITHOUT them
  (and inverse). If matching fails, STOP and flag — the fix is a DB-classed
  trigger/migration task for separate review, NOT an in-task rebuild. STATE the
  observed behavior either way.
- Filters from URL params, preserved in URL (shareable): category, type
  (product|service), governorate, city, price_min/price_max, sort
  (relevance|newest|price|popularity). Params locale-neutral (same URL shape
  under /en).
- R-B04 boosted ranking: CONFIRM the exact rule against BETK_PRD.md / BETK_ERD.md
  before implementing (active-boost listings above organic within the relevant
  result set — but the precise scope/tiebreak must come from the docs). Do NOT
  invent a weight. STATE the rule + its doc citation in the close-out. If the
  docs do not pin it, STOP and flag.
- Pagination: follow T01's keyset-cursor convention where the sort permits;
  STATE the approach per sort mode (relevance keyset is non-trivial — if you
  fall back to offset for relevance, say so and why).

PAGE: compose SearchBar (initial query from URL), FilterSheet (mobile) / inline
panel (desktop), FilterChips (active filters, removable), ListingCard grid,
sort control, pagination, boosted-results treatment per the shared kit. All
copy via a search.* namespace in messages/{ar,en}.json (report parity count);
titles/names COALESCE; labels via catalogLabels builders. generateMetadata both
locales. Empty: "no results" preserving query+filters in URL. Error: retry
preserving query+filters. Guest wishlist → login returnUrl (locale-preserving).

TESTS (integration, staging, seeded + cleaned per T01 pattern): keyword matches
active listing; soft-deleted/suspended excluded; boosted ranks above organic
(R-B04 as documented); the Arabic diacritics probe above; filter combination
narrows correctly.

VERIFY: typecheck · lint · 3 guards · test:unit · build (both locales). Runtime
smoke: /search?q=… and /en/search?q=… render results/empty correctly in chrome.
No ui/* or shared/* edits (diff proof). Close-out → SESSION_CONTEXT + journal →
commit + push. HOLD for verdict.
```
- **Files:** `src/app/(public)/search/page.tsx`, `src/features/discovery/queries/searchListings.ts`, components (composition).
- **Done when:** keyword search over `search_vector` with Arabic unaccent; all filters from URL; R-B04 boosted-above-organic proven by test; soft-deleted/suspended excluded; states present. **R-B04 rule documented, not invented.**

---

## T04 — Category browse (`/category/[slug]`)
- **Model:** Sonnet · **Skill:** skill-nextjs-engineer, skill-ui-engineer · **Source:** FR-PUB-3, UI_SPEC Category
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 03 / T04 — Category browse at
/category/[slug] (public, bilingual + themed). Branch feature/phase-03-catalog
(continue; git pull first).

STEP 0 — R-S07 consistency check (flagged expansion, justified by the T03 finding
that searchListings required stores!inner to exclude suspended stores):
- CONFIRM against BETK_PRD.md / BETK_ERD.md that a suspended store's listings are
  excluded from public catalog surfaces (R-S07's intent). Cite the line.
- PROBE live (staging, seeded + cleaned per T01 pattern): does getActiveListings
  return an active listing whose store is suspended? Does getHomepageData?
- If the leak is confirmed: fix the T01 queries (getActiveListings +
  getHomepageData strips) with the same stores!inner pattern T03 used —
  query-layer only, no RLS change — + a regression test per query. STATE the fix.
- getListingById (suspended store's listing detail): do NOT fix here — verify and
  FLAG the observed behavior for T05, which owns that page.

TASK — RSC at src/app/[locale]/(public)/category/[slug]/page.tsx (chrome from
the (public) layout, untouched):
- Resolve category by slug. is_active=false OR unknown slug → notFound() (hard 404).
- Subcategory chips from the category's children (names via localizedName
  COALESCE), linking to their category pages via @/i18n/navigation.
- ListingCard grid via getActiveListings({category}) (post-step-0 version) with
  the T01 cursor pagination; titles COALESCE; labels via catalogLabels builders;
  guest wishlist → login returnUrl (locale-preserving, T02 pattern).
- DESCENDANT-INCLUSION: CONFIRM against BETK_UI_SPEC.md §3 Category whether the
  grid includes descendant-category listings or exact-category only — do NOT
  assume; STATE which + the citation. If the spec doesn't pin it, implement
  exact-category and flag.
- Empty: "no active listings in {name} yet" + links to parent category (if any)
  + homepage — keyed copy both locales. Error: ErrorRetryCard.
- Copy via a category.* (or consistent) namespace in messages/{ar,en}.json —
  report parity count. generateMetadata via getTranslations, category name
  COALESCE'd into the title, both locales.

TESTS (integration, staging, seeded + cleaned): active category renders its
listings; inactive slug → 404; unknown slug → 404; subcategory chips assemble;
+ the step-0 regression tests if the fix landed.

VERIFY: typecheck · lint · 3 guards · test:unit · build (both locales). Runtime
smoke: /category/<seeded-slug> and /en/category/<seeded-slug> render grid/empty
in chrome, correct dir/lang; unknown slug hard-404s both locales.
No ui/* or shared/* edits (diff proof). No new policies, no service-role.
Close-out → SESSION_CONTEXT + journal → commit + push. HOLD for verdict — no PR,
main stays untouched until the T07 gate.
```
- **Files:** `src/app/(public)/category/[slug]/page.tsx`, components (composition).
- **Done when:** category page renders by slug; inactive/unknown → 404; subcategory chips; empty state. **Descendant-inclusion confirmed against spec, not assumed.**

---

## T05 — Listing detail (`/listing/[id]`)
- **Model:** Sonnet · **Skill:** skill-nextjs-engineer, skill-ui-engineer · **Source:** FR-PUB-4, UI_SPEC Listing Detail
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 03 / T05 — Listing detail at
/listing/[id] (public, bilingual + themed). Branch feature/phase-03-catalog
(continue; git pull first).

BINDING RULE (T04 finding): do NOT add loading.tsx at any segment wrapping this
route — it re-creates the soft-200 404 trap. Loading = in-page Suspense with the
kit skeletons only.

RSC at src/app/[locale]/(public)/listing/[id]/page.tsx via getListingById(id):
- null (missing/soft-deleted/removed) → notFound(), hard 404 both locales (R-L10).
- SUSPENDED-STORE ruling (T04 verified): a suspended store's listing resolves
  null via the stores_public null-guard → 404. Add an integration test proving it
  (seed suspended store + active listing → getListingById null + page 404).
- Compose: ImageGallery (≤5, hero sort_order=0 first) · title via COALESCE ·
  PriceBlock (all four price_type variants; quote_only hides quantity/price) ·
  StockBadge (product/service/made-to-order/sold_out) · tag chips ·
  SellerMiniCard (avatar/name/level/rating/avg response) · RatingSummary +
  recent visible reviews with photos + seller replies — REPO FACT (T01): reviews
  are STORE-scoped, not listing-scoped; render as the store's reviews, labeled
  accordingly (keyed copy) · "more from this store" rail (active listings, hide
  if none) — rail queries respect the T04 stores!inner convention if any new
  fragment is added.
- view_count (FR-PUB-4): CONFIRM the write mechanism against BETK_ERD.md. Anon
  cannot UPDATE listings under RLS. If no mechanism is pinned in the docs, FLAG
  and ship without incrementing — do NOT add a policy, do NOT silently
  service-role. STATE what you found + did.
- CTAs (entry points only, wiring is T06+): WishlistButton (guest → login
  returnUrl, locale-preserving, T02 pattern); sold_out → "notify me" restock
  CTA (R-N06, guest → login); InquiryButton + WhatsApp share link present as
  entry points (composer is a later phase).
- Copy via listing.* namespace both locales (report parity); generateMetadata
  via getTranslations with the COALESCE'd title, both locales.

TESTS (integration, staging, seeded + cleaned): active listing renders full
data · soft-deleted → null/404 · suspended-store listing → null/404 ·
quote_only hides price/qty · sold_out swaps CTA.

VERIFY: typecheck · lint · 3 guards · test:unit · build. Runtime smoke:
/listing/<seeded-id> + /en/listing/<seeded-id> render in chrome (correct
dir/lang); unknown id hard-404s BOTH locales (status code checked, not just
content — the T04 trap). No ui/* or shared/* edits (diff proof). No new
policies, no service-role. Close-out → SESSION_CONTEXT + journal → commit +
push. HOLD for verdict — no PR until the T07 gate.
```
- **Files:** `src/app/(public)/listing/[id]/page.tsx`, components (composition).
- **Done when:** detail renders full data; 404 on removed; price_type + stock variants correct; auth-gated CTAs route guests to login. **view_count mechanism confirmed/flagged, not improvised.**

---

## T06 — Storefront (`/store/[slug]`) + wishlist & follow actions
- **Model:** **Opus** (the 2 auth-gated writes touch RLS + the `store_follows` uniqueness/23505 path) · **Skill:** skill-security-reviewer, skill-nextjs-engineer · **Source:** FR-PUB-5, R-S07, UI_SPEC Storefront
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 03 / T06 — Storefront at /store/[slug] + the wishlist & follow Server Actions.

Storefront RSC via getStoreBySlug(slug): suspended (R-S07) / unknown slug → 404. Compose: cover+avatar; name ar/en; bio; verified + level badges; RatingSummary (avg+count+distribution); avg response; FollowButton; governorate/city; return-policy accordion; tabs Listings (filterable grid) / Reviews / About (payment & delivery from JSONB).

Two auth-gated Server Actions (Zod-validated, authenticated cookie client — public RLS + ownership):
- toggleWishlist(listingId): insert/delete wishlists for auth.uid(). The UI routes guests to login, but the action MUST also reject unauthenticated calls. wishlists has the wishlist_own policy (self INSERT/DELETE, hard-delete allowed) — verify the insert/delete works as the authenticated user; if unexpectedly default-denied, STOP and flag (do not add a policy).
- toggleFollow(storeId): insert/delete store_follows, UNIQUE(buyer_id,store_id) — catch the unique-violation (23505) at write time; idempotent toggle; never duplicate. store_follows self-scope policy (self INSERT/DELETE, hard-delete allowed) — same verify + STOP-and-flag rule.

Wire WishlistButton (cards + detail) and FollowButton (storefront) to these actions; reflect current membership + follower count.
Compose only otherwise. pnpm typecheck + lint clean (zod-coverage covers both actions).
Integration test: follow then unfollow (idempotent, no dup via 23505); wishlist add/remove; unauthenticated action rejected; suspended store → 404. Report whether wishlists/store_follows insert/delete worked under their existing policies (expected: yes).
Close-out → commit.
```
- **Files:** `src/app/(public)/store/[slug]/page.tsx`, `src/features/discovery/actions/{toggleWishlist,toggleFollow}.ts`, components (composition).
- **Done when:** storefront renders; suspended → 404; wishlist + follow toggle for authed users, reject guests, 23505-safe; membership + count reflected. Any unexpected default-deny surfaced, not patched.

---

## T07 — Phase 03 exit verification
- **Model:** **Opus** (review) · **Skill:** skill-security-reviewer · **Source:** Phase 03 Acceptance
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 03 / T07 — exit verification. Direct supabase binary.

PASS/FAIL ledger vs FR-PUB acceptance:
- Homepage: renders collections/categories/new-arrivals/boosted; section-level degradation; guest wishlist → login.
- Search: tsvector + Arabic unaccent; all URL filters; R-B04 boosted-above-organic (state the rule as implemented); soft-deleted/suspended excluded.
- Category: by slug; inactive/unknown → 404; descendant-inclusion per spec.
- Listing detail: full data; removed → 404 (R-L10); price_type + stock variants (R-L09); view_count mechanism (confirm how it landed).
- Storefront: by slug; suspended → 404 (R-S07); tabs render.
- Wishlist + follow: authed toggle, guest rejected, 23505-safe; report wishlists/store_follows policy behaviour.
- All public reads via anon client (NO service-role in features/app); 2 actions Zod-validated; CI green.
- Compose-only: no hardcoded colors; components/ui untouched; no forked shared components.

Block sign-off ONLY on hard failures (suspended store visible; soft-deleted listing visible; a write action default-denied & silently bypassed via service-role; search returns inactive listings; a Server Action missing Zod). Log doc/ops mismatches as corrections.
Write the Phase 04 entry checklist from Phase-03 carry-forwards + the standing items: (a) seller_profiles permissive ownership INSERT policy owed at Phase 04 become-seller; (b) requireVerifiedPhone() now consumable by Phase 04; (c) standing pre-launch carries — live OAuth consent E2E (#13), handset SMS delivery.
Update SESSION_CONTEXT (Last completed → Phase 03; Next → Phase 04 Seller Onboarding) + DEVELOPMENT_JOURNAL. Do NOT start Phase 04.
```
- **Done when:** all FR-PUB lines PASS or doc-corrected; no service-role leak; compose-only held; Phase 04 checklist written; signed off.

---

## Open dependencies into later phases (set up here / carried)
- `requireVerifiedPhone()` (Phase 02 T07) → consumed by Phase 04 become-seller, Phase 07 checkout, Phase 13 payout.
- **Phase 04** owes the permissive ownership INSERT policy on `seller_profiles` (RESTRICTIVE phone-gate only today → default-denied).
- **Phase 07** owes the same on `orders`.
- Standing pre-launch carries (NOT Phase 03 work): live Google OAuth consent E2E (#13, pre-launch Playwright); handset SMS delivery via TorvoSMS (THE blocking pre-launch item for phone-OTP).
- `decrement_stock_on_confirm` trigger (R-L05/06) still owed to `BETK_DATABASE_SCHEMA.sql` — relevant at Phase 07 order confirmation, not here.

## Phase 03 acceptance (from BETK_PHASES.md)
> FR-PUB acceptance criteria; search returns active+not-deleted; boosted ranking; suspended store hidden. Tests: integration (search/filter, RLS public read); E2E browse→listing→storefront. Docs: CACHING_STRATEGY, journal.
