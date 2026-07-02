# OD-7 — Bilingual AR/EN Web App + Light/Dark Theme — Execution Track

> **Purpose.** Working plan + task prompts to make BETK a bilingual **Arabic/English** web app with light/dark theming — no translation service, no new pages/tables, no new content columns. Execute one task per Cursor window; paste each result to the review chat for a PASS/FAIL verdict before advancing.
>
> **Status:** BL-00 through BL-04 DONE & COMMITTED (`f910cb6`/`22342de`/`95b469e`/`7e4a9f1` on `feature/bilingual-i18n`); DS-I18N (Claude Design) DONE. Next task: **BL-05** (Opus) — consolidated gate → merge → unblocks Phase 03 T02.
> **Scope authority:** amends `BETK_MVP_SCOPE.md §6` as **OD-7** (see §3). No schema change, no new dependency.
> **Frozen elsewhere:** OD-1…OD-6 unchanged. Phase 03 **T02+ is PAUSED** until BL-05 merges.

---

## 1. Model — what "bilingual" means here

| Layer | Behavior | Source |
|---|---|---|
| UI shell (nav, buttons, labels, empty states, validation/errors) | Fully bilingual AR/EN | `next-intl` catalogs `messages/ar.json` + `messages/en.json`, BETK-owned |
| Categories, badges, statuses, filters, governorates, delivery options | Bilingual | Existing `name_ar`/`name_en` etc.; BETK-filled |
| Goods — titles / store names / collection names | Bilingual; display `COALESCE(locale column, other)` (never blank) | Existing `title_ar`/`title_en`, `name_ar`/`name_en`, `collections.name_ar`/`name_en`; **seller-entered** for goods |
| **Descriptions / bios** | **Single field, in the author's language, shown as-is to everyone. No translation.** | Existing `description`/`bio` field (author-language text) |
| Transactional/structured fields (price, stock, condition, dates) | Language-neutral / enum | Data, unchanged |

**No translation service. No API/LLM translator. No new content columns. No new dependency.**

**Note — no item master table.** The only controlled, pre-existing bilingual list in the 43 tables is **`categories`** (`name_ar`+`name_en`); the seller's product **title** is always free-text (there is no product/item catalog to select from). So bilingual goods are guaranteed via the title, not a list lookup.

**Decided rule (DECIDED, was open):** the listing **title is required in both AR + EN** — enforced at the **Zod / listing-form layer (Phase 04)**, `title_en` kept **nullable in DB** (no migration; `COALESCE` remains a safety net). Categories are bilingual automatically (controlled list). **Descriptions / store bios / custom-order notes are single-language, author's language, shown as-is** (an English user may see an Arabic description, and vice versa — accepted).

---

## 2. Git state, branch rules & freeze protocol

**Confirmed state (DONE):**
- `feature/design-catalog` is **fully contained in `main`** (merged via PR #33) — dead weight.
- `cursor` == `main` == `b829dbf`.
- **`feature/bilingual-i18n`** created off `main` at `b829dbf`, pushed, tracking `origin/feature/bilingual-i18n`.

**Rules while this track runs:**
- All bilingual/theme work commits **only** to `feature/bilingual-i18n`.
- **Do not touch `main`** until the BL-05 gate PR.
- Design-catalog gate is **already spent** (PR #33). **DS-I18N modifies now-trunk shared components** — Claude-Design-owned, routed through the Claude Design chat. **BL-05 is a bilingual+theme gate only.**
- **T01-FIX security verdict is independent** (DB/RLS) — clears on its own track.
- Keep `feature/design-catalog` and `cursor` until BL-05 merges (rollback insurance), then delete.
- Phase 03 **T02+ paused** until BL-05 merges.

> **PowerShell:** `&&` unsupported — run each git line individually.

---

## 3. OD-7 — verbatim amendment block

> Inserted into `BETK_MVP_SCOPE.md §6` by **BL-00** (after OD-6, before the "Scope FROZEN and signed" line).

```markdown
- **OD-7 — Bilingual AR/EN web app + light/dark theme: IN (no translation service).** App becomes bilingual Arabic/English and light/dark themed over the existing 56 pages — no new pages, no new tables, no new content columns, no new dependency.
  - **Shell.** All chrome translated via `next-intl` catalogs (`messages/ar.json`, `messages/en.json`); BETK owns EN UI copy.
  - **Structured content** (categories, badges, statuses, filters, governorates, delivery) bilingual via existing `*_ar`/`*_en` columns; BETK-filled.
  - **Goods** (titles, store names, collection names) bilingual via existing `title_en`/`name_en` columns; display `COALESCE(locale column, other)` (never blank). Populated by BETK for categories/collections and by **sellers** for goods — bilingual seller entry is a listing-form decision (Phase 04+).
  - **Descriptions/bios:** single field, in the author's language, shown as-is to everyone. **No machine translation. No `_en` body columns.**
  - **Transactional/structured fields** (price, stock, condition, dates) language-neutral/enum.
  - **Routing:** path-prefix, `localePrefix:'as-needed'`. Arabic default + unprefixed (existing URLs/SEO preserved); English under `/en`. Locale validated at edge (∈{ar,en} else 404); middleware normalizes locale BEFORE role gates — gate logic unchanged.
  - **Theme:** `next-themes`, class strategy on `<html>`. Tokens shipped Phase 01 T03.
  - **Persistence:** locale URL+cookie, theme localStorage. No user/content DB column.
  - Post-MVP: on-demand content translation; per-account persisted preferences; more locales. *Schema change: NO. New dependency: NONE.*
```

Closing line becomes:
`Scope FROZEN and signed 2026-06-13 (OD-1…OD-6); amended OD-7 2026-07-01 — bilingual AR/EN web app + theme, no schema, no new dependency.`

---

## 4. Execution order

```
[DONE]  Step 1  Recon                     git report-only
[DONE]  Step 2  Branch cut off main       feature/bilingual-i18n @ b829dbf
[DONE]  BL-00   Docs / OD-7 scaffolding    Cursor · Opus   (docs only)
[DONE]  BL-01   i18n + theme foundation    Cursor · Opus   ← critical path, security-sensitive
[DONE]  BL-02   Extract non-shared strings Cursor · Sonnet
[DONE]  BL-03   Settings switcher          Cursor · Sonnet
[DONE]  DS-I18N De-hardcode shared kit     Claude Design chat (NOT Cursor)
[DONE]  BL-04   Wire DS keys + verify      Cursor · Sonnet (`7e4a9f1`)
        BL-05   Consolidated gate → merge  Cursor · Opus   (NEXT) → unblocks T02
```

One task per window. Close-out each (SESSION_CONTEXT + journal + commit) before the next.

---

## 5. Task prompts

### BL-00 — Docs & OD-7 scaffolding · **Opus** · docs-only

```
Model: Opus. Branch: feature/bilingual-i18n. Documentation-only — no code, no schema. Read docs/SESSION_CONTEXT.md first.

1. BETK_MVP_SCOPE.md §6: insert the OD-7 block (from §3 of OD7_BILINGUAL_THEME_TRACK.md) VERBATIM after the OD-6 bullet and BEFORE the "Scope FROZEN and signed 2026-06-13" line. Then change the closing line to: "Scope FROZEN and signed 2026-06-13 (OD-1…OD-6); amended OD-7 2026-07-01 — bilingual AR/EN web app + theme, no schema, no new dependency."

2. DEVELOPMENT_JOURNAL.md: append a dated entry — OD-7 decision (bilingual AR/EN shell + bilingual names/titles via existing *_en columns; descriptions single-language as authored; NO translation service; no content columns); integration branch feature/bilingual-i18n cut off main (b829dbf); design-catalog already merged via PR #33; Phase 03 T02+ paused until BL-05.

3. docs/SESSION_CONTEXT.md: add "Active initiative: Bilingual AR/EN + Theme (OD-7)" — branch feature/bilingual-i18n; task list BL-01 foundation → BL-02 strings → BL-03 switcher → DS-I18N (Claude Design) → BL-04 wire → BL-05 gate+merge; mark "Phase 03 T02+ PAUSED". Note: design-catalog is already in main via PR #33; DS-I18N modifies now-trunk components via Claude Design; BL-05 is a bilingual+theme gate only; T01-FIX security verdict remains independent. Carry-forward: bilingual title entry for goods (title_en) is a Phase-04 listing-form decision.

4. PHASE_03_CATALOG.md: note at top that T02+ is paused pending the BL track, and that from T02 onward pages are authored bilingual + themed; update any "Arabic-first / RTL" pattern note to "+ EN shell + bilingual names/titles + light/dark". Descriptions render as-authored (single language).

5. PHASE_DS_DESIGN_SYSTEM.md: add task DS-I18N — de-hardcode Arabic literals baked into the 21 shared components into i18n keys/props + verify all render on a dark canvas and under LTR. Note: DS-I18N modifies already-merged shared components; verified within BL-05 (no separate design gate).

Done-when: all five docs updated; OD-7 verbatim; no code/schema touched. Commit: "docs(od-7): bilingual+theme amendment and BL track scaffolding".
```

### BL-01 — i18n + theme foundation · **Opus** · security-sensitive

```
TASK BL-01 — Bilingual + theme foundation. Model: Opus. Branch: feature/bilingual-i18n.
Read docs/SESSION_CONTEXT.md first; confirm branch = feature/bilingual-i18n and working tree clean.

GUARDRAILS
- OD-7 governs: bilingual AR/EN + light/dark theme, presentation layer. NO translation service.
- NO schema changes. NO new pages/tables. NO new content columns.
- components/ui + components/shared are Claude-Design-owned — do NOT edit their internals or extract their strings here (that's DS-I18N). Only wire providers around them.
- Security-critical: middleware role gates (gateFor) must behave IDENTICALLY after adding locale — locale normalized BEFORE gate evaluation. Prove it.

DO
1. Install next-intl + next-themes.
2. next-intl config: locales ['ar','en'], defaultLocale 'ar', localePrefix 'as-needed'. AR unprefixed, EN under /en. Locale validated (∈{ar,en} else notFound()).
3. Create src/app/[locale]/ and MOVE all existing route groups + pages under it: (public),(auth),(buyer),(seller),(admin), page.tsx, blocked/, loading/error/not-found. URLs stay stable except optional /en prefix. Update src/constants/routes.ts builders to be locale-aware (AR omits prefix).
4. src/middleware.ts: compose next-intl locale handling with existing gateFor() so locale is normalized FIRST, then role gates run on the locale-stripped path. Existing gate outcomes for every matcher (/admin,/seller,/account,/auth/*,/blocked) unchanged. Add a comment block proving each gate still fires.
5. Root layout (app/[locale]/layout.tsx): <html dir lang> derives from locale (ar→rtl/ar, en→ltr/en). Add next-themes provider (class strategy, attribute="class", defaultTheme respects system). Keep the three font vars.
6. messages/ar.json + messages/en.json: minimal namespaced skeleton (common, nav, auth, account) — prove the pipeline with ~5 keys wired into one existing page.
7. Name/title fallback helper localizedName(row, locale)=COALESCE(x_en,x_ar) ready for the read layer (names/titles only). Descriptions/bios render as-authored (single field, no translation, no fallback logic).
8. Docs: add ADR-002 (i18n+theming) to BETK_ARCHITECTURE.md; extend BETK_UI_SPEC.md Localization section (EN locale, /en, COALESCE name/title fallback, descriptions as-authored, switch location = Account→Settings).

DONE-WHEN
- pnpm build passes; TS strict clean.
- / and /foo serve AR; /en and /en/foo serve EN; bad locale → 404.
- Every prior middleware gate verdict provably unchanged (state each).
- <html> emits rtl/ar on AR, ltr/en on EN; theme class toggles light/dark.
- next-intl pipeline proven on one page.
- routes.ts, ADR-002, UI-Spec updated. No schema/migration touched.

STOP and flag (don't guess) if: any route move changes an existing URL; any gate can't be preserved; or theming requires editing a shared component's internals.
```

### BL-02 — Extract non-shared strings · **Sonnet**

```
TASK BL-02 — Extract non-shared UI strings. Model: Sonnet. Branch: feature/bilingual-i18n.
Read SESSION_CONTEXT. Depends on BL-01 pipeline.
SCOPE = non-shared only: app/(auth)/*, app/(buyer)/account/*, validations/*, Server Action error strings, constants/governorates.ts. EXCLUDE components/ui + components/shared (DS-I18N owns those).
DO: move every hardcoded Arabic literal in-scope into namespaced keys in messages/ar.json; add EN translations in messages/en.json (EN copy will be reviewed). Wire via useTranslations/getTranslations. Keep governorates as data with ar+en label fields.
Optionally add scripts/check-no-hardcoded-arabic.mjs guarding in-scope dirs (mirror existing guard-script style), excluding shared/ui + data constants.
DONE-WHEN: no hardcoded Arabic in in-scope files; ar/en key parity; build + TS clean; guard passes.
STOP if a string lives in a shared component (flag for DS-I18N).
```

### BL-03 — Settings language + theme switcher · **Sonnet**

```
TASK BL-03 — Language + theme switcher. Model: Sonnet. Branch: feature/bilingual-i18n.
Read SESSION_CONTEXT. Compose existing shared components only — no restyle.
DO: in Account→Settings add (1) language switch AR↔EN that navigates preserving current path (adds/removes /en) and sets the next-intl locale cookie; (2) theme switch light/dark/system via next-themes. Persist theme localStorage, locale URL+cookie. No DB column.
DONE-WHEN: theme flips + persists across reload; language switch keeps you on the same page in the other locale; no SSR hydration flash; build + TS clean.
```

### DS-I18N — De-hardcode shared kit · **Claude Design chat (NOT Cursor)**

```
Claude Design task DS-I18N. Branch: feature/bilingual-i18n.
The 21 shared catalog components (FilterSheet, StatusBadge, StockBadge, LevelBadge, PriceBlock, …) ship Arabic string literals baked in. Refactor each to accept its display strings as i18n keys/props (no Arabic literals inside), preserving all current visuals. Verify every component renders correctly on a DARK canvas (.dark) and under LTR (locale=en) — report bidi/mirroring or dark-contrast issues. Return updated components on this branch. Design-system change; Cursor must not edit these internals.
```

### BL-04 — Wire DS keys + in-app verify · **Sonnet** · *(issued when DS-I18N returns)*

Spec: wire keys exposed by de-hardcoded shared components; confirm `/en` renders LTR correctly and dark mode is clean across pages consuming the shared kit; no restyle. Exact prompt depends on DS output.

### BL-05 — Consolidated gate → merge · **Opus** · *(issued at that point)*

Spec (bilingual+theme gate only — design gate spent via PR #33):
- i18n foundation intact; AR/EN key parity; `COALESCE` name/title fallback correct; descriptions render as-authored.
- **Gate-security regression:** every middleware role gate gives the same verdict with/without `/en` (no bypass).
- LTR correct under `/en`; dark mode verified across representative pages.
- Design-system integrity preserved. Docs synced (OD-7, ADR-002, SESSION_CONTEXT, journal).
- → PR to `main`, gate, merge → **unblocks Phase 03 T02**.

---

## 6. Results tracker

| Task | Model | Status | HEAD / commit | Verdict | Notes |
|---|---|---|---|---|---|
| Step 1 recon | — | ✅ done | — | — | design-catalog ⊆ main |
| Step 2 branch | Sonnet | ✅ done | `b829dbf` | — | feature/bilingual-i18n pushed |
| BL-00 docs | Opus | ✅ done | `51cc79f` | — | OD-7 scope + BL scaffolding |
| BL-01 foundation | Opus | ✅ done | `f910cb6` | approved | next-intl+next-themes; `[locale]` move; middleware locale-before-gates (verdicts provably unchanged); build+TS+lint+unit green; runtime smoke passed |
| BL-01-FIX 404 | Opus | ✅ done | `f910cb6` | approved | removed `[locale]/loading.tsx`; homepage → `(public)/`; loading relocated to (public)/(auth)/(buyer). `/xx`,`/en/<unknown>`,`/<unknown>` now HARD **404**+noindex (localized UI); valid pages keep Suspense; all gate verdicts unchanged; `/xx/admin`→404 & `/en/admin`→gate-redirect (no leak); `.dark` on `<html>` confirmed (Playwright); build/TS/lint/guards/unit green. Folded into the BL-01 commit. |
| BL-02 strings | Sonnet | ✅ done | `22342de` | approved | all in-scope Arabic extracted to `messages/{ar,en}.json` (111/111 key parity, zero orphans); RSC pages use `getTranslations`(+`generateMetadata`), client components use `useTranslations`; Zod messages → keys via new `translateZodIssue` helper (resolved at render time, `t.has()`-guarded); 7 Server Actions localized; `scripts/check-no-hardcoded-arabic.mjs` guard added to CI (27 files, 0 found) + independently re-verified via ripgrep; `constants/governorates.ts` confirmed zero-diff; build+TS+lint+guards+unit(40) green pre- and post-commit; runtime smoke (AR+EN) passed on `/auth/{login,register,verify,phone}`+`/account`+`/blocked` |
| BL-03 switcher | Sonnet 5 | ✅ done | `95b469e` | approved | `LanguageSwitcher`/`ThemeSwitcher` (new, `account/_components/`) wired into a new Settings section on `/account`; `messages/{ar,en}.json` +`account.settings` (120/120 parity); no new route/dep/DB column; BL-03-VERIFY (read-only, pre-commit) PASS on all 5 sections — anti-flash `<html suppressHydrationWarning>`+`ThemeProvider` wiring, keyed-not-literal copy (grep sweep 0 matches), key parity 120/120 zero orphans, zero `components/ui`/`components/shared` diff, full regression (typecheck+lint+guards(3)+unit(40)+build green); gate-redirect smoke unchanged; not e2e-verified with a real authenticated session (Playwright chromium binary unavailable in this sandbox — no network egress) |
| DS-I18N kit | Claude Design | ✅ done | — | — | 16 of 21 shared components refactored to accept string/label props (Arabic defaults preserved, no restyle); 5 unchanged (EmptyState, StarRating, CategoryGrid, ImageGallery, CatalogSkeletons); landed by BL-04 |
| BL-04 wire | Sonnet 5 | ✅ done | `7e4a9f1` | approved | landed the 16 DS-I18N files verbatim (zero `components/ui` touched); `catalog.*` namespace in `messages/{ar,en}.json` (198/198 parity) incl. ICU plurals; new `src/i18n/catalogLabels.ts` builder helpers; `ErrorRetryCard` wired live (`error.tsx`); `CollectionStrip.dir` from locale server-side; new `catalogI18n.unit.test.ts` (26 tests, parity + ICU @0/1/2/3/11); BL-04-FIX folded in — reverted `StatusBadge.DEFAULT_LABELS` to `Partial<...>` (DS-I18N regression, `flag` domain never had labels, TS2741) restoring `main`'s exact contract, carry-forward to Design in §7; `_handoff` tree deleted; typecheck+build+lint+guards(3)+unit(66) all green |
| BL-05 gate+merge | Opus | ☐ | | | unblocks T02 |

---

## 7. Carry-forwards

- **Phase-04 listing form (DECIDED):** `title` is **required in both AR + EN**, enforced in the listing-form Zod schema; `title_en` stays nullable in DB (no migration). Categories are bilingual from the controlled list; descriptions/bios stay single-language as authored.
- **Order-history papercut (deferred):** `order_items` snapshots only `listing_title_ar`, so English buyers' order history shows the Arabic title. Fixing = a new `order_items.listing_title_en` column = future amendment. Acceptable for MVP.
- **T01-FIX security verdict** — independent DB/RLS review; own track.
- **Search vector quirk (pre-existing):** `update_listing_search_vector` uses `'arabic'`/`'english'` TS configs (not `unaccent`); runs `description_ar` through the English stemmer. Untouched by OD-7.
- **Pre-launch gates unaffected:** Google OAuth E2E (#13), TorvoSMS handset delivery / sender-ID, pg_cron timezone.
- **StatusBadge `flag` domain deferred (BL-04-FIX):** DS-I18N's de-hardcode of `StatusBadge.tsx` tightened `DEFAULT_LABELS`'s type from `Partial<Record<StatusDomain, Record<string, string>>>` to a non-partial `Record<StatusDomain, ...>`, but the map still only supplies the 7 domains it always has (order/seller/payment/listing/dispute/boost/payout) — `flag` (moderation flags) has never had labels, only colors (`constants/statusColors.ts`). This broke `typecheck`/`build` (TS2741). Reverted to `Partial<...>` (restores `main`'s exact pre-DS-I18N contract; zero behavior change) — did **not** author `flag` labels. `catalog.status.*` in `messages/{ar,en}.json` and the `catalogStatusLabels` builder (`src/i18n/catalogLabels.ts`) likewise cover only the 7 real domains. **Design to decide:** keep the map partial long-term, or complete `flag` (pending/reviewed/actioned/dismissed) with Arabic labels. Required before any flag/moderation badge renders (admin phase).
