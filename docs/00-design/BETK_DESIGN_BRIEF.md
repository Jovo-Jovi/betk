# BETK_DESIGN_BRIEF.md

> **STATUS: LOCKED visual source of truth.** This brief is the single, self-contained definition of BETK's visual language: every color token value (light **and** dark), the type/spacing/radius/shadow scales, and the per-component anatomy for the whole component inventory. It is distilled from the expert-authored design reference (CSS/HTML/JS + logo assets, both themes, both directions). **Every value a generator needs is recorded here** — there are no pointers into a working folder. The design reference itself lives in an external repo (see *Living reference*); it is NOT vendored into this repository.
>
> **Living reference (external design repo):** `<DESIGN-REPO-URL>` @ `<COMMIT-SHA>`.
> ⚠️ `<DESIGN-REPO-URL>`/`<COMMIT-SHA>` are **placeholders** — the external design repo has not been published/pinned yet. Fill both when it is. Until then this brief is authoritative on its own; do not treat the placeholder as a live link. (See OPEN ITEMS.)
>
> **Provenance:** extracted from the transient hand-off `docs/handoff/new-design/` (`betk design/index.css` + the 65 page HTMLs + `app.js`; `logo/` PNGs). That folder was **deleted after extraction** (never committed) — which is exactly why this brief is self-contained.

---

## 0. Generator rule (verbatim — obey on every generation)

> **Every value comes from this brief. Propose a token, never inline a value. If a value or component is missing, derive it consistently from the design reference (`<DESIGN-REPO-URL>` @ `<SHA>`) or STOP and ask — never invent.**

Corollaries:
- **Token names are FROZEN.** The 39 CSS-variable token names in §2 are load-bearing (`tailwind.config.ts`, 31 shared components, the DS-I18N string-prop wiring). Never rename or remove one. New needs → an **additive** proposed token following the existing naming convention (§2.4).
- The design system (`components/ui` + `components/shared`) is owned by **Claude Design**. Cursor **composes + wires data**, never restyles. Extend shadcn via wrappers; never modify base `components/ui/*`.
- **No emojis in UI.** Every glyph is a clean outline SVG icon (`stroke="currentColor"`, `stroke-width="2"`, 24×24 viewBox). The design reference is emoji-free; keep it that way.
- **No hover-only affordances** (low-end Egyptian mobile target). Hover elevation/borders are enhancements; every state must be reachable and legible without hover.

---

## 1. The bilingual / theme frame (every value must survive all four contexts)

BETK is served in **four presentation contexts** and every token, scale, and component entry below must be usable in all four:

| Axis | Values |
|---|---|
| Locale / direction | **ar → RTL (default, unprefixed URLs)** · **en → LTR (under `/en`)** |
| Theme | **light** · **dark** (`.dark` class on `<html>` via `next-themes`) |

- **RTL is canonical.** Author every component RTL-first with **logical CSS properties** (`padding-inline-start/-end`, `margin-inline-*`, `inset-inline-*`, `border-inline-*`, `text-align:start/end`, `rounded-s-*/-e-*`). The identical component then mirrors correctly under LTR with **zero** raw `left/right`. Where a component needs an explicit LTR note, it is called out in its §5 entry.
- **LTR islands** (always `dir="ltr"`, regardless of page locale): digits, prices/amounts, BETK refs (`BETK-YYYYMMDD-XXXX`), tracking numbers, OTP digits, phone numbers. CSS: `direction:ltr; unicode-bidi:embed;` (utility `.ltr-island` / `.text-mono`).
- **Fonts** are direction-agnostic Arabic-first faces with Latin fallback (§3); they render both scripts. Body line-height is loosened for Arabic (`1.8`) and stays legible in Latin.
- **Theme** never changes layout, dimensions, or radius — only color-token *values* swap between the light and `.dark` blocks in §2. Anatomy in §5 is theme-invariant.

This is per **OD-7** (bilingual AR/EN + light/dark over the frozen 56 pages; no new pages/tables/deps/translation-service). See `BETK_UI_SPEC.md §4 Localization & theming` for the routing/gating/persistence contract.

---

## 2. Color tokens — full value table (FROZEN names; light **and** dark)

HSL values are stored **without** the `hsl()` wrapper so Tailwind composes them as `hsl(var(--token) / <alpha>)`. "main" = the value currently on `main` (`src/app/globals.css`). "design" = the value authored in the design reference. **This task records the mapping only — it does NOT apply values to `globals.css`.**

Legend: **RE-VALUE** = design supplies a new value for this token · **UNCHANGED** = design value equals main · **RETAINED** = design did not re-author it → keep main's value · **FLAG** = conflicting/ambiguous, do not apply without design confirmation.

### 2.1 Core semantic tokens

| Token | main (light) | main (dark) | design (light) | design (dark) | Verdict | Source selector |
|---|---|---|---|---|---|---|
| `--background` | 40 33% 98% | 40 33% 6% | **40 25% 98%** | **215 25% 8%** | RE-VALUE | `:root/.dark --background` |
| `--foreground` | 222 22% 14% | 222 22% 90% | **215 25% 12%** | **40 25% 95%** | RE-VALUE | `--foreground` |
| `--primary` | 158 64% 32% | 158 64% 68% | **175 60% 24%** | **175 60% 32%** | RE-VALUE ⚠️FLAG-A | `--primary` |
| `--primary-foreground` | 0 0% 100% | 0 0% 4% | 0 0% 100% | **0 0% 100%** | RE-VALUE (dark) | `--primary-foreground` |
| `--accent` | 28 92% 54% | 28 92% 54% | **32 85% 45%** | **32 85% 52%** | RE-VALUE | `--accent` |
| `--accent-foreground` | 0 0% 100% | 0 0% 4% | 0 0% 100% | *(not re-authored)* | RETAINED (dark) | `--accent-foreground` |
| `--destructive` | 0 72% 48% | 0 72% 52% | 0 72% 48% | **0 72% 55%** | RE-VALUE (dark) | `--destructive` |
| `--destructive-foreground` | 0 0% 100% | 0 0% 4% | 0 0% 100% | *(not re-authored)* | RETAINED (dark) | `--destructive-foreground` |
| `--secondary` | 40 14% 93% | 40 14% 15% | *(not authored)* | *(not authored)* | RETAINED ⚠️FLAG-B | — |
| `--secondary-foreground` | 222 22% 14% | 222 22% 90% | *(not authored)* | *(not authored)* | RETAINED ⚠️FLAG-B | — |
| `--muted` | 40 14% 93% | 40 14% 15% | **40 15% 93%** | **215 14% 18%** | RE-VALUE | `--muted` |
| `--muted-foreground` | 222 10% 42% | 222 10% 65% | **215 15% 45%** | 215 10% 65% | RE-VALUE (light) | `--muted-foreground` |
| `--success` | 142 70% 38% | 142 70% 62% | 142 70% 38% | **142 70% 48%** | RE-VALUE (dark) | `--success` |
| `--success-foreground` | 0 0% 100% | 0 0% 4% | *(not authored)* | *(not authored)* | RETAINED | — |
| `--warning` | 38 92% 50% | 38 92% 50% | 38 92% 50% | **38 92% 55%** | RE-VALUE (dark) | `--warning` |
| `--warning-foreground` | 222 22% 14% | 222 22% 14% | *(not authored)* | *(not authored)* | RETAINED | — |
| `--card` | 40 33% 98% | 40 33% 8% | **0 0% 100%** (opaque of `rgba(255,255,255,.7)`) | **222 31% 17%** (opaque of `rgba(30,41,59,.7)`) | RE-VALUE ⚠️FLAG-C | `--card` |
| `--card-foreground` | 222 22% 14% | 222 22% 90% | =`--foreground` | =`--foreground` | UNCHANGED-role | `--card-foreground` |
| `--popover` | 0 0% 100% | 40 14% 10% | **0 0% 100%** (opaque of `rgba(255,255,255,.85)`) | **222 31% 17%** (opaque of `rgba(30,41,59,.85)`) | RE-VALUE ⚠️FLAG-C | `--popover` |
| `--popover-foreground` | 222 22% 14% | 222 22% 90% | =`--foreground` | =`--foreground` | UNCHANGED-role | `--popover-foreground` |
| `--border` | 40 12% 86% | 40 12% 22% | **40 15% 86%** | **215 15% 20%** | RE-VALUE | `--border` |
| `--input` | 40 12% 86% | 40 12% 22% | *(uses `--border` value)* | *(uses `--border`)* | RE-VALUE (=border) | forms use `1px solid var(--border)` |
| `--ring` | 158 64% 32% | 158 64% 68% | **175 60% 24%** | **175 60% 32%** | RE-VALUE ⚠️FLAG-A | `--ring` |

### 2.2 Catalog / status-support tokens (Phase-03 kit)

The design reference expresses these as *hardcoded* values inside status/level classes rather than as the frozen token names. Values below are the extracted hardcoded values mapped back onto the frozen token; **FLAG-D** where the design uses a gradient (two-stop) that a single solid HSL token cannot hold.

| Token | main (light) | main (dark) | design value (light) | Verdict | Source selector |
|---|---|---|---|---|---|
| `--warning-text` | 38 92% 32% | 38 92% 62% | **38 92% 32–38%** (`hsl(38,92%,38%)` on `.badge-pending`; `35%` on `.sla-badge.warning`; `32%` on `.alert-warning`) | UNCHANGED≈ ⚠️FLAG-E (multiple shades) | `.badge-pending`, `.sla-badge.warning`, `.alert-warning` |
| `--accent-text` | 28 92% 40% | 28 92% 62% | **28 92% 40%** (`.badge-suspended`); accent hover `32 85% 38%` | UNCHANGED≈ | `.badge-suspended`, `.btn-accent:hover` |
| `--star` | 38 92% 50% | 38 92% 55% | **38 95% 52%** (`.star.filled`); bars use `45 90% 50%` | RE-VALUE≈ ⚠️FLAG-E | `.star.filled`, `.rating-bar-fill` |
| `--level-bronze-bg` | 28 45% 92% | 28 30% 16% | gradient `30 50% 85% → 30 50% 72%` | RETAINED ⚠️FLAG-D | `.level-bronze` |
| `--level-bronze-fg` | 28 55% 34% | 28 50% 70% | **30 50% 25%** | RE-VALUE≈ | `.level-bronze` |
| `--level-bronze-ring` | 28 45% 60% | 28 35% 40% | *(none; gradient edge)* | RETAINED ⚠️FLAG-D | — |
| `--level-silver-bg` | 220 12% 92% | 220 10% 18% | gradient `0 0% 88% → 0 0% 72%` | RETAINED ⚠️FLAG-D | `.level-silver` |
| `--level-silver-fg` | 220 10% 38% | 220 12% 72% | **0 0% 28%** | RE-VALUE≈ | `.level-silver` |
| `--level-silver-ring` | 220 10% 65% | 220 10% 45% | *(none)* | RETAINED ⚠️FLAG-D | — |
| `--level-gold-bg` | 43 80% 90% | 43 40% 16% | gradient `45 90% 80% → 45 90% 55%` | RETAINED ⚠️FLAG-D | `.level-gold` |
| `--level-gold-fg` | 38 70% 32% | 43 70% 65% | **45 90% 22%** | RE-VALUE≈ | `.level-gold` |
| `--level-gold-ring` | 43 80% 55% | 43 60% 45% | *(none)* | RETAINED ⚠️FLAG-D | — |

### 2.3 Non-token color literals used by the design (record for reference; NOT new tokens)

These appear as one-off hardcoded values in the design and should resolve to the nearest existing token when a component is built (never inlined):
- **Status "processing/dispatched" blue** `210 70% 40–50%` (`.badge-dispatched`, `.alert-info`) — no blue token exists. → **FLAG-F**: propose nothing yet; render via `--muted`/text until design authorizes a blue, or confirm these enums reuse an existing token.
- **Sold-out / wishlist tint** `hsla(350 80% 60% / .05)` (`.wishlist-btn:hover`) — decorative destructive-adjacent tint; use `--destructive` at low alpha.
- **Footer** solid `222 22% 12%` bg + `40 14% 70–80%` text — a fixed dark band independent of theme (§5 Footer).
- **Avatar/store gradients**: `linear-gradient(135deg, primary, accent)` (avatar), `linear-gradient(135deg, 158 40% 85%, 158 50% 70%)` (store cover) — compose from tokens, not literals.

### 2.4 PROPOSED NEW tokens (additive — do not exist on main; follow naming convention)

Recorded as proposals only (this task applies nothing). Layout/effect scales the design relies on but which have no CSS-var home on `main` (they currently live in Tailwind config or inline):

| Proposed token | Value | Rationale / source |
|---|---|---|
| `--sidebar-width` | `260px` | seller/admin console shell (`.sidebar`) |
| `--topbar-height` | `64px` | topbar + console-topbar + sidebar-header min-height |
| `--bottom-nav-height` | `60px` | mobile bottom nav (buyer/public) |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,.02), 0 1px 2px rgba(0,0,0,.04)` | card at rest |
| `--shadow-md` | `0 10px 25px -5px rgba(0,0,0,.05), 0 8px 10px -6px rgba(0,0,0,.05)` | hover/active cards, modals-md |
| `--shadow-lg` | `0 20px 30px -10px rgba(0,0,0,.06), 0 10px 15px -8px rgba(0,0,0,.04)` | sheets, popovers, toasts |
| `--shadow-xl` | `0 30px 45px -15px rgba(0,0,0,.08), 0 15px 25px -10px rgba(0,0,0,.06)` | dialogs/modals |
| `--card-blur` | `12px` (backdrop-filter) | glassmorphic card/listing-card/store-card (see FLAG-C) |

> **NOTE:** `main` already ships equivalent shadow *aliases* in `tailwind.config.ts` (`boxShadow.card`/`card-hover`/`dialog`). Two viable paths — (a) keep the Tailwind aliases and re-value them to the design's blur shadows, or (b) promote them to the `--shadow-*` CSS vars above. **Design to choose**; do not apply either here.

---

## 3. Type, spacing, radius, shadow scales

### 3.1 Typography
- **Families** (Arabic-first, Latin fallback; both scripts render):
  - `--font-display` → **Cairo**, "IBM Plex Sans Arabic", system-ui, sans-serif — headings, store names, prices, hero, KPI values, logo wordmark.
  - `--font-body` → **IBM Plex Sans Arabic**, "Noto Sans Arabic", system-ui, sans-serif — body, forms, labels, buttons.
  - `--font-mono` → **IBM Plex Mono**, ui-monospace, monospace — BETK refs, tracking numbers, OTP, pagination numerals.
- **Weights loaded:** Cairo 400/600/700/800 · IBM Plex Sans Arabic 300/400/500/600/700 · IBM Plex Mono 400/500/600.
- **Type scale (rem):** `--text-display 2.25` · `--text-h1 1.875` · `--text-h2 1.5` · `--text-h3 1.25` · `--text-lg 1.125` · `--text-base 1` · `--text-sm .875` · `--text-xs .75`.
- **Line-height:** body **1.8** (loosened for Arabic legibility); headings **1.3**; messages/accordion body **1.7–1.8**.
- **Heading weights:** display **800**; h1–h6 **700**; card/section titles 600–700.
- **Mobile clamp (≤768px):** display → `1.75rem`, h1 → `1.5rem`, h2 → `1.25rem`.

### 3.2 Spacing (4px base)
`--space-1 .25rem` · `-2 .5rem` · `-3 .75rem` · `-4 1rem` · `-5 1.25rem` · `-6 1.5rem` · `-8 2rem` · `-10 2.5rem` · `-12 3rem` · `-16 4rem`. Container max-width **1280px**, gutters `--space-4` (mobile) → `--space-6` (≥1024px). Always express as logical utilities (`ps/pe/ms/me/px/py`), never `pl/pr/ml/mr`.

### 3.3 Radius
`--radius 12px` (base). Scale: `--radius-lg = 12px` (cards, sheets, modals, galleries) · `--radius-md = 10px` (buttons, inputs, badges-on-square, thumbs) · `--radius-sm = 8px` (checkbox, focus inset) · `--radius-full = 9999px` (pills, badges, chips, avatars, toggles, search bars).
> ⚠️ **FLAG-G — radius mismatch:** design base `--radius` = **12px (0.75rem)**; `main`/`tailwind.config.ts` base `--radius` = **0.625rem (10px)**. RE-VALUE proposed (10px→12px); Tailwind's `lg/md/sm` derive off `--radius`, so this shifts all three. Design to confirm before applying.

### 3.4 Shadows (glassmorphic blur set)
See §2.4 for the four-step `--shadow-sm/md/lg/xl` values. Usage: **sm** = card at rest · **md** = hover/active card, `.modal`(sm), quick-action/category hover · **lg** = auth-card, toast, `.sla`/popovers · **xl** = `.modal` dialog. Elevation is the primary (non-hover-dependent) affordance.

---

## 4. Global base & focus
- `box-sizing:border-box`, zeroed margins/padding, `html{font-size:16px; scroll-behavior:smooth}`, `body{font-family:var(--font-body); line-height:1.8; bg:var(--background); color:var(--foreground)}`.
- **Focus (WCAG AA, keyboard-visible):** `:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }` globally; inputs additionally get `box-shadow: 0 0 0 3px hsl(var(--ring)/.15)` on focus. Focus ring is a **required, non-hover** state on every interactive element.
- **Selection:** `background: hsl(var(--primary)/.2)` (see FLAG-A re: exact hue).
- **Links:** color `--primary`, hover darkens (design hover literal `158 64% 24%` — FLAG-A).
- **Icons:** outline SVG, 24×24 viewBox, `stroke="currentColor"`, `stroke-width="2"`; sizes 14/16/18/20/22/36 per context. No emojis.
- **Reduced motion:** all component transitions are decorative (150–300ms, `ease`/`cubic-bezier(.4,0,.2,1)`); honor `prefers-reduced-motion` by dropping transform/animation. *(Not authored in the reference — record as the standing rule; not a per-component spec.)*

---

## 5. Component anatomy (RTL-canonical; states included)

Dimensions/padding/radius reference the scales above. Every component must render **default / skeleton (loading) / empty / error** where applicable (per `docs/standards/UI_STATE_STANDARDS.md` and `BETK_UI_SPEC.md §6`). Colors are **token references**, never literals. All are theme-invariant in layout; only token values swap in dark.

### 5.1 Buttons (`.btn` + variants)
- **Anatomy:** `inline-flex` center, `gap --space-2`, font-body **600** `--text-sm`, line-height 1, padding **`.625rem 1.25rem`**, `border:none`, radius **md**, `white-space:nowrap`. Icon+label spacing via `gap` (mirrors automatically RTL/LTR).
- **Sizes:** `sm` = `.375rem .75rem`, `--text-xs` · `lg` = `.75rem 1.5rem`, `--text-base` · `icon` = 40×40, padding `.5rem`, radius md.
- **Variants:** `primary` (bg `--primary`, fg `--primary-foreground`) · `accent` (bg `--accent`) · `destructive` · `success` · `warning` · `outline` (transparent, `1px --border`, fg `--foreground`) · `ghost` (transparent, hover bg `--muted`) · `google` (full-width, `1px --border`, `--card` bg, 20px Google glyph + label, `gap --space-3`).
- **States:** default; **hover/active/focus** = darker shade of the variant hue + `--shadow-md` (enhancement only); **focus-visible** = 2px `--ring` ring, offset 2px; **disabled** (`:disabled`/`[disabled]`) = `opacity .5`, `cursor:not-allowed`, `pointer-events:none`; **loading** = spinner replaces/leads label ("Sending code…"), button stays sized (no layout shift). No empty/error state (atomic control).
- **RTL/LTR:** logical padding; icon sits at inline-start via `gap`. Canonical RTL; LTR identical mirrored.

### 5.2 Card (`.card`, `.card-header/-body/-footer`) + KPI card
- **Anatomy:** bg `--card`, `1px --border`, radius **lg**, `--shadow-sm`, `overflow:hidden`. Header `--space-4 --space-5` + bottom hairline; body `--space-5`; footer `--space-3 --space-5` + top hairline + `hsl(var(--muted)/.3)` wash.
- **KPI card:** padding `--space-5`; `.kpi-label` `--text-sm` muted; `.kpi-value` font-display `--text-h2` 700; `.kpi-trend` `--text-xs`, `.up`→`--success`, `.down`→`--destructive`.
- **States:** default; **skeleton** = same box with shimmer blocks (§5.24); **empty**/**error** handled by the region's EmptyState/ErrorRetryCard, not the card shell.
- **RTL/LTR:** all padding logical; hairlines full-width. Canonical RTL.

### 5.3 ListingCard (`.listing-card`)
- **Anatomy:** block `<a>`, bg `--card` + **backdrop-blur 12px** (glass, FLAG-C), `1px --border`, radius **lg**, `--shadow-sm`. Image `.listing-card-img` **aspect-ratio 4/3** (→ **1/1 on ≤768px**), `object-fit:cover`, `--muted` placeholder. Body `.listing-card-body` padding `--space-3 --space-4`; title font-display 600 `--text-sm`, **2-line clamp**; `.listing-card-store` `--text-xs` muted; footer `.listing-card-footer` flex space-between padding `--space-2 --space-4 --space-3` (price ⇄ wishlist/badge).
- **In collection strip:** `min-width 220px`, `max-width 260px`, `scroll-snap-align:start`.
- **States:** default; **hover** = `--shadow-md` + `translateY(-4px)` + border `hsl(primary/.2)` (enhancement); **skeleton** = image block + 2 text lines + footer line shimmer; **empty** = parent grid shows EmptyState; **error** = parent shows ErrorRetryCard. Composes PriceBlock, WishlistButton, StatusBadge(boost), StockBadge.
- **RTL/LTR:** image full-width (neutral); footer flips price/action ends automatically. Canonical RTL.

### 5.4 StoreCard (`.store-card`)
- **Anatomy:** flex row, `gap --space-3`, padding `--space-4`, `--card`+blur, `1px --border`, radius **lg**, `--shadow-sm`. `.store-avatar` 56×56 circle, `--muted`, `flex-shrink:0`, `object-fit:cover`; text column (name font-display, meta muted, LevelBadge/VerifiedBadge/RatingSummary).
- **States:** default; **hover** `--shadow-md` + `translateY(-2px)`; **skeleton** = circle + 2 lines; empty/error at parent.
- **RTL/LTR:** avatar leads at inline-start (right in RTL, left in LTR) via source order + `gap`. Canonical RTL.

### 5.5 Badges — StatusBadge (`.badge` + enum classes)
- **Anatomy:** `inline-flex` center, `gap --space-1`, font-body **600** `--text-xs`, padding **`.2rem .6rem`**, radius **full**, `line-height 1.4`, `white-space:nowrap`. Centralized enum→token map (single source: `constants/statusColors.ts`).
- **Enum → color (tint bg + readable fg):**
  - pending → `warning/.15` bg, `warning-text` fg
  - active/confirmed/live/approved → `success/.15` bg, success-text fg
  - delivered/processed → `primary/.12` bg, `--primary` fg
  - cancelled/rejected/banned/removed → `destructive/.12` bg, `--destructive` fg
  - expired/closed/declined → `muted/.8` bg, `--muted-foreground` fg
  - draft → `--muted` bg, muted fg
  - dispatched/processing → blue `210 70% 50% /.12` bg (FLAG-F)
  - suspended → `accent/.15` bg, `accent-text` fg
  - boosted → solid `--accent` bg, `--accent-foreground` fg
  - sold-out → `destructive/.1` bg, `--destructive` fg
- **`flag` domain (moderation: pending/reviewed/actioned/dismissed):** tint colors only, **no Arabic/English labels authored** — matches the standing carry-forward (StatusBadge `DEFAULT_LABELS` stays `Partial`). ⚠️ Do NOT author `flag` labels here.
- **States:** static display; no skeleton/empty/error (atomic). Bilingual: label text is a **string prop** (DS-I18N), never hardcoded.

### 5.6 LevelBadge (`.level-badge`, `.level-{bronze,silver,gold}`)
- **Anatomy:** `inline-flex`, `gap --space-1`, **700** `--text-xs`, padding `.2rem .65rem`, radius **full**. Metallic **gradient** bg (135deg) + dark same-hue fg — bronze `30 50% 85→72%`/fg `30 50% 25%`; silver `0 0% 88→72%`/fg `0 0% 28%`; gold `45 90% 80→55%`/fg `45 90% 22%`. ⚠️FLAG-D (gradients vs solid `--level-*` tokens).
- **States:** static; label is a string prop.

### 5.7 VerifiedBadge (`.verified-badge`)
- `inline-flex`, `gap .2rem`, `--primary` color, **600** `--text-xs`; 14×14 filled check SVG (`fill:currentColor`). Static.

### 5.8 Form controls (`.form-group/-label/-input/-select/-textarea/-hint/-error`)
- **Group:** `margin-bottom --space-4`. **Label:** block **600** `--text-sm`, `margin-bottom --space-2`. **Hint:** `--text-xs` muted. 
- **Input/select/textarea:** full-width, font-body `--text-sm`, padding **`.625rem .875rem`**, `1px --border`, radius **md**, bg `--card`, `line-height 1.6`. Placeholder `--muted-foreground` @ `.6` opacity. Textarea `min-height 100px`, `resize:vertical`. Select `appearance:none` + chevron.
- **States:** default; **focus** = border `--ring` + `0 0 0 3px hsl(ring/.15)`, no outline; **error** (`.error`) = border `--destructive` + `.form-error` `--text-xs --destructive` beneath; **disabled** = inherit button disabled treatment; **loading** = inline spinner on submit control (not the field).
- **RTL/LTR:** text-align follows direction; chevron/icon on inline-end. Canonical RTL. **LTR note:** numeric/phone inputs wrap value in `dir="ltr"` island while the field label stays in page direction.

### 5.9 Toggle (`.toggle`)
- 44×24 pill, bg `--border` (off) / `--primary` (`.active`), 20×20 white knob at `top 2px; inset-inline-start 2px` + `--shadow-sm`. Active → `translateX(20px)`; **`[dir="rtl"]` → `translateX(-20px)`** (explicit RTL rule). States: off/on/disabled(opacity). 

### 5.10 Checkbox (`.checkbox`, `.checkbox-group`)
- 18×18, `2px --border`, radius **sm**; `.checked` → `--primary` bg+border, white check. Group = flex row `gap --space-2`, `cursor:pointer`. States: unchecked/checked/disabled.

### 5.11 Data table (`.data-table`)
- Full-width `border-collapse`, `--text-sm`. `thead` bg `--muted`; `th` padding `--space-3 --space-4`, **`text-align:start`**, **600** `--text-xs` muted UPPERCASE `letter-spacing .03em`, bottom hairline. `td` padding `--space-3 --space-4`, bottom hairline, `vertical-align:middle`. Row hover `hsl(muted/.5)`.
- **States:** default; **skeleton** = SkeletonTable (N row skeletons matching columns); **empty** = single full-width cell with EmptyState (admin queues use a *positive* "Queue is clear"); **error** = ErrorRetryCard in place of tbody.
- **RTL/LTR:** `text-align:start` makes columns mirror; numeric cells use `.text-mono`/LTR islands. Canonical RTL.

### 5.12 Tabs (`.tabs`, `.tab`, `.tab-content`) & Filter tabs (`.filter-tabs`, `.filter-tab`)
- **Tabs:** flex, `border-bottom 2px --border`, horizontally scrollable. `.tab` padding `--space-3 --space-4`, **600** `--text-sm`, muted, `border-bottom 2px transparent`, `margin-bottom -2px`; `.active` → `--primary` text + `--primary` underline. `.tab-content` hidden unless `.active`.
- **Filter tabs (pills):** `.filter-tab` padding `.375rem 1rem`, `--text-sm` 500, radius **full**, `1px --border`, `--card` bg, muted; `.active` → `--primary` bg + `--primary-foreground`.
- **States:** default/active; scroll-overflow on mobile; skeleton = pill shimmer row.
- **RTL/LTR:** underline + scroll direction follow page direction. Canonical RTL.

### 5.13 Topbar (`.topbar`) — public + buyer
- **Anatomy:** `sticky top:0 z-50`, height **`--topbar-height` (64px)**, bg `--card`, bottom hairline, `--shadow-sm`, `padding-inline --space-4`, `gap --space-3`. `.logo` font-display **800** `--text-h3` `--primary` (uses the ب mark statically per §6). `.search-bar` flex-1 `max-width 560px` with search icon at **`inset-inline-start .75rem`**, input radius **full**, bg `--muted`. `.topbar-actions` flex `gap --space-2`. `.notif-btn` 40×40 circle + `.notif-dot` at `inset-inline-end 8px`. `.avatar-btn` 36×36 gradient (primary→accent) ring. `.topbar-theme-btn` 36×36 (light/dark toggle).
- **Mobile (≤768px):** `.search-bar` hidden (search moves to bottom-nav / dedicated page).
- **RTL/LTR:** **logo at inline-start (right in RTL), account/actions cluster at inline-end (left in RTL)** — mirrors automatically. Canonical RTL.

### 5.14 MobileBottomNav (`.bottom-nav`) — ≤768px only
- `fixed bottom:0`, height **60px**, bg `--card`, top hairline. Items flex-column, 10px 600 label + 22px icon, muted; `.active` → `--primary`. `body.has-bottom-nav` adds bottom padding. 5 items (Home · Search · Wishlist · Inbox · Account). Static per-route active state.
- ⚠️ Uses raw `left/right` for full-bleed positioning — **acceptable for a viewport-fixed bar**; item content still uses logical props.

### 5.15 Sidebar (`.sidebar*`) — seller + admin console
- **Anatomy:** width **`--sidebar-width` (260px)**, bg `--card`, `border-inline-end 1px --border`, `fixed inset-inline-start:0 top/bottom:0 z-40`, scroll-y. Header min-height `--topbar-height`, logo + subtitle. `.sidebar-section-title` `--text-xs` **700** muted UPPERCASE. `.sidebar-link` flex `gap --space-3`, padding `--space-2 --space-3`, radius **md**, `--text-sm` 500; hover bg `--muted`; **`.active`** → `hsl(primary/.1)` bg + `--primary` + 600; 20px icon @ .7 opacity (1 when active); `.sidebar-badge` count pill at `margin-inline-start:auto`. `.sidebar-main` offset `margin-inline-start --sidebar-width`.
- **Mobile (≤1024px):** off-canvas — `transform: translateX(100%)` (RTL) / **`[dir="ltr"] → translateX(-100%)`** (explicit LTR rule); `.open` slides in; `.sidebar-overlay` scrim `z-39`; `.menu-toggle` shows; main offset removed.
- **States:** default/active-link; badge count; collapsed(mobile). Canonical RTL, explicit LTR transform.

### 5.16 Console topbar (`.console-topbar`)
- `sticky top:0 z-30`, height `--topbar-height`, `--card`, bottom hairline, `padding-inline --space-5`, `.page-title` font-display 700 `--text-lg`.

### 5.17 StarRating (`.stars`, `.star`) & RatingSummary (`.rating-summary`, `.rating-bars`)
- **Stars:** `inline-flex gap 2px`, **`direction:ltr`** (ratings read LTR in both locales). Star 16×16; empty `210 10% 80%` (dark `215 15% 28%`); `.filled/.half` → gold `38 95% 52%` (≈`--star`). 
- **RatingSummary:** flex `gap --space-2`; `.rating-number` font-display 700 `--text-h2`; `.rating-count` `--text-sm` muted. **Distribution bars:** `.rating-bar-row` (label 12px + track + count); track `height 6px` bg `--muted` radius full; fill gold `45 90% 50%`.
- **States:** default; skeleton = star row + bar shimmer; empty = "no reviews yet" EmptyState. Star count is a plural string prop (bilingual). **LTR-canonical for the star row specifically.**

### 5.18 PriceBlock (`.price`)
- font-display **700** `--foreground`; `.currency` `.75em` 600; `.amount` `1.1em` **`direction:ltr; unicode-bidi:embed`** (amount is an LTR island); `.price-label` `--text-xs` muted 400; `.price-type-badge` `--text-xs` **600** `--primary`. Handles `price_type` = fixed / per_hour / starting_from / quote_only (label prop switches). Static; amount always LTR.

### 5.19 ImageGallery (`.gallery`, `.gallery-main`, `.gallery-thumb`)
- Main: aspect **4/3**, radius **lg**, `--muted` placeholder, cover. Thumbs: flex `gap --space-2`; each 64×64 radius **md**, `2px transparent` border, `.active` → `--primary` border. States: default/active-thumb; skeleton = main block + thumb row; empty = placeholder; error = ErrorRetryCard. RTL: thumb row flows start→end (mirrors).

### 5.20 MessageThread (`.thread`, `.message`, `.composer`)
- Thread flex-column `gap --space-3` padding `--space-4`. `.message` `max-width 75%`, padding `--space-3 --space-4`, radius **lg**, `--text-sm`, `line-height 1.7`. **`.sent`** = `align-self:flex-start`, bg `--primary`, fg `--primary-foreground`, `border-end-start-radius sm` (tail). **`.received`** = `align-self:flex-end`, bg `--muted`, `border-end-end-radius sm`. `.msg-time` `--text-xs` opacity .7. `.composer` = flex `gap --space-2`, top hairline, `--card`; input radius full, bg `--background`.
- **States:** default; skeleton = alternating bubble shimmer; **empty** = "start the conversation" EmptyState; error = ErrorRetryCard.
- **RTL/LTR:** sent/received use logical `flex-start/flex-end` + logical corner radii → **mirror automatically** (sent bubble sits inline-start in RTL, inline-end swaps under LTR). Canonical RTL; verify bubble sidedness reads correctly in LTR.

### 5.21 OrderTimeline (`.timeline`, `.timeline-item`, `.timeline-dot`)
- `padding-inline-start --space-4` + **`border-inline-start 2px --border`** (rail on inline-start). Item `padding-inline-start --space-6`, `padding-bottom --space-5` (last:0). Dot 12×12 circle at `inset-inline-start: calc(-1*--space-4 - 6px)`, bg `--border`, `2px --card` ring; **`.active`** → `--primary` + `0 0 0 3px hsl(primary/.2)`; **`.completed`** → `--success`. Title 600 `--text-sm`; time `--text-xs` muted.
- **States:** default/active/completed steps; skeleton = dot+line shimmer.
- **RTL/LTR:** rail + dots on inline-start → **mirror automatically** (right rail in RTL, left in LTR). Canonical RTL.

### 5.22 Stepper (`.stepper`, `.stepper-circle`, `.stepper-line`) — onboarding
- Row flex center. Circle 36×36, **700** `--text-sm`, `2px --border`, `--card`, muted, `--shadow-sm`. `.active` → `--primary` bg/border + `--primary-foreground` + glow + `scale(1.08)`. `.completed` → `--success` bg/border + white. Label `--text-xs` **700** muted (`--primary` when active). Line flex-1 `height 3px` `--border`, `margin-inline --space-2`; `.completed` → gradient success→primary. States: pending/active/completed. RTL: order + gradient direction follow page direction.

### 5.23 SLABadge (`.sla-badge`) & StockBadge (`.stock-badge`)
- **SLA:** `inline-flex gap --space-1`, `--text-xs` 600, padding `.2rem .6rem`, radius full. `.safe` success/.12; `.warning` warning/.15 + `warning-text`; `.danger` destructive/.12. Countdown value is an LTR island.
- **Stock:** `inline-flex gap --space-1`, `--text-xs` 600. `.in-stock`→`--success`; `.low-stock`→`--warning`; `.out-of-stock`→`--destructive`. Count is a plural string prop.
- Both static.

### 5.24 EmptyState (`.empty-state`) & Skeletons (`.skeleton*`)
- **EmptyState:** centered, padding `--space-12 --space-6`. Icon circle 80×80 `--muted` bg, muted 36px SVG. Title font-display **700** `--text-lg`; text `--text-sm` muted `max-width 360px` centered; single primary CTA. **Copy rule:** one-line explanation + one CTA toward the unblocking action; distinguish *no-data-yet* (encouraging + CTA) from *filtered-no-results* (offer "clear filters"); admin queues = positive ("Queue is clear"); never a bare "No data". All copy = bilingual string props.
- **Skeleton:** `--muted`→`hsl(muted/.5)`→`--muted` shimmer gradient, `background-size 800px`, `shimmer 1.5s infinite linear`, radius **md**. `.skeleton-circle` full; `.skeleton-text` height 14px + `.w-25/.50/.75`. **SkeletonGrid** = card-skeleton grid matching the real grid; **SkeletonTable** = row skeletons matching columns. Loading rule: data/navigation → skeleton (match final layout, resolve regions independently); mutation → spinner on the control.

### 5.25 Modal / ConfirmDialog (`.modal-overlay`, `.modal`)
- Overlay `fixed inset:0`, `rgba(0,0,0,.5)` + **backdrop-blur 4px**, `z-100`, centered, padding `--space-4`; `.open` → flex. Modal `--card`, radius **lg**, `--shadow-xl`, `max-width 480px`, `max-height 90vh`, scroll-y. Header padding `--space-5` + bottom hairline + title font-display `--text-lg` + close btn; body `--space-5`; footer padding `--space-4 --space-5` + top hairline + actions `justify:flex-end gap --space-3`.
- **ConfirmDialog usage:** before every irreversible/destructive action (cancel order, delete listing, permanent ban [mandatory R-M04], account deactivate, payout reject, dispute resolve, mass broadcast). Blocks until confirm/cancel.
- **States:** open/closed; action loading (spinner on confirm). RTL: footer actions align to inline-end.

### 5.26 Toast / Toaster (`.toast-container`, `.toast`)
- Container `fixed bottom --space-6`, centered via `inset-inline-start 50% + translateX(50%)`; **`[dir="ltr"] → translateX(-50%)`** (explicit LTR rule); `z-200`, `pointer-events:none`. Toast bg `--foreground` / fg `--background` (inverse), padding `--space-3 --space-5`, radius **lg**, `--shadow-lg`, `--text-sm` 500, `toastIn .3s`. **Rule:** toast = completed/attempted action, no decision needed (saved/sent/advanced/"couldn't save — retry", ≤1 retry, auto-dismiss). Bilingual copy.

### 5.27 FilterChips (`.chip`) & FilterSheet
- **Chip:** `inline-flex gap --space-1`, padding `.25rem .75rem`, radius **full**, `1px --border`, `--text-xs` 500, `--card` bg; hover border `--primary`; `.active` → `hsl(primary/.1)` bg + `--primary` border + `--primary` text; `.chip-remove` 14×14 @ .6 opacity (× icon).
- **FilterSheet:** composed on mobile from the Sheet primitive (categories tree + governorate/city + price + type); on desktop an inline panel. States: default/active-filters/cleared; empty result → EmptyState "clear filters". RTL: chips wrap start→end; remove-× on inline-end.

### 5.28 Accordion (`.accordion-item/-trigger/-content`)
- Item bottom hairline. Trigger full-width flex space-between, padding `--space-4 0`, **600** `--text-sm`, **`text-align:start`**, chevron `.arrow` (muted) rotates 180° when `.open`. Content hidden→block on `.open`, `padding-bottom --space-4`, `--text-sm` muted `line-height 1.8`. States: closed/open. RTL: text-align start + chevron mirror.

### 5.29 CategoryGrid (`.category-grid`, `.category-tile`)
- Grid `auto-fill minmax(100px,1fr)` `gap --space-3`. Tile flex-column center, padding `--space-4 --space-2`, radius **lg**, `--card`, `1px --border`, centered text. `.cat-icon` 48×48 circle `hsl(primary/.1)` bg `--primary` icon. `.cat-name` `--text-xs` 600. Hover: `--primary` border + `--shadow-md` + `scale(1.04)`. States: default; skeleton = tile shimmer grid; empty rare. Name is a bilingual string.

### 5.30 CollectionStrip (`.collection-strip`, `.strip-scroll`)
- Header flex space-between (title font-display **700** `--text-h3` + "see all" link). `.strip-scroll` = horizontal flex `gap --space-4`, `scroll-snap-type:x mandatory`, hidden scrollbar; children = ListingCards (220–260px). **`dir` resolves from locale server-side** (never `document.dir`) so scroll/snap direction matches. States: default; skeleton = card-strip shimmer; empty = hide strip or EmptyState. Canonical RTL; explicit locale-derived `dir`.

### 5.31 Hero (`.hero`) — homepage
- `position:relative`, white text, padding `--space-16 --space-4`, centered, `border-radius: 0 0 --space-8 --space-8` (bottom corners). Layered bg: `.hero-bg` radial+linear teal gradient (`175 60% 20% → 175 45% 10%`; dark deepened) + dotted overlay; `.hero-glow-1/2` blurred radial accents (decorative, `pointer-events:none`). `h1` font-display **800** `--text-display` + text-shadow; `p` `--text-lg` @ .9. `.hero-search` `max-width 540px`, glass input (radius full, translucent white bg, backdrop-blur 16px, white text), search icon at `inset-inline-start 1.25rem`; focus → `--accent` border + glow.
- **States:** static marketing surface. RTL: text centered (direction-neutral); search icon inline-start. Canonical RTL.

### 5.32 AuthShell (`.auth-shell`, `.auth-card`) + OTP + Google
- Shell = `min-height 100vh` centered, `--background`, padding `--space-4`. Card `max-width 420px`, `--card`, radius **lg**, `--shadow-lg`, padding `--space-8`. `.auth-logo` centered (ب mark, §6); `.auth-title` font-display `--text-h2` **700** centered; `.auth-subtitle` `--text-sm` muted centered.
- **OTP (`.otp-input-group`, `.otp-digit`):** group flex `gap --space-2` centered, **`direction:ltr`** (digits LTR in both locales). Digit 48×56, center, font-**mono** `--text-h2` 600, `2px --border`, radius **md**, `--card`; focus → `--primary` border + ring wash.
- **States:** default; submitting (spinner on button); field error (border `--destructive` + message); resend/lockout states after expiry/≤5 attempts. **LTR-canonical for the OTP row.**

### 5.33 Pagination (`.pagination`, `.pagination-btn`)
- Flex center `gap --space-1`. Button 36×36, `1px --border`, radius **md**, `--text-sm` 500, `--card`, **font-mono** numerals; hover border `--primary`; `.active` → `--primary` bg + `--primary-foreground`. States: default/active/disabled(ends). RTL: prev/next chevrons mirror; page numbers stay LTR-readable.

### 5.34 Breadcrumb (`.breadcrumb`)
- Flex center `gap --space-2`, `--text-sm` muted, wrap. Links muted → `--primary` on hover; `.separator` @ .4 opacity (chevron mirrors by direction); `.current` `--foreground` 600. RTL: separators point inline-end. Canonical RTL.

### 5.35 WishlistButton (`.wishlist-btn`) & FollowButton
- **Wishlist:** 36×36 circle, `1px --border`, `--card`, muted heart icon; hover → `--destructive` border+color + faint tint + `scale(1.08)`; **`.active`** → `--destructive` bg/border + white + filled heart. Optimistic toggle. States: idle/active/loading(disabled). Requires auth (guest → route to login).
- **FollowButton:** primary/outline button variant toggling Follow⇄Following; same auth gate; label is a bilingual string prop.

### 5.36 Progress (`.progress-track`, `.progress-fill`) & Alert (`.alert`)
- **Progress:** track `height 8px` `--muted` radius full; fill `--primary` (`.accent`/`.success` variants), `width` transition. Used in onboarding/level/payout.
- **Alert banner:** padding `--space-3 --space-4`, radius **md**, `--text-sm`, flex `gap --space-3` icon+text. `info` blue `210 70%` tint (FLAG-F); `success`/`warning`/`destructive` = token tints + matching text. States: static; dismissible variant optional.

### 5.37 Footer (`.footer`)
- **Fixed dark band** (theme-independent): bg `222 22% 12%`, text `40 14% 80%`, padding `--space-12 --space-4`. Grid `2fr 1fr 1fr 1fr` (→ `1fr 1fr` ≤768, `1fr` ≤480). Logo font-display **800** `--text-h2` `--primary`; column `h4` white 700; links `40 14% 70%` → `--primary` hover. `.footer-bottom` top hairline + centered `--text-xs` @ .6.
- RTL: grid + text mirror via logical flow. Canonical RTL.

### 5.38 Supporting primitives (recorded, lower-detail)
- **`.divider`** 1px `--border` `margin-block --space-4`; **`.divider-text`** with start/end hairlines around centered label.
- **`.tag`** small `--muted` pill `--text-xs` 500.
- **Avatars** `.avatar-sm/md/lg` (32/48/64 circle, `--muted`).
- **`.icon-counter`** count pill at `inset-inline-end -4px`, `--destructive` bg, white, `2px --card` ring.
- **`.upload-zone`** (ImageUploader) `2px dashed --border`, radius **lg**, padding `--space-8`, centered muted; hover → `--primary` border + `hsl(primary/.04)` bg. Handles WebP convert + ordering + signed-URL preview; states: idle/drag/uploading(progress)/error(per-file).
- **`.seller-mini`** (SellerMiniCard) flex row `gap --space-3`, padding `--space-3`, `--muted` bg, radius **md**.
- **`.quick-actions`/`.quick-action`** dashboard grid (`auto-fit minmax(140px,1fr)`), tile `--card`+border, 40×40 `hsl(primary/.1)` icon circle, hover `--primary` border + `--shadow-md`.
- **`.notif-item`/`.inquiry-item`** list rows (flex `gap --space-3`, padding `--space-3 --space-4`, bottom hairline); `.unread` → `hsl(primary/.04)` (+ inquiry gets `border-inline-start 3px --primary`); 40/48px icon/thumb.
- **`.order-card`** history row (flex `gap --space-4`, padding `--space-4`, `--card`+border, radius **lg**, hover `--shadow-md`, 64×64 thumb).
- **`.store-header`/`.store-cover`/`.store-profile-avatar`** storefront header (cover 200px gradient, 96×96 avatar with `4px --card` ring overlapping cover by -40px, `padding-inline --space-5`).
- **`.chart-placeholder`** analytics stub (200px `--muted` box) — real charts are a later concern; keep language-neutral.
- **`.sr-only`** visually-hidden a11y text (required on icon-only controls; the reference uses `aria-label` throughout).

---

## 6. LOGO — STATUS: IN PROGRESS (partial; invent nothing)

The logo system is **authored in part only.** Record exactly what exists; everything else is an OPEN LOGO ITEM below. Assets are the four PNGs from `docs/handoff/new-design/logo/` (transient; describe by name/format here since the folder is deleted).

### 6.1 Concept (authored)
The brand word is **بيتك** ("baytak / betak" — *your home*), the Arabic reading of "BETK". Four Arabic letters — **ب (beh) · ي (yeh) · ت (teh) · ك (kaf)** — are each drawn as a **marketplace object** rendered in the brand palette. The **primary mark is the standalone letter ب (beh).**

### 6.2 Authored letterforms (geometry + colors)
Shared construction: thick **rounded-terminal strokes**, flat 2-color palette — **teal-green stroke** (reads as `--primary` family, ≈ `hsl(168–175, 55–60%, 28–34%)`) + **orange dot/accent** (reads as `--accent` family, ≈ `hsl(30, 90%, 55%)`), on the **cream `--background`**. All are square-canvas PNG raster (1024²-class), single centered glyph, generous clear space.

| Asset | Letter | Construction / geometry | Colors |
|---|---|---|---|
| `beh.png` | **ب (beh) — PRIMARY MARK** | The plain beh baseline bowl: a wide, shallow rounded-U horizontal stroke with upturned rounded ends; a single dot centered **below** the bowl. Letter-only (not an object). | teal stroke + **orange** nuqta dot |
| `yeh.png` | **ي (yeh)** | Drawn as a **shopping cart**: teal cart body/handle formed from the yeh stroke; **two orange dots as the cart wheels** (echoing yeh's two-dot nuqta below). | teal cart + 2 orange dots |
| `teh.png` | **ت (teh)** | Drawn as a **cooking pot** (handmade/food economy): teal pot body with two side handles; **two orange dots above** = teh's two-dot nuqta / rising steam. | teal pot + 2 orange dots (above) |
| `kaf.png` | **ك (kaf)** | Stylized **kaf** letterform: teal kaf base stroke with the diagonal **hamza-like stroke rendered in orange** (the internal kaf mark). | teal stroke + orange internal stroke |

### 6.3 Animation — INTENT NOTE (concept only; nothing else authored)
> **Stated concept:** the four per-letter marks **animate and resolve back into the single ب (beh) primary mark** — i.e. بيتك's letters converge/morph to the beh logo. 

This is the **only** authored animation information. **No trigger, duration, easing, sequence, loop behavior, or reduced-motion variant is authored** — do not spec or invent any of it. There is no `@keyframes`, JS driver, or SVG for the logo in the reference (page chrome renders the wordmark as the plain text "BETK"). The animation arrives via a future **LOGO-SYNC** update to this brief.

### 6.4 Asset inventory
- `beh.png` (PNG raster, ~707 KB) — **primary mark**
- `yeh.png` (PNG raster, ~760 KB) — cart letter-object
- `teh.png` (PNG raster, ~791 KB) — pot letter-object
- `kaf.png` (PNG raster, ~823 KB) — stylized kaf
- **No SVG, no favicon/app-icon set, no wordmark lockup, no motion asset** present.

### 6.5 OPEN LOGO ITEMS (missing — verbatim; do NOT derive or invent)
- **Final animation spec** (trigger / duration / easing / sequence / loop / reduced-motion) — concept only, unspecified.
- **Theme variants** — only a single (light/cream-background) rendering exists; no authored dark-theme mark or on-primary/monochrome/knockout variant.
- **Clear-space & min-size rules** — none authored.
- **Wordmark lockup** — no authored "BETK"/"بيتك" wordmark or mark+wordmark lockup (chrome uses plain text "BETK").
- **Vector/production assets** — no SVG or icon/favicon set; PNG rasters only.
- **External design-repo pointer** `<DESIGN-REPO-URL>`/`<COMMIT-SHA>` — not yet published.

> **Logo system incomplete — Claude Design must NOT derive or invent the missing items; they arrive via a future LOGO-SYNC update to this brief.** Until then, generation uses the **ب (beh) mark statically** wherever a logo is needed (topbar/sidebar/auth/footer), and the text wordmark "BETK" as it appears in the reference chrome.

---

## 7. Component inventory (produce/refine — string-prop contracts preserved)

Anatomy above defines **shape, not API.** Components keep their existing props and **DS-I18N string-prop contracts** (labels/plural strings passed in, Arabic defaults preserved, never hardcoded). The 21-component shared kit (16 DS-I18N-refactored + 5 unchanged) is the contract; do not change signatures.

ListingCard · StoreCard · PriceBlock · **StatusBadge** (one enum→color map; keys in `constants/statusColors.ts`; `flag` domain stays label-less) · StarRating · RatingSummary · LevelBadge · VerifiedBadge · MessageThread · ImageUploader · OrderTimeline · AddressForm/AddressSelect · FilterSheet · FilterChips · SLABadge · StockBadge · CategoryGrid · CollectionStrip · ImageGallery · SellerMiniCard · SearchBar · WishlistButton · FollowButton · EmptyState · SkeletonGrid/SkeletonTable · ErrorRetryCard · ConfirmDialog · Toaster · AppTopbar/MobileBottomNav · SellerSidebar/AdminSidebar. Every one renders its **empty / loading / error** states, not just the happy path, and is usable in all four AR-RTL / EN-LTR × light/dark contexts.

---

## 8. Hand-off contract
Claude Design owns the **visual contract** of `components/ui` + `components/shared`. Cursor composes those into feature pages and wires data (Server Actions / queries) **without changing their visual contract**. Generated UI returns via branch → PR → UI-reviewer gate (`.cursor/rules/91-review-ui.mdc`). Token names frozen; values applied to `globals.css` in a **separate** task after this brief is reviewed. `.fig`: none — wireframes are textual (`BETK_UI_SPEC.md §3`).
