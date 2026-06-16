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

## DS04 — Export to branch (Claude Design → GitHub)
- **Prompt:**
```
Commit the generated components and shells to a new branch feature/design-system (frontend files only: src/components/ui, src/components/shared, src/app shells, tailwind.config.ts, app/globals.css). Open a PR to develop with a summary listing every component and which UI Spec §4 entry it satisfies.
```
- **Done when:** PR open against `develop` with the component→spec mapping.

## DS05 — Cursor hand-off: review + wire data
- **Surface:** **Cursor** · **Model:** Opus (UI-reviewer + Security review), then Sonnet (wiring) · **Skill:** skill-ui-reviewer, skill-security-reviewer, skill-ui-engineer
- **Prompt (Cursor):**
```
Review PR feature/design-system as the UI-reviewer + Security reviewer. For each component verify against its BETK_UI_SPEC.md §3/§4 usage: components present, RTL correct, tokens used (no hardcoded colors), shadcn extended not overridden, and empty/loading/error states implemented. Confirm no business logic or secrets are embedded. Reject with the specific spec line for any miss. After merge to develop, wire data into the shared components within the relevant feature folders using existing Server Actions/queries — WITHOUT changing any component's visual contract. Update DEVELOPMENT_JOURNAL.md.
```
- **Done when:** PR passes CI + UI-reviewer + Security gates, merges to `develop`; feature pages compose the merged components with live data; journal updated.

---

## Notes
- Claude Design copies *selected* files, not the whole repo — keep the selection to the frontend subfolder (brief, DS01).
- If you choose Option A (early), run DS01–DS04 right after Phase 01/03, then Phases 04–14 consume the merged components; DS05 wiring happens incrementally inside each feature phase. If Option B (late), run the whole pack after Phase 14 as one polish pass (expect restyle rework on already-built pages).
- The visual contract boundary is enforced everywhere: `.cursorrules`, master prompt, skill-ui-engineer/reviewer, and BETK_GIT_WORKFLOW all state that Cursor composes + wires but never restyles shared components.
