# PHASE DS — Design System & UI Polish (Claude Design) · Task Pack
> Surface: **Claude Design** (canvas + chat), linked to the GitHub repo, plus a Cursor hand-off step. Brief: `docs/00-design/BETK_DESIGN_BRIEF.md`. Placement: Option A (early, after Phase 01/03) or Option B (late polish, after Phase 14) — see `BETK_PHASES.md` Phase DS.
> Prompts here are written **for Claude Design chat**, except DS05 which is a **Cursor** task. RTL/Arabic is the #1 risk — every prompt restates it.

## Definition of done
- [ ] Claude Design system created from `BETK_DESIGN_BRIEF.md` (tokens, fonts, RTL) + the frontend subfolder from GitHub.
- [ ] All §4 shared components generated/refined: RTL-correct, token-driven (no hardcoded colors), shadcn-extended, with empty/loading/error states.
- [ ] Page shells (PublicShell, BuyerShell, SellerShell, AdminShell) match UI Spec §2 nav patterns.
- [ ] Output committed to `feature/design-*`, PR opened, CI + UI-reviewer + Security gates pass, merged to `develop`.
- [ ] Cursor wires data into the merged components without changing their visual contract.

---

## DS01 — Set up the design system (Claude Design)
- **Surface:** Claude Design → "Set up your design system"
- **Inputs:** paste `BETK_DESIGN_BRIEF.md`; **Link code from GitHub** → select only `src/components/ui`, `src/components/shared`, `src/app`, `tailwind.config.ts`, `app/globals.css`, `src/constants/statusColors.ts`; add fonts (Cairo, IBM Plex Sans Arabic, IBM Plex Mono) + BETK logo if available; skip .fig.
- **Prompt:**
```
This is BETK — an Arabic-first, RIGHT-TO-LEFT marketplace for Egypt. All UI is RTL and Arabic by default (dir="rtl", lang="ar"); use logical CSS properties, not left/right. Build the design system from the attached BETK_DESIGN_BRIEF.md: use exactly the CSS-variable color tokens, the type scale, radius .625rem, and the shadow set defined there — do not invent new tokens or hardcode hex. Fonts: Cairo (display), IBM Plex Sans Arabic (body), IBM Plex Mono (refs/OTP/tracking). Component library is shadcn/ui on Tailwind — extend via wrappers, never modify the base components/ui. Confirm the system back to me as tokens + primitives before generating components.
```
- **Done when:** Claude Design confirms tokens/fonts/RTL and reflects the shadcn base from the repo.

## DS02 — Generate / refine shared components (Claude Design)
- **Prompt:**
```
Using the BETK design system, produce these shared components (RTL-first, token-driven, shadcn-extended), each WITH its empty, loading (skeleton), and error states per the brief: ListingCard, StoreCard, PriceBlock (price_type: fixed | per_hour | starting_from | quote_only), StatusBadge (single map for order/seller/dispute/payment/boost/listing/flag/payout enums — keys from constants/statusColors.ts), StarRating, RatingSummary, LevelBadge (Bronze/Silver/Gold), VerifiedBadge, MessageThread, ImageUploader, OrderTimeline, AddressForm, FilterSheet, SLABadge, EmptyState, SkeletonGrid, SkeletonTable, ErrorRetryCard, ConfirmDialog, Toaster.
Constraints: Arabic copy where labels appear; mono for refs/prices/OTP; no hover-only controls (mobile/low-bandwidth); visible focus ring on --ring. Output as files under src/components/shared. Do not wire any data or business logic — visual + props only.
```
- **Done when:** all §4 components exist with the three states; no hardcoded colors; RTL verified on the canvas.

## DS03 — Page shells / layouts (Claude Design)
- **Prompt:**
```
Build the four layout shells from BETK_UI_SPEC.md §2 (RTL): PublicShell (sticky topbar: logo right, full-width search, category menu, notifications bell, account/login left + mobile bottom nav Home·Search·Wishlist·Inbox·Account); BuyerShell; SellerShell (left sidebar console, collapses to Sheet on mobile; topbar store avatar/level/payout); AdminShell (grouped left sidebar Overview·Moderation·Catalog·Commerce·Content·System; topbar SLA counters). Tokens + RTL only; slots for content; no data.
```
- **Done when:** shells match §2 nav patterns; RTL placement correct (logo/account mirrored).

## DS04 — Consolidated design-system land + gate (Cursor)
- **Surface:** Cursor · **Model:** Opus (UI-reviewer + security), then Sonnet if wiring fixes needed · **Skill:** skill-ui-reviewer, skill-security-reviewer, skill-nextjs-engineer
- **PRECONDITION:** design-expert review signed off + real logo present in the handoff package. Do NOT run before both.
- **Prompt:**
```Read SESSION_CONTEXT.md, then execute DS04 — land the full settled design system onto feature/design-catalog, gate it, and open the PR. Integration + review ONLY — do NOT restyle or change any component's visual contract. If a component needs a visual/behavioral change to work, STOP and flag to Claude Design.
BRANCH FRESHNESS (avoid the stale-base mistake):

Confirm feature/design-catalog is still exactly current origin/main + the 21 catalog files (git fetch first; if origin/main advanced since b648566, rebase feature/design-catalog onto the current tip and report the diff). The branch base MUST be current origin/main (which already carries T01 + T01-FIX).

LAND (from the settled Claude-Design handoff package + CHANGELOG):

Add the 10 net-new src/components/shared/*.tsx (6 DS02: MessageThread, ImageUploader, AddressForm, OrderTimeline, SLABadge, ConfirmDialog; 4 shells: PublicShell, BuyerShell, SellerShell, AdminShell) + update shared/index.ts barrel to export all 31 + prop types.
Apply any expert-driven changes to the 21 catalog files ONLY where the package CHANGELOG flags them. Report a diff of all 21 vs b648566 so unchanged files carry their prior gate forward and changed ones get re-reviewed.
Land the real logo (asset in public/ or a Logo component in components/shared, per the package); wire it into PublicShell in place of the DS01 typographic wordmark.
Apply any new tokens from the package into BOTH :root and .dark in app/globals.css (additive only) + matching tailwind.config.ts utility keys. If no new tokens, confirm still the 113-set.

BASE PRIMITIVE VERIFICATION (flagged by DS02/DS03 — scaffold via official shadcn CLI if missing, never hand-edit ui/):

5. Confirm the real components/ui/ exposes: Button size="icon" + variant="destructive" + asChild; standard Dialog subcomponents (ConfirmDialog); Sheet + Avatar subcomponents (shells); ui/label (AddressForm/MessageThread). Scaffold any missing primitive; report what you scaffolded.

6. ACCOUNT-MENU DECISION: if the account dropdown should render in-shell, scaffold ui/dropdown-menu and wire it in PublicShell; otherwise leave account as a slot. State which you did.
SHELL WIRING (app-router files are Cursor-owned; shells are neutral chrome):

7. Wire PublicShell into src/app/(public)/layout.tsx (replacing the bare T09 placeholder) — swap the shell's plain <a> for next/link and pass current pathname as activePath. THIS IS REQUIRED: T02 Homepage must render inside PublicShell, not the placeholder.

8. Wire BuyerShell into src/app/(buyer)/layout.tsx (replacing the T05 placeholder), same <a>→next/link + activePath.

9. SellerShell + AdminShell LAND AS COMPONENTS ONLY — do not create seller/admin layout files now; their owning phases wire them. (Optional trivial fix: move /admin/users nav item from System to Moderation per §2.)
GATE (report each):

pnpm typecheck exit 0, zero errors anywhere (this is the real test of the clean-room translation of the 10 net-new; fix import/type wiring ONLY).
pnpm lint clean (the 2 pre-existing no-img-element warnings on ImageGallery/ListingCard are expected/allowed — do NOT swap to next/image here; that's a DS decision carried separately).
Tailwind resolution (silent-empty check): run the real tailwindcss CLI; confirm all token utilities used by the new components emit real hsl(var(...)) rules, not empty. Report the probes.
Tokens present in BOTH :root and .dark.
components/ui/* untouched except CLI-scaffolded additions (report the diff).
No docs/handoff residue; nothing in src/ imports from docs/handoff.
check-service-import + check-zod-coverage green.

UI-REVIEWER + SECURITY PASS (across all 31, per BETK_UI_SPEC §3/§4):

Each component: present, RTL correct (logical props, mirrored placement), tokens-only (zero raw hsl/hex), shadcn extended not overridden, and default/loading/empty/error states implemented. Reject any miss with the specific §4 spec line.
Confirm NO business logic, NO data wiring, NO secrets embedded in any shared component (presentational + props only).

PR:

Push feature/design-catalog to origin, open a PR to main with a component→UI-Spec-§4 mapping table (every component → the §4 entry it satisfies) as the description.

REPORT: branch freshness/rebase status; the 21-vs-b648566 diff; net-new landed; primitives scaffolded; account-menu decision; shell wiring done (Public + Buyer); tailwind/typecheck/lint/gate results; UI-reviewer + security verdict per component; PR link.

Close-out → update SESSION_CONTEXT + DEVELOPMENT_JOURNAL. Do NOT merge and do NOT start T02 — I give the merge verdict after reviewing this.
```
- **Done when:** all 31 landed on feature/design-catalog; the 10 net-new + any changed catalog files pass typecheck/lint/tailwind-resolution + UI-reviewer + security; PublicShell + BuyerShell wired into their real layouts; component→spec PR open to main; gate clean. Merge on review verdict → then T02.