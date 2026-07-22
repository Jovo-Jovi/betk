# PHASE 05 — Listings & Inventory (seller-side)

> Generated 2026-07-20 by the Phase-04 review chat after Phase 04 sign-off (PR #44 merged).
> Scope authority: `BETK_PHASES.md` Phase 05 = **FR-SEL-8..10 ONLY** (Listings Management, Create/Edit Listing, Stock & Inventory).
> **BOOSTS ARE PHASE 11** (FR-SEL-11/12) — the SESSION_CONTEXT Phase-05 entry-checklist header's "boost" mention is a
> recorded drift vs BETK_PHASES; nothing boost-related is built here. The Listings Management per-row "boost" action
> ships OMITTED (no dead route — the Phase-04 /seller landing-CTA precedent), wired in Phase 11.

Branch: `feature/phase-05-listings` cut from current `origin/main` (T01 step 0 folds in the owed Phase-04 post-merge
housekeeping if not already done: PR #44 containment-check + `feature/phase-04-seller` delete + SESSION_CONTEXT
merge-SHA record). One task per Cursor window; commits per task, pushed after each PASS verdict; `main` untouched
until the T06 gate PR. Migrations present (T01) → the R5 RLS-smoke job MUST fire on that PR.

---

## Binding rules (carried forward — hold all of them)

- **Compose, don't restyle.** `components/ui`/`components/shared` are Claude-Design-owned. Visual gaps → STOP-and-flag
  (T00 / CD-DELTA-5), never patch in-repo. `ui/*` additions ONLY via the official shadcn CLI, byte-vanilla (T00-LAND precedent).
- **Frozen scope (OD-1..7):** no new pages/tables/content columns. Additive migrations authorized ONLY where this pack
  says so (T01, and T02 only if ADR-013 lands on an rpc), each via MCP `apply_migration` (REG-24) + local-file rename to
  the MCP-recorded version + ledger↔local 1:1 re-verify + `BETK_DATABASE_SCHEMA.sql` source backfill.
- **Types (REG-32 lesson, now the standing procedure):** if any new `betk`-schema rpc lands, do NOT hand-add its
  signature to `src/lib/supabase/types.ts`. Add the migration, let CI's `types-drift` job produce the signature on the
  PR, apply its printed diff verbatim. Nullability of optional args = documented boundary cast at the call site
  (pg function-parameter metadata carries no nullability). `types.ts` stays generated-byte-identical, always.
- **Binding rules from Phase 03/04:** no `loading.tsx` at any segment wrapping a `notFound()`-capable route; pre-check
  SELECTs are UX-only, 23505/DB constraints are authoritative; hard-404s verified by status code; seller pages are
  dynamic (authed, cookie client, no ISR).
- **Advisor discipline:** post-apply sweep must be byte-identical to baseline (no new findings); any new fn =
  `SECURITY INVOKER` unless argued otherwise + `SET search_path` + EXECUTE revoked PUBLIC / granted authenticated.
- **i18n:** every screen bilingual via keyed copy, Guard D parity pasted per task; `generateMetadata` both locales.
- **PII:** listing images are PUBLIC content in the `media` bucket (uid-in-path = accepted id-not-PII posture) — no
  signed-URL machinery needed here; nothing from the `docs` bucket is touched in this phase.

## Data model (read before building — verify live, cite lines)

- `listings` — `store_id` (owner scope via `my_store_id()`), `category_id` NOT NULL (R-L01) + `subcategory_id`,
  `type` (product/service), `title_ar` NOT NULL (R-L03), `title_en` NULLABLE (REG-15: required at the FORM layer only),
  `description_ar` (as-authored, single language), `price`/`price_type` (fixed/per_hour/starting_from/quote_only),
  `stock_qty` NULLABLE (R-L09: services/made-to-order untracked), `is_made_to_order`, `low_stock_threshold`,
  `view_count` (STATIC — REG-26, no increment mechanism exists), `inquiry_count`, `status`
  (draft/active/paused/sold_out/removed — verify the exact enum), `deleted_at` (R-L10 soft delete — the ONLY
  soft-deleted table; historical `order_items` reference it), `search_vector` (maintained by the live
  `update_listing_search_vector` trigger — no app work).
- `listing_images` — `listing_id`, path/url, `sort_order` (hero = 0), ≤5 per listing. Public SELECT policy exists
  (REG-25 shape: parent `status IN ('active','sold_out')`); **owner-write policies DO NOT exist yet — T01 adds them.**
- `listing_tags` — `listing_id`, tag, ≤5 unique per listing (verify where the ≤5/uniqueness is enforced — DB
  constraint vs app layer; cite). Same public-SELECT-only situation → **T01 adds owner-write.**
- `restock_alerts` — RLS-enabled, ZERO policies, **owned by Phase 12 (notifications)** per the ERD §3 map. Phase 05
  does NOT add policies and does NOT read it (the inventory "buyers waiting" count is DEFERRED — see T05).
- `stores.payment_methods` — consumed by the R-S09 publish gate (T02). `categories` — read-only bilingual pickers.
- **Storage:** listing images reuse the existing PUBLIC `media` bucket, own-prefix writes (`${uid}/…`), public-read,
  `.list()` denied (T01-FIX-Phase-04). **No new bucket, expected zero storage-policy change — T01 verifies.**
- **Live triggers (5):** search_vector · decrement_stock_on_confirm (active→sold_out at 0 on order confirm, R-L06) ·
  recalculate_rating · review_edit_deadline · dispute_sla. **There is NO restock trigger** — R-L07 (restock→active)
  is app-layer, owned by this phase's stock-update action (T02). Verify and cite before implementing.

## Business rules referenced

- **R-L01** category required · **R-L02** ≥1 image to publish · **R-L03** Arabic title to publish ·
  **R-L04** category to publish · **R-S09** store has ≥1 payment method to publish (reads `stores.payment_methods`;
  the Phase-04 T07 banner comment points here — THIS is the enforcement point).
- **R-L06** stock 0 → sold_out (live trigger, fires on order confirm — not this phase's code, but this phase's pages
  must render its effects). **R-L07** restock → active (app-layer, this phase). **R-L09** services hide stock
  (stock fields hidden for `type='service'`; quote_only price handling per the Phase-03 `listingStockDisplay` rules).
- **R-L10** soft delete — `deleted_at`; removed listings 404 publicly, remain visible in the seller's "removed" tab.
  **CONFIRM the exact removal semantics from schema/ERD before coding** (status='removed' vs `deleted_at` vs both,
  and whether restore/un-remove is specced) — STOP-and-flag if the docs don't pin it.
- **REG-15** — bilingual title: `title_ar` + `title_en` BOTH required at the Zod/form layer; `title_en` stays
  nullable in DB (no schema change). Closed by T02 (schema) + T04 (form) together.
- **REG-26** — `view_count` static (no increment mechanism); the listings table's "views" column renders the raw
  value with this documented. Stays OPEN unless a later phase specs the mechanism.

## Register items owned / touched by this pack

- **Listing-children owner-write policies** (entry-checklist debt, discovered at Phase-04 T08): T01 mints **REG-34**
  (4th instance of the #14/REG-29/REG-31 class — ERD-specced policies omitted from the Phase-01 SQL) and closes it
  with the migration + evidence.
- **REG-15** → closed by T02+T04 with evidence. **REG-26** → restated, stays open. **REG-24/30/32-procedure** → standing.
- Boost-related register work: NONE (Phase 11).

---

## Task list

| Task | Surface | Model | What |
|---|---|---|---|
| T00 | **Claude Design** (CD project, new chat) | — | CD-DELTA-4: Tabs + Phase-05 kit coverage gate |
| T01 | Cursor | **Opus** | DB & RLS foundation (REG-34 children owner-write, restock_alerts deferral, media reuse verify) |
| T02 | Cursor | **Opus** | Listing write layer — queries + Server Actions (ADR-013 atomicity decision, publish gate, stock/restock) |
| T03 | Cursor | Sonnet | Listings Management page `/seller/listings` (Tabs, filters, row actions, nav extension) |
| T04 | Cursor | Sonnet | Create/Edit Listing form `/seller/listings/new` + `/[id]/edit` |
| T05 | Cursor | Sonnet | Stock & Inventory `/seller/inventory` |
| T06 | Cursor | **Opus** | Phase exit verification + consolidated PR prep |

Sequence: T00 gates T03–T05 (UI tasks) only; T01→T02 may run before/parallel to T00's emission.

---

## T00 — CD-DELTA-4 (Claude Design: Tabs + Phase-05 coverage gate)
- **Model:** Claude Design (new chat in the existing CD project; standing emit-time self-audit; brief = sole value source)
- **Prompt (canonical — prepend your standing CD context line + attach the current brief):**
```
CD-DELTA-4 — Phase-05 kit gate + perf-UX polish. Read this state sync first,
then emit the delta as a standard repo-handoff package.

=== STATE SYNC (bring your context current — authoritative facts) ===
- Visual source of truth: docs/00-design/BETK_DESIGN_BRIEF.md — LOCKED,
  self-contained (DESIGN-SYNC rewrite + BRIEF-SYNC addenda). Token names
  frozen: 41 color tokens incl. the --info pair + 4 footer additives; values
  change only via the brief. §9 OPEN ITEMS records: font-fallback proposal
  (unapplied), 4 unrouted footer links, REG-23 repo pointer, LOGO-SYNC.
- Shared kit on main = 35 files: the 21 catalog components + DS-REGEN's 10
  (AppTopbar, MobileBottomNav, ConsoleSidebar, Toaster, ConfirmDialog,
  MessageThread, OrderTimeline, ImageUploader, AddressForm, SLABadge) +
  Footer (CD-DELTA-1) + Stepper/Toggle/Alert (CD-DELTA-3). ui/* = 13 vanilla
  shadcn files (button badge card input select skeleton sheet dialog avatar
  sonner switch alert textarea). All prior deltas landed byte-verified.
- DS-I18N contract holds: strings arrive as props, Arabic defaults preserved;
  RTL-canonical logical props only; token-only colors (hsl(var(--…))
  composition allowed per StoreCard precedent); shadows via --shadow-* scale.
- Since CD-DELTA-3, ZERO shared/ui edits happened (Phase-04 pages + a PERF
  batch composed at the app/feature layer only). App now has: streaming
  Suspense on category/store using CatalogSkeletons; ISR on category/listing;
  a locale-toggle pending state applied one level ABOVE AppTopbar because its
  API can't express it (item 4 below fixes that).
- Consumers coming in Phase 05: Listings Management table/tabs, Create/Edit
  Listing form, Stock & Inventory. Boosts are Phase 11 — nothing boost-styled.

=== DELIVERABLES (additive-only; nothing renamed/removed) ===
1. Tabs — Brief §5.12. New shared component, frozen API, token-only,
   RTL-canonical, string-prop labels (id + label per tab), controlled +
   uncontrolled modes, keyboard nav, badge/count slot per tab (Listings
   Management shows per-status counts). First consumer: Phase-05 T03 status
   filter tabs (all/active/draft/paused/sold_out/removed). Decide + document
   whether it wraps a new ui/tabs (vanilla shadcn CLI add, sanctioned like
   switch/alert/textarea) or is hand-rolled like StorefrontTabs — state the
   choice in the CHANGELOG.
2. REG-38 — route-transition feedback polish: (a) skeleton variants for
   category / listing-detail / storefront transitions, extending
   CatalogSkeletons (§5.24) as needed — additive exports only; (b) a design
   DECISION on a global navigation pending indicator (e.g. top progress bar):
   if adopted, emit it as a token-only component + anatomy addendum; if
   declined, record the decline in the CHANGELOG so the item closes either way.
3. REG-39 — the 8 category icon SVGs at exactly these public paths:
   /icons/categories/{clothing,food,home,beauty,jewelry,arts,books,services}.svg
   Constraint: rendered via <img> (CSS vars do NOT reach inside), so design
   them theme-neutral — a palette that reads on both light --card and dark
   --card backgrounds (or ship a single-color glyph that works on both).
   Brand-consistent with the ب mark language. These replace a Lucide fallback
   currently shipping (REG-39 stopgap).
4. AppTopbar API addition (additive props only, zero visual change when
   unset): the language toggle button needs pending-state support —
   langButtonDisabled?: boolean (or langPending?) that disables the button,
   sets aria-busy, and applies a token-only pending treatment (opacity-60 +
   cursor-progress class internally). Existing props/JSX byte-preserved;
   this lets the app move the PERF-01 pending affordance onto the button
   itself. Update §5.13 anatomy line accordingly.
5. OPTIONAL / DECISION-ONLY — REG-18: StatusBadge's flag domain (moderation:
   pending/reviewed/actioned/dismissed) has tint colors but no Arabic labels
   (DEFAULT_LABELS is Partial). Decide now while we're here: author the 4 AR
   labels (component change, additive) or formally keep-partial until the
   admin phase. Record the decision either way; no pressure to change code.

=== PACKAGE FORMAT ===
docs/handoff/cd-delta-4/ with: templates/repo-handoff/ (exact final files:
new shared components, edited AppTopbar, edited/extended CatalogSkeletons,
barrel index.ts as a strict superset, the 8 SVGs under public/icons/
categories/), CHANGELOG-DELTA.md (per-file rationale, the Tabs ui-vs-handroll
decision, the REG-38b indicator decision, REG-18 decision, any message-key
NAMES Cursor should wire — Cursor owns the ar/en catalog entries), and any
brief addenda text (§5.12 anatomy, §5.13 update, §5.24 extension) marked
"addendum — sanctioned CD-DELTA-4". Cursor lands byte-diff-verified and does
all data/i18n wiring; you never wire.
```
**landing prompt:**
```Read SESSION_CONTEXT.md, then execute Phase 05 T00 — CD-DELTA-4 LAND + wire
(flagged expansion of the pack's T00: delta scope grew beyond Tabs). Branch
feature/phase-05-listings (git pull first; confirm on top of 2870f0f).
Sonnet. Handoff root: docs/handoff/cd-delta-4/pkg/cd-delta-4/ (note the pkg/
nesting from extraction).

STEP 1 — CLI ADD (vanilla, T00-LAND precedent):
npx shadcn@latest add tabs → creates exactly src/components/ui/tabs.tsx,
byte-vanilla, new dep @radix-ui/react-tabs; zero touch to the existing 13
ui/* files.

STEP 2 — LAND SHARED (byte-diff-verified):
From <root>/templates/repo-handoff/src/components/shared/ copy Tabs.tsx +
RouteProgress.tsx (new) and overwrite CatalogSkeletons.tsx + AppTopbar.tsx +
index.ts (full edited files). git diff --no-index against each template =
EMPTY for all 5. Then TWO API-freeze checks vs main:
- git diff main -- AppTopbar.tsx: the ONLY change must be the additive
  langPending prop + its internal disabled/aria-busy/pending classes — every
  pre-existing prop/JSX byte preserved. If anything else changed, STOP.
- CatalogSkeletons.tsx diff vs main: additive exports only (the 3 new
  route-transition skeletons); nothing renamed/removed.

STEP 3 — LAND ASSETS:
Copy the 8 SVGs to public/icons/categories/{clothing,food,home,beauty,
jewelry,arts,books,services}.svg (exact seeded paths). The #1c8d7e literal
inside the SVGs is SANCTIONED (asset files — CSS vars can't reach <img>);
do NOT flag it.

STEP 4 — SWEEPS (shared .tsx files only, SVGs exempt):
Raw-color sweep (#/rgb(/raw hsl(/text-white etc.) + physical-RTL sweep
(left-/right-/ml-/mr-/pl-/pr-/text-left/right) across Tabs/RouteProgress/
CatalogSkeletons/AppTopbar = zero matches expected. Any hit → STOP-and-flag.

STEP 5 — APP WIRING (feature/app layer only; this is the expansion):
(a) RouteProgress: mount per the CHANGELOG's guidance at the app layer (the
    chrome shells / [locale] layout — state exactly where and why). Renders
    null at rest; must appear in both public and seller shells.
(b) langPending: AppChrome passes langPending={isPending} (the PERF-01
    useTransition state) to AppTopbar; REMOVE the PERF-01 wrapper workaround
    (opacity-60 + pointer-events-none div) IF the button now fully expresses
    the pending state — state the decision. LanguageSwitcher (account)
    unchanged.
(c) REG-39 close: remove the resolveIconUrl stopgap filter in
    HomeCategoryGrid so the real icon_url paths render again; delete its
    REG-39 comment.
(d) Wire any message-key NAMES the CHANGELOG lists for Tabs/RouteProgress
    into messages/{ar,en}.json (Cursor owns the ar/en entries) — parity
    guard must stay green. If the CHANGELOG lists none, state so.

STEP 6 — BRIEF ADDENDA (docs):
Apply <root>/brief-addenda.md into docs/00-design/BETK_DESIGN_BRIEF.md
(§5.12 Tabs anatomy, §5.13 langPending line, §5.24 skeleton extension), each
marked "addendum — sanctioned CD-DELTA-4" (BRIEF-SYNC precedent). Also record
the REG-18 keep-partial decision where §5.5/§7 references it.

STEP 7 — CLEANUP BEFORE VERIFY:
Delete docs/handoff/cd-delta-4/ entirely (tsconfig broad-glob shadowing —
CD-DELTA-1/3 precedent); confirm zero residue in git status.

VERIFY (all green, paste evidence):
typecheck · lint (no new warnings) · 4 guards (paste new i18n parity count) ·
test:unit · build (both locales; route count unchanged) · runtime smoke
(next start): homepage renders the 8 real SVGs — page HTML references
/icons/categories/*.svg and each returns 200, zero Lucide fallbacks for the
8 top-level categories; locale toggle pending state now on the button itself
(aria-busy present when pending — structural proof from code acceptable);
RouteProgress mounted (present in HTML at rest as null/empty is fine — cite
the mount point); category-page streaming skeletons unaffected.

GUARDS (git diff origin/main --stat):
-- src/components/ui → exactly 1 new file (tabs.tsx), zero modified;
-- src/components/shared → exactly Tabs.tsx + RouteProgress.tsx (new),
   CatalogSkeletons.tsx + AppTopbar.tsx + index.ts (modified);
-- src/features + src/app → only the STEP-5 wiring files, each listed.

CLOSE: SESSION_CONTEXT.md — REG-38 CLOSED (leg 1 PERF-01, leg 2 landed+wired
here incl. the AppTopbar API gap), REG-39 CLOSED (real assets live, stopgap
removed), kit = 37 shared files + 14 ui/*, T03–T05 gate OPEN; journal append;
pack tracker T00 row. Commit per logical step (CLI add / land / wiring /
docs), push. HOLD — do not start T02/T03; T01 runs in its own window if not
already done.
```
- **Done when:** walk covers all 3 screens; every gap emitted-or-deferred-with-owner; Tabs emitted on the two-layer
  pattern (vanilla base + kit component); paste the walk to the review chat before confirming emission.

## T01 — DB & RLS foundation
- **Model:** **Opus** · **Skill:** skill-supabase-engineer, skill-security-reviewer
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 05 / T01 — DB & RLS foundation.
STEP 0 (git): git fetch; if Phase-04 post-merge housekeeping is still owed,
do it now (feature/phase-04-seller containment-check vs origin/main → delete
local+remote; record the PR #44 merge SHA + Phase 04 SIGNED OFF in
SESSION_CONTEXT). Cut feature/phase-05-listings from origin/main.

STEP 1 (read-only, live pg_policies vs ERD §3, command-by-command — the
REG-31 lesson: audits miss command-level gaps): listings (expect
listings_seller PERMISSIVE ALL + listings_public SELECT w/ the REG-25
IN('active','sold_out') shape); listing_images + listing_tags (expect
public SELECT ONLY → owner-write ABSENT = the entry-checklist debt);
restock_alerts (expect ZERO policies — Phase-12-owned, VERIFY + DO NOT FIX);
categories (public read). Paste the verbatim compare.

STEP 2: mint REG-34 (listing_images/listing_tags owner-write absent — 4th
#14/REG-29/REG-31-class instance; the ERD §3 rows spec owner write via
listing) and close it with ONE additive migration: parent-scoped owner-write
policies on BOTH tables (INSERT/UPDATE/DELETE via the owning listing's
store = my_store_id(), or FOR ALL if that is the ERD-verbatim shape — cite
the ERD row and follow it exactly; the public SELECT policies are untouched
and OR-combine). No policies on restock_alerts. Apply per REG-24 (MCP →
rename local file → ledger 1:1 re-verify, expect 25→26, paste) → backfill
BETK_DATABASE_SCHEMA.sql. Advisor sweep = baseline, no new findings.

STEP 3 (storage — verify only, expected ZERO change): listing images reuse
the media bucket own-prefix INSERT/UPDATE + public-read + .list()-denied
policies as-is. Confirm nothing new is needed; if something IS needed,
STOP-and-flag with the specific gap — do not improvise a policy.

TESTS (integration, staging, minted seller + a second seller, seeded+cleaned,
zero residue): owner INSERT/UPDATE/DELETE on own listing's images+tags pass;
cross-seller writes on another store's listing DENIED; anon writes DENIED;
public SELECT of an active listing's children still works (no regression);
draft listing's children still hidden from anon. typecheck · lint · 4 guards
· test:unit · build. Close-out (REG-34 minted+closed; restock_alerts
deferral stated) → commit + push. HOLD — do not start T02.
Env: Windows/PowerShell — no &&. No credentials in output or chat.
```
- **Done when:** REG-34 closed ERD-verbatim with both-direction proofs; ledger 1:1; restock_alerts untouched+stated;
  storage verified zero-change; guards green.

## T02 — Listing write layer (queries + Server Actions; UI is T03–T05)
- **Model:** **Opus** · **Skill:** skill-supabase-engineer, skill-security-reviewer
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 05 / T02 — listing write layer.
Branch feature/phase-05-listings (continue; git pull first).

DECISION FIRST — ADR-013 (create/publish atomicity; record in ADR.md next
free slot, confirm the number): a full create touches listings +
listing_images rows + listing_tags rows. Evaluate against the ADR-012
precedent: (a) DRAFT-FIRST DECOMPOSITION — insert the listing as
status='draft' (single-table, atomic); image/tag rows added as independent
single-row writes (a draft with partial children is a VALID state — publish
validation is what requires completeness); publish = a validated
single-table status UPDATE draft→active. If this holds, NO rpc is needed —
state that as the ADR-013 outcome. (b) an INVOKER rpc if (a) fails on a
concrete requirement (cite it). If (b): additive migration per REG-24 +
the REG-32 types procedure (NEVER hand-add the signature — CI types-drift
produces it on the PR; budget the boundary-cast iteration).

ACTIONS (src/features/listings/, "use server", Zod each, requireActiveUser
R-A05, own-store scope = RLS listings_seller + server-verified
my-store check; check-zod-coverage must cover all):
- createListing (draft) / updateListing — REG-15 in the Zod schema:
  title_ar AND title_en BOTH required (min 1) at the form layer; DB stays
  nullable (no schema change). description_ar as-authored. category +
  subcategory (R-L01). price/price_type (4 variants; quote_only → price
  null per the Phase-03 display rules). R-L09: type='service' → stock
  fields stripped/null server-side regardless of client input. Tags ≤5 —
  cite where uniqueness/≤5 is DB-enforced vs app-enforced; app validates
  either way, DB constraint (if present) is authoritative via its error.
- addListingImage/removeListingImage/reorderImages (or a consolidated
  images action): rows under the T01 owner-write RLS; storage path must be
  under the caller's own media-bucket prefix (server-side re-check, the
  T03-Phase-04 contract); ≤5 enforced; hero = sort_order 0.
- publishListing: validates R-L02 (≥1 image) + R-L03 (title_ar) + R-L04
  (category) + R-S09 (stores.payment_methods has ≥1 method — THE
  enforcement point the Phase-04 T07 banner comment cites) → flips
  draft→active. Each failed requirement returns a field-level reason (the
  UI renders the checklist). pause/unpause = active↔paused.
- softDeleteListing: R-L10 — CONFIRM the exact semantics from schema/ERD
  BEFORE writing (deleted_at vs status='removed' vs both; restore specced
  or not) — STOP-and-flag if unpinned. Children rows are NOT deleted
  (historical references).
- updateStock (consumed by T05): sets stock_qty; R-L07 — CONFIRMED no
  restock trigger exists, so the SAME statement/action flips a sold_out
  listing back to active when new stock > 0 (cite the no-trigger check);
  restock ALERT dispatch (R-N06) is Phase 12 — do NOT touch
  restock_alerts.
QUERIES: getOwnListings (status filter + cursor/offset per the T03 table
needs), getOwnListingById (edit-form load), getOwnInventory (stock view).
Sentry 'listings' id-only + PostHog events. search_vector: verify the
trigger maintains it on insert/update (test), zero app work.

TESTS (integration, staging, minted+cleaned, zero residue): draft create →
children add → publish happy path (row counts, status flip, search_vector
non-null); publish blocked per-requirement (no image / no title_en at Zod /
no category / NO PAYMENT METHOD — seed a store with empty payment_methods,
prove R-S09 bites HERE); service stock stripped (R-L09); tags >5 rejected;
image path outside own prefix rejected; soft delete → anon getListingById
null (R-L10, reuse the Phase-03 query as the public-side proof) + still in
owner reads; updateStock 0→sold_out is the TRIGGER's job (not asserted
here) but restock sold_out→active via updateStock IS asserted; cross-seller
writes denied. typecheck · lint · 4 guards · test:unit · build. Close-out
(ADR-013 + REG-15-schema-half + the R-L10 cited semantics) → commit + push.
HOLD — do not start T03.
Env: Windows/PowerShell — no &&. No credentials in output or chat.
```
- **Done when:** ADR-013 recorded (decomposition or rpc, cited); publish gate proves all 4 requirements incl. R-S09;
  REG-15 Zod half landed; R-L07 app-layer flip cited+proven; R-L10 semantics cited-or-STOPped; guards green.

## T03 — Listings Management `/seller/listings`
- **Model:** Sonnet · **Skill:** skill-nextjs-engineer
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 05 / T03 — /seller/listings.
Branch feature/phase-05-listings (continue; git pull first). LAND
CD-DELTA-4 FIRST (part A): CLI-add the vanilla base per its CHANGELOG, land
the kit Tabs (byte-diff vs template EMPTY), independent raw-color +
physical-RTL re-sweep, barrel superset, delete docs/handoff/cd-delta-4/.
Guards: ui diff = exactly the CLI adds; shared diff = exactly the delta.

PAGE (seller shell, dynamic/authed, compose-only): listings table/grid via
getOwnListings — thumb (hero image), COALESCE title, type, price
(PriceBlock), stock, StatusBadge, views (REG-26: static value, render
as-is), inquiries. Status filter tabs via the NEW kit Tabs:
draft/active/sold_out/paused/removed per the UI_SPEC + the T02-cited R-L10
semantics for the removed tab. Row actions: edit → /seller/listings/[id]/
edit; pause/unpause (T02 action); delete via ConfirmDialog → soft delete.
BOOST action OMITTED (Phase 11 — no dead route; state in close-out).
New-listing CTA → /seller/listings/new. Pagination per the T02 query shape.
Empty state per spec. NAV: extend SellerChrome (app layer) with listings +
inventory items (in-scope routes now exist/land this phase; console.* keys
both locales).

i18n seller.listings.* both locales (paste parity). generateMetadata.
VERIFY: typecheck · lint · 4 guards · test:unit · build · runtime smoke
both locales (tabs render + filter, table populated via seeded data or the
honest empty state, nav items present, theme wiring). Zero ui/*/shared/*
edits beyond the CD-DELTA-4 land (diff proof). Close-out → commit + push.
HOLD — do not start T04.
Env: Windows/PowerShell — no &&. No credentials in output or chat.
```
- **Done when:** CD-DELTA-4 landed byte-verified; all 5 status tabs filter correctly; boost omitted+stated; nav
  extended; parity pasted; guards green.

## T04 — Create/Edit Listing `/seller/listings/new` + `/[id]/edit`
- **Model:** Sonnet · **Skill:** skill-nextjs-engineer
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 05 / T04 — the listing form.
Branch feature/phase-05-listings (continue; git pull first). Compose-only;
kit (Toggle/Textarea/Alert/Tabs as needed) + ImageUploader + ui primitives
+ the established Field wrapper pattern.

ONE form component, two routes (new = empty defaults; edit = getOwnListingById
prefill; unknown/other-store id → hard notFound(), status-code-verified,
no loading.tsx on the segment). Fields per UI_SPEC: type toggle
(product/service — service HIDES stock fields, R-L09, and the server strips
them anyway); title_ar + title_en BOTH required (REG-15 — mirror the T02
Zod via .pick, single source); description_ar; category + subcategory
(bilingual pickers); PriceBlock-composed price + price_type (4 variants,
quote_only disables price input per the Phase-03 display rules);
stock_qty / is_made_to_order / low_stock_threshold (products only);
custom-order toggle + notes; tags ≤5 (chip input); per-listing delivery
override IF the schema carries it — verify, cite, omit if absent (do not
invent a column); ImageUploader ≤5 ordered, hero = sort_order 0, uploads
to the MEDIA bucket under the caller's own prefix (public URLs; reorder
supported per the component contract).

SAVE-DRAFT vs PUBLISH: draft skips publish validation (T02 decomposition);
publish renders the inline REQUIREMENT CHECKLIST from the action's
field-level reasons (image/title/category/payment-method), the R-S09 miss
linking to /seller/store/payments. Per-image upload retry. i18n
seller.listings.form.* both locales (paste parity). generateMetadata both
routes. VERIFY: typecheck · lint · 4 guards · test:unit · build · runtime
smoke both locales (new + edit prefill + the publish-blocked checklist
rendering, via seeded data). Zero ui/*/shared/* edits. Close-out (REG-15
CLOSED — schema half T02 + form half here, with evidence) → commit + push.
HOLD — do not start T05.
Env: Windows/PowerShell — no &&. No credentials in output or chat.
```
- **Done when:** both routes live; REG-15 closed with evidence; R-L09 hide+strip proven; publish checklist renders
  every failed requirement incl. the R-S09 link; guards green.

## T05 — Stock & Inventory `/seller/inventory`
- **Model:** Sonnet · **Skill:** skill-nextjs-engineer
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 05 / T05 — /seller/inventory.
Branch feature/phase-05-listings (continue; git pull first). Compose-only.

PAGE (seller shell, dynamic): stock table via getOwnInventory — listing,
current stock, low_stock_threshold, StatusBadge; INLINE stock edit wired to
the T02 updateStock action (optimistic + toast); LOW-STOCK highlight =
DERIVED at render (stock_qty <= low_stock_threshold — OD-1, NO
inventory_alerts table, cite it); restock action on sold_out rows
(updateStock with qty>0 → the T02 app-layer flip to active — prove in the
smoke); made-to-order rows show the "unlimited" indicator; services-only
store → the spec empty state. "BUYERS WAITING" COUNT = DEFERRED:
restock_alerts is RLS-default-deny and Phase-12-owned — render WITHOUT the
count, one code comment citing the deferral + Phase 12; do not add a
policy, do not service-role around it.

i18n seller.inventory.* both locales (paste parity). generateMetadata.
VERIFY: typecheck · lint · 4 guards · test:unit · build · runtime smoke
both locales (inline edit round-trip, low-stock highlight on a seeded
threshold-crossing row, restock flips a seeded sold_out row to active).
Zero ui/*/shared/* edits. Close-out → commit + push. HOLD — do not start
T06.
Env: Windows/PowerShell — no &&. No credentials in output or chat.
```
- **Done when:** inline edit + restock flip proven live; low-stock derived (cited, no invented table); buyers-waiting
  deferred+commented; guards green.

## T06 — Phase 05 exit verification + consolidated PR prep
- **Model:** **Opus** · **Skill:** skill-security-reviewer, skill-ui-reviewer
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 05 / T06 — exit verification +
PR prep. Verification + docs + push; ZERO feature-code changes (trivial-
and-safe stated, else FLAG). The human opens + merges the PR.

1. DoD LEDGER (PASS/FAIL + evidence per line): R-L01..04 publish gates
   (each independently blocking); R-S09 proven AT PUBLISH (empty
   payment_methods store blocked, link rendered); REG-15 both-titles at
   Zod+form, DB nullable untouched; R-L09 service stock hidden AND
   server-stripped; R-L06 trigger interplay (see E2E); R-L07 app-layer
   restock flip; R-L10 soft delete per the T02-cited semantics (owner
   sees removed tab, public 404s); REG-34 closed ERD-verbatim; tags ≤5;
   images ≤5 + hero ordering; media own-prefix enforced server-side;
   search_vector maintained; boost surfaces ABSENT (Phase 11, stated);
   binding rules held (no loading.tsx/notFound trap re-checked on the
   edit route; 23505/constraints authoritative; compose-only diffs).
2. E2E LIFECYCLE (staging, seeded+cleaned, ZERO residue pasted): seller
   creates draft → children → publish (all gates green) → listing PUBLIC
   at /listing/[id] + in the storefront grid (Phase-03 read side proves
   the write side) → seed an order + service-role confirm → the R2
   decrement trigger fires → stock 0, status sold_out → PUBLIC detail
   still renders w/ restock CTA (REG-25 interplay proven end-to-end) +
   ABSENT from browse → seller restocks via updateStock → active again,
   back in browse → soft delete → public 404 + owner removed-tab.
   Negative sweep: cross-seller writes, publish-gate misses, >5
   images/tags, outside-prefix path.
3. DB LIVE STATE (MCP): pg_policies for listings+children ERD-verbatim
   (REG-34 shape); ledger 1:1 (paste count); advisor sweep = baseline;
   any ADR-013 rpc = INVOKER + hardened.
4. BILINGUAL/THEME: 3 screens AR+/en spot-checked; Guard D parity pasted;
   dark = wiring-verified footnote; UI_SPEC acceptance matrix rows marked.
5. REGISTER + DOCS: REG-15/34 closed w/ evidence; REG-26 restated
   (views static); correct the SESSION_CONTEXT Phase-05 entry-checklist
   header ("boost" → Phase 11, the BETK_PHASES drift); PHASE-06 ENTRY
   CHECKLIST written (inquiries/inquiry_messages policies per the ERD
   map; confirm→checkout enablement contract for Phase 07;
   avg_response_hours mechanism — cite or flag; R-N04 notify ≤5s
   dependency on the notifications infra); ADR.md; schema source; this
   pack's tracker; SESSION_CONTEXT + journal.
6. CI + PUSH (no PR creation): full suite + build both locales. Push.
   Paste the PR title "Phase 05: Listings & Inventory (T01–T05 +
   REG-34)" + body (scope, migrations by version, register deltas,
   RLS-smoke MUST-fire note, types-drift note if an rpc landed). STOP.
Env: Windows/PowerShell — no &&. No credentials in output or chat.
```
- **Done when:** every DoD line verdicted; the create→publish→sell-out→restock→remove lifecycle proven end-to-end
  against the Phase-03 public read side; PR prepped; merge held for the human.

---

## Definition of Done (phase)

- A seller creates a draft, completes it, and publish is blocked until ALL of R-L02/03/04 + R-S09 hold — then the
  listing is publicly visible through the Phase-03 surfaces (detail + browse + search_vector match).
- REG-15 closed: both titles required at the form/Zod layer; `title_en` nullable in DB, untouched.
- REG-34 closed ERD-verbatim: children owner-write live, both-direction tested; public reads unregressed.
- R-L06 (trigger) + R-L07 (app-layer restock) + R-L10 (cited soft-delete semantics) proven in one end-to-end
  lifecycle; REG-25 sold_out interplay holds from the seller side.
- R-L09: services never carry stock — hidden in UI AND stripped server-side.
- Inventory low-stock is derived (OD-1); buyers-waiting deferred to Phase 12 with a cited comment.
- No boost surface exists (Phase 11); no dead routes; nav extended only with live routes.
- Every screen bilingual + theme-wired; migration ledger 1:1; schema source backfilled; consolidated PR open with
  RLS-smoke fired; `main` untouched until the gate verdict.

## Docs to update
`ADR.md` (ADR-013) · `BETK_DATABASE_SCHEMA.sql` (REG-34 backfill + any rpc) · `SESSION_CONTEXT.md` ·
`DEVELOPMENT_JOURNAL.md` · `BETK_UI_SPEC.md` acceptance matrix · this pack's results tracker.

## Results tracker

| Task | Model | Status | Commit | Verdict | Notes |
|---|---|---|---|---|---|
| T00 CD-DELTA-4 | CD emit + Sonnet LAND | ✅ LANDED+WIRED (2026-07-21) | `feature/phase-05-listings` | PASS | Tabs (+vanilla `ui/tabs`) + RouteProgress + 3 route skeletons + `langPending` + 8 SVGs; REG-38 & REG-39 CLOSED; kit = 37 shared + 14 ui/*; i18n 530/530; T03–T05 gate OPEN |
| T01 DB+RLS | Opus | ✅ DONE (2026-07-21) | `feature/phase-05-listings` | PASS | REG-34 minted+closed ERD §3-verbatim — migration `20260721111355_listing_children_owner_write_rls` adds `listing_images_seller`/`listing_tags_seller` (FOR ALL, parent-scoped, mirrors `listings_seller`); public SELECT untouched (OR-combines); ledger 25→26 (1:1); schema.sql backfilled; advisor = baseline (0 new). `restock_alerts` verified zero-policy + NOT touched (Phase 12). Storage verified zero-change (media own-prefix reuse; no DELETE policy by design). Integration 7/7 on staging (owner CRUD + own-draft read; cross-seller/anon denied; public read unregressed; draft hidden), zero residue. typecheck·lint·4 guards (i18n 530/530)·unit 82/82·build 34 routes ✓ |
| T02 write layer | Opus | ✅ DONE (2026-07-21) | `feature/phase-05-listings` | PASS | **ADR-013 = DRAFT-FIRST DECOMPOSITION (NO rpc/migration)** — create=single-table INSERT `status='draft'`; children (images/tags) = independent RLS single-row writes; partial-child draft is VALID; publish = validated `draft→active` UPDATE gated by `evaluatePublishRequirements` (R-L02/03/04+R-S09). **FLAG-1** media NO-DELETE: `removeListingImage` deletes row only, storage object retained (post-MVP cleanup NOTE, not built). **FLAG-2** REG-15 SCHEMA HALF closed — `titleAr`+`titleEn` both required in `src/validations/listings.ts`; `title_en` nullable in DB unchanged; T04 mirrors. R-L07 restock flip + R-L10 (removed+deleted_at) app-layer, cited. NO service-role; twice-scoped ownership (RLS + own-store pin); every action Zod-gated + discriminated-union return. typecheck·lint·4 guards (zod-cov 24, i18n 530/530)·unit 102/102·build 34 routes ✓; integration 10/10 on staging (create/service-strip/images/publish±R-S09/soft-delete/restock/cross-seller-deny), zero residue |
| T03 listings page | Sonnet | ✅ DONE (2026-07-22) | `feature/phase-05-listings` | PASS | `/seller/listings` — compose-only, consumed the T00-pre-wired `seller.listings.filter.*` keys verbatim (no dupes) + the CD-DELTA-4 kit `Tabs` (pill variant, per-tab `count`) as-is (already landed by its own T00 task — no re-land needed); 6 tabs (all+5 statuses), URL-driven (`?status=&page=`, search-page precedent, no ISR concern). New additive query `getOwnListingsStatusCounts` (5 head-only exact counts) for the tab badges — sibling to T02, zero edits to T02's files beyond the barrel. Table (responsive grid→stacked-card) via `getOwnListings`: thumb/COALESCE title (`localizedName`)/type/`PriceBlock`/stock (R-L09 "—" for services)/`StatusBadge`(reusing `filter.*` as status labels)/views (REG-26 static, rendered as-is)/inquiries; row actions edit/pause/unpause (T02 actions, imported directly not via barrel — DeliverySettingsForm precedent, avoids leaking `next/headers` into the client bundle)/delete via `ConfirmDialog`→`softDeleteListing`. BOOST omitted (Phase 11, stated). **FLAGGED (repo-state, additive to the canonical prompt): NAV — extended `SellerChrome` with `listings` ONLY** (not `inventory` — T05 hasn't run, no dead link); `console.nav.listings` both locales. Empty state (default + filtered) + New-listing CTA → `/seller/listings/new` (T04 target, forward reference within this same phase). i18n `seller.listings.*` +37 leaf keys (1 nav + 36 page) both locales, parity 530→567/567. Zero `ui/*`/`shared/*` edits (diff-confirmed). Full CI green (typecheck·lint 7 img+10 console pre-existing baseline zero-new·4 guards[zod-cov 24, i18n 567/567]·unit 102/102·build 36 routes both locales) + runtime smoke both locales via a minted-seller+seeded-listings staging script (throwaway, deleted before commit): unauth→307 login; AR/EN 200 with correct dir/lang; all 6 tabs' status filtering proven live (all/draft/removed checked); nav label + page title + service type label rendered; empty + filtered-empty states proven on a zero-listing seller. |
| T04 listing form | Sonnet | ✅ DONE (2026-07-22) | `feature/phase-05-listings` | PASS | `/seller/listings/new` + `/[id]/edit` — ONE form component, compose-only. **REG-15 FULLY CLOSED** (schema half T02 + form half here): `titleAr`+`titleEn` both required inputs, hand-mirrored client `validate()` of the T02 Zod shape; `title_en` stays nullable in DB. **5 repo-state FLAGS applied:** (1) images — browser-client upload to MEDIA under the caller's own prefix + per-file retry, client ≤5 cap UX-only (action's `limit_reached` authoritative), remove = row-delete only (storage object retained, FLAG-1, no DELETE improvised); (2) T02 actions imported by file path, not the barrel (T03 precedent); (3) publish CTA routes every outcome — `unmet_requirements` checklist with the R-S09 line linking to `/seller/store/payments` (locale-preserving), save-draft and publish stay separate affordances (ADR-013); (4) categories = real FK bilingual picker via `getCategoryTree`, unlike stores' free-text; (5) — n/a. New feature-local `Field.tsx` + `ListingImagesField.tsx` (gallery: upload/retry/reorder ↑↓/remove); zero `ui/*`/`shared/*` edits (diff-confirmed empty). i18n `seller.listings.form.*` +88 leaf keys both locales, parity 567→655/655. Full CI green (typecheck·lint 0 new·4 guards[zod-cov 24, i18n 655/655]·unit 102/102·build clean, 2 new routes) + runtime smoke **16/16 PASS** via a throwaway Node+Playwright staging script (2 minted sellers, real `@supabase/ssr` session cookie built with the library's own base64url/chunk utils, injected into a real Chromium context; deleted before commit, zero residue): AR+EN 200 correct-language; REG-15 validation (2 required errors, blocks save); create→draft→redirect to edit; REAL browser-client image upload → storage own-prefix + `listing_images` row (hero badge); publish happy path → `active`; blocked publish (no image + no payment method) → checklist shows both, R-S09 link exact, row stays `draft`. |
| T05 inventory | Sonnet | — | — | — | |
| T06 exit gate | Opus | — | — | — | |
