# BETK_DESIGN_BRIEF.md
> The brief you paste/attach into Claude Design's "Set up your design system" page. Distilled from `BETK_UI_SPEC.md §1` (tokens) and §4 (component inventory). Lead with RTL/Arabic — it's the #1 compatibility risk.

## Company name & blurb (paste into "Company name and blurb")
**BETK** — an Arabic-first, **right-to-left (RTL)** digital marketplace for Egypt's informal creative economy: home-based sellers, handmade artisans, freelancers, and micro-businesses, connected to local buyers through verified storefronts, local split-payment (Instapay / Vodafone Cash / Orange Cash + COD), neighborhood-level discovery, and structured buyer protection. The product is a responsive web app. **All UI is Arabic-first and RTL by default.** Tone: trustworthy, warm, local, uncluttered.

## Non-negotiable design constraints (put in "Any other notes?")
- **RTL-first, Arabic-first.** Default direction `dir="rtl"`, `lang="ar"`. Use logical CSS properties (start/end, not left/right). LTR islands only for digits, prices, BETK refs (`BETK-YYYYMMDD-XXXX`), tracking numbers, OTP.
- **Component library:** shadcn/ui on Tailwind. **Extend via wrappers; never override the base `components/ui/*`.**
- **Use the existing CSS-variable tokens** (below) — do not invent new color names or hardcode hex.
- Mobile-first; target low-end Egyptian mobile networks (light DOM, no hover-only controls).
- Accessibility: WCAG AA, visible focus ring on `--ring`, keyboard + screen-reader friendly in RTL.

## Fonts (attach or name in "Add fonts")
- Display: **Cairo** → `--font-display`
- Body: **IBM Plex Sans Arabic** → `--font-body`
- Mono (refs/OTP/tracking): **IBM Plex Mono** → `--font-mono`
- Type scale (rem): display 2.25 / h1 1.875 / h2 1.5 / h3 1.25 / lg 1.125 / base 1 / sm .875 / xs .75. Loosen line-height one step on body for Arabic.

## Color tokens (HSL; light theme — dark mirrors with inverted L)
`--background 40 33% 98%` · `--foreground 222 22% 14%` · `--primary 158 64% 32%` (BETK green; CTAs/active/verified) · `--primary-foreground 0 0% 100%` · `--accent 28 92% 54%` (boost/featured) · `--accent-foreground 0 0% 100%` · `--destructive 0 72% 48%` · `--muted 40 14% 93%` · `--muted-foreground 222 10% 42%` · `--success 142 70% 38%` · `--warning 38 92% 50%` · `--border 40 12% 86%` · `--ring 158 64% 32%`.
Radius `--radius .625rem` (cards lg, buttons/inputs md, pills full). Shadows sm (rest) / md (hover listing cards) / lg (sheets, popovers, dialogs).

## GitHub link guidance ("Link code from GitHub")
Point Claude Design at the **frontend subfolder only** (it copies selected files, not the whole repo): `src/components/ui`, `src/components/shared`, `src/app`, `tailwind.config.ts`, `app/globals.css`, `src/constants/statusColors.ts`. Do not attach backend/`features/*/actions`/`lib/supabase`.

## Component inventory to produce / refine (from UI Spec §4)
ListingCard, StoreCard, PriceBlock (handles price_type fixed/per_hour/starting_from/quote_only), **StatusBadge** (one map for all enums — keys in `constants/statusColors.ts`), StarRating, RatingSummary, LevelBadge (Bronze/Silver/Gold), VerifiedBadge, MessageThread, ImageUploader, OrderTimeline, AddressForm, FilterSheet, SLABadge, EmptyState, SkeletonGrid/SkeletonTable, ErrorRetryCard, ConfirmDialog, Toaster. Every component must render its empty / loading / error states per `docs/standards/UI_STATE_STANDARDS.md`, not just the happy path.

## .fig
None — BETK wireframes are textual (`BETK_UI_SPEC.md §3`). Skip the .fig upload; use this brief + the GitHub link as the design source.

## Hand-off contract
Claude Design owns the **visual contract** of `components/ui` + `components/shared`. Cursor composes those components into feature pages and wires data (Server Actions / queries) **without changing their visual contract**. All generated UI returns to the repo via a branch → PR → UI-reviewer gate (`BETK_GIT_WORKFLOW.md`).
