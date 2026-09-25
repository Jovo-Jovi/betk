# CD-DELTA-6 handoff brief. Input to Claude Design. Not a design. Token names only.

Provenance for the human: branch base `07fbe95b000e2e444e555a2a43be6231619fee62` (PR #66 merge). This file does not mint a REG, OD, ADR, token, page, table, or requirement. Next free stays REG-93 / OD-22 / ADR-026.

Repo paths below are citations. Claude Design does not need the repository. Every rule required to build the kit is in this file.

---

## 0. For Claude Design

BETK is an Arabic-first marketplace for Egypt: home-based sellers and local buyers.
Buyers pay BETK, an admin verifies the deposit, and sellers are settled net of commission. Delivery is by courier.
This MVP sells physical products. Buyer and seller communication stays in the app.

Frozen scope, which replaces any older count in the design brief: **79 pages** and **51 tables**.

**Four contexts.** Arabic, right-to-left, is the default (unprefixed URLs). English, left-to-right, is served under `/en`. Each locale exists in a light theme and a dark theme. Every component in this brief must work in all four: AR-RTL light, AR-RTL dark, EN-LTR light, EN-LTR dark.

**LTR islands.** Amounts, references, phone numbers, and digits stay left-to-right inside either page direction. The surrounding label follows the page direction.

**Ownership.** Claude Design owns `components/ui` and `components/shared`. Cursor composes those components and wires data. Cursor does not restyle them. This brief states what each component accepts, shows, never shows, and emits. It does not state layout, anatomy, spacing, sizing, color values, typography values, icon choices, or utility classes.

**DS-I18N.** Every user-visible string is a string prop the app passes in. The component hardcodes no Arabic and no English. This brief proposes message-key names only. It does not edit the message catalog.

**No emojis. No hover-only affordances.** A control that appears only on hover is not a control. Hover may enhance a state that is already visible and reachable.

**Do not invent** a page, a table, a token value, or a user-visible channel list. If a component seems to need a token that is not in the list below, record an additive token proposal for the human to sanction. Propose no value.

**The 41 token names.** Name only. No values.

Design-brief section 2.1 (23):

`--background` `--foreground` `--primary` `--primary-foreground` `--accent` `--accent-foreground` `--destructive` `--destructive-foreground` `--secondary` `--secondary-foreground` `--muted` `--muted-foreground` `--success` `--success-foreground` `--warning` `--warning-foreground` `--card` `--card-foreground` `--popover` `--popover-foreground` `--border` `--input` `--ring`

Design-brief section 2.2 (12):

`--warning-text` `--accent-text` `--star` `--level-bronze-bg` `--level-bronze-fg` `--level-bronze-ring` `--level-silver-bg` `--level-silver-fg` `--level-silver-ring` `--level-gold-bg` `--level-gold-fg` `--level-gold-ring`

Design-brief section 2.4b (2):

`--info` `--info-foreground`

Design-brief section 2.3 (4):

`--footer-bg` `--footer-fg` `--footer-fg-muted` `--footer-logo`

---

## 1. Coverage

Status is measured on the branch base, from exports only. Waves follow the phase plan’s Stage D block table: Wave 1 is first needed by Phase 09, Wave 2 by Phases 10–12, Wave 3 by Phases 13–19. Pins have no wave. Where the UI spec gap list and the phase plan name different pages, both are listed and marked FLAG. They are not reconciled.

| Item | Status | Kit evidence | Pages | First phase | Wave | Cite |
|---|---|---|---|---|---|---|
| ShareButton | MISSING | No share export in `src/components/shared/index.ts`. No share file under `src/components/ui` or `src/components/shared`. | P04, P05 | 09 | 1 | UI spec §8. Phase plan §5, Phase 09. Pages agree. Absorbs REG-51. |
| Navigable store identity | PARTIAL | `src/components/shared/ListingCard.tsx` renders `storeName` as text and has no `href`. `src/components/shared/SellerMiniCard.tsx` renders `name` as text and has no `href`. `src/components/shared/StoreCard.tsx` renders `name` as text and has no `href`. | UI spec §8: P01, P02, P03, P04, P05, P12. Phase plan §5: Phase 09 names P01, P02, P04, P05; Phase 17 names P12. | 09 | 1 | FLAG. UI spec §8 includes P03. Phase 09 exit text says store-name navigation on P01–P05. The Phase 09 Stage D block line omits P03. Absorbs REG-72. Not reconciled. |
| DataTable | PARTIAL | `src/components/shared/CatalogSkeletons.tsx` exports `SkeletonTable`, a loading placeholder only. `src/components/ui` has no table base (button, badge, sonner, alert, tabs, avatar, select, sheet, input, textarea, card, switch, skeleton, dialog). | UI spec §8: P30, P33, P38, P42, P50, P51, P55, P56, P64, P73, P75. Phase plan §5: P33 (09); P38, P55, P75 (13); P73 (15); P56 (16); P50, P51, P64 (18); P42 (19). | 09 | 1 | FLAG. P30 is on the UI spec gap list and on no Stage D block line. The page map places P30 in signed Phase 05. Not reconciled. Design brief §5.11 describes a data table and is not an export. |
| ProofViewer | MISSING | `src/components/shared/ImageUploader.tsx` is an upload control. It does not show a signed URL without an upload affordance. | UI spec §8: P58, P49, P74. Phase plan §5: P49 (09); ProofViewer with no page named (12); P74 (15). | 09 | 1 | FLAG. P58 is on the UI spec gap list. The page map places P58 in Phase 12. The Phase 12 block line does not name P58. Not reconciled. |
| CartLine | MISSING | `src/components/shared/ListingCard.tsx` is a discovery card. It has no quantity editor, no blocked state, and no request-a-new-quote prompt. | P66, P15 | 10 | 2 | UI spec §8 and P66 (do not reuse the discovery card as a quantity line). Phase plan §5 Phase 10 names P66 and the checkout page’s lines when Phase 11 starts. That checkout page is P15. Pages agree. |
| CheckoutSellerSections | MISSING | No export in `src/components/shared/index.ts`. | P15 | 11 | 2 | UI spec §8. Phase plan §5 Phase 11 names the component. The page map places P15 in Phase 11. Pages agree. |
| SellerOrderMoney | PARTIAL | `src/components/shared/PriceBlock.tsx` renders one listing amount. It has no slots for subtotal, commission, refunded subtotal, and net, and no closed type that omits a fee and an order total. | P25, P38, P39, P41, P42, P43 | 13 | 3 | UI spec §8. Phase plan §5: Phase 13 names P25, P38, P39; Phase 19 names P41, P42, P43. The union agrees. Design brief §5.18 is the listing price, not this contract. |
| RateMatrixEditor | MISSING | No export in `src/components/shared/index.ts`. | P63 (Rates tab) | 14 | 3 | UI spec §8. Phase plan §5 Phase 14. Pages agree. |
| CourierLabelSheet | MISSING | No export in `src/components/shared/index.ts`. | P76 | 14 | 3 | UI spec §8. Phase plan §5 Phase 14. Pages agree. |
| ChartSeries | MISSING | No chart export under `src/components/ui` or `src/components/shared`. Design brief §5.38 records a chart placeholder as a stub, not an export. No chart dependency is declared in the app manifest (name search). | P46 | 19 | 3 | UI spec §8. Phase plan §5 Phase 19. Pages agree. |
| REG-52 onboarding category picker | PIN | `src/app/[locale]/(seller-onboarding)/seller/onboarding/_components/steps/StepCategory.tsx` uses a native select pair. `src/components/ui/select.tsx` exports Select. The step does not use that export. | P23 | none | none | UI spec §8.1. Phase plan §5: pins block no phase exit. Phase 09 composes Select. |
| REG-58 dark SearchBar contrast | PIN | `src/components/shared/SearchBar.tsx` | P02 | none | none | UI spec §8.1 and P02. Phase plan §5. Design brief §5.13 is the topbar search, not a license to restate a color. |
| REG-59 /account unstyled | PIN | `src/app/[locale]/(buyer)/account/page.tsx` | P09 | none | none | UI spec P09 and §8.1. Page owner stays Phase 02 (phase plan §4.b). |
| REG-60 seller-console logo not navigating home | PIN | `src/components/shared/ConsoleSidebar.tsx` renders the logo with no navigation callback. `src/app/[locale]/_components/SellerChrome.tsx` mounts that sidebar. `src/components/shared/AppTopbar.tsx` already has a logo activation callback. | Seller console. Not one P-number. | none | none | UI spec §8.1. Not REG-72. Design brief §5.15 is the sidebar. Design brief §7 says keep existing signatures until a decision here sanctions a change. |
| REG-23 design-repo URL + SHA | N/A — PIN | Not a component. Design brief intro still has the placeholder pointer. Design brief §9 (iii). | none | none | none | SESSION_CONTEXT REG-23. Phase plan §4.e: Stage D pin; does not block Phase 09 compose of the kit already in the repo. |

---

## 2. Component contracts

Wave order. Each contract has the same eleven fields. Callbacks are named and not implemented. A data prop’s source is LIVE (introspected column), TARGET (ERD §6 cite; the column is not live yet), GENERIC (the page supplies the cell), or FLAG (no column; the note says why).

### 2.1 ShareButton — Wave 1

**1. Purpose**

Give P04 and P05 one control that shares the public page link.

**2. Data contract**

| Prop | TS type | Required | Source | Note |
|---|---|---|---|---|
| href | string | yes | LIVE | Page builds the public URL from `stores.slug` (P05) or `listings.id` (P04). Both columns are live. The component does not read the database. |
| shareTitle | string | yes | LIVE | Page passes the locale title from `listings.title_ar` / `listings.title_en`, or the store name from `stores.name_ar` / `stores.name_en`. |

Callbacks, named and not implemented: `onFallback`. The component emits a device share of `href`, or `onFallback` when that sheet is unavailable (§5b). It emits no chosen application.

**3. States**

Default: the control can invoke the device share sheet. Loading: the sheet is in progress and the control is busy. Empty: `href` is absent, so the control is not offered. Error: the sheet is unavailable; the §5b fallback runs and an error string is announced. Disabled: the same as empty when the page has no public URL.

**4. Variants**

One. P04 and P05 use the same control. No per-application variant.

**5. RTL / LTR-island notes**

The label follows the page direction. If the fallback shows the URL, that URL is an LTR island. Digits in the title, if any, stay LTR islands.

**6. Themes**

Works in light and dark. Expected token names: `--primary`, `--primary-foreground`, `--foreground`, `--background`, `--border`, `--ring`, `--muted-foreground`.

**7. i18n**

String props, proposed keys: `share.action`, `share.fallback`, `share.copied`, `share.error`. The component receives the strings. It does not read the catalog.

**8. a11y**

A button. Accessible name is `share.action`. Keyboard activates it. Focus stays on the control when the sheet closes or the fallback completes. The result is announced. The fallback is visible without hover.

**9. Responsive**

At the mobile breakpoint named in design brief §3, this remains one control. It does not become a row of applications.

**10. MUST-NEVER-RENDER**

M4. ShareButton shares only a public BETK link, through the device share sheet or the §5b fallback. It never enumerates apps, never shares a private route (order, seller console, admin), and never opens a counterparty contact channel (REG-51; UI spec §8).

M3. This component takes no buyer-name prop and no buyer-location prop (REG-44; UI spec §4.b; pages #4, #5, #40, #47, #53, #18).

**11. Acceptance checklist**

- [ ] M4. The props type has no app list, no private-route field, and no counterparty contact field.
- [ ] M3. The props type has no buyer-name field and no buyer-location field.
- [ ] AR-RTL light, AR-RTL dark, EN-LTR light, and EN-LTR dark each show the same control.
- [ ] Empty: no `href` means no share control.
- [ ] Loading: the control is busy while the sheet is in progress.
- [ ] Error: sheet unavailable uses the §5b fallback and announces it.
- [ ] No hardcoded Arabic or English.
- [ ] Keyboard activates the control; focus returns; the outcome is announced; nothing is hover-only.
- [ ] The shared value is the public `href` only.

### 2.2 Navigable store identity — Wave 1

**1. Purpose**

Let the store name on the discovery cards open the public store, on the pages in §1.

**2. Data contract**

Applies to `ListingCard`, `SellerMiniCard`, and `StoreCard`. Existing name props stay. The missing capability is the destination.

| Prop | TS type | Required | Source | Note |
|---|---|---|---|---|
| storeName | string | yes on the cited pages | LIVE | `stores.name_ar` / `stores.name_en`. The page picks the locale column. ListingCard’s current prop is optional; these pages pass it. |
| storeHref | string | no, until §5a sanctions it | LIVE | Page builds the public store route from `stores.slug`. Absent means the name stays text. |

Callback, named and not implemented, only if §5a picks a callback instead of `storeHref`: `onOpenStore`. The control emits navigation to that public store route. It does not emit a seller-console route.

**3. States**

Default: name is a link when `storeHref` is present. Loading, empty, and error of the card stay on the parent, as the design brief already assigns them for these cards. Disabled: no `storeHref`, so the name is text and is not a failed link. No separate skeleton for the name alone.

**4. Variants**

The three existing cards only. No fourth identity card. P01 and P12 use StoreCard. P02, P03, and P05 use ListingCard’s store name. P04 uses SellerMiniCard. P03 is FLAG in §1.

**5. RTL / LTR-island notes**

The name follows the page direction. The link is the name itself in both directions.

**6. Themes**

Works in light and dark, including the cards’ existing themes. Expected token names for the link: `--primary`, `--foreground`, `--ring`, `--muted-foreground`. Do not restyle the rest of the card in this delta.

**7. i18n**

String prop, proposed key: `storeIdentity.openStore`. The page may pass a name that already includes the store name. The component hardcodes neither language.

**8. a11y**

The name is a link when `storeHref` is set, with accessible name from `storeIdentity.openStore`. It is not the same control as the listing activation on ListingCard. Keyboard reaches the store link separately from the card’s listing control. Focus is visible. No hover-only underline as the only cue that it is a link.

**9. Responsive**

At the mobile breakpoint named in design brief §3, the store name remains that link when `storeHref` is set. The destination is not revealed only on hover.

**10. MUST-NEVER-RENDER**

Cross-cutting only.

M3. This component takes no buyer-name prop and no buyer-location prop (REG-44; UI spec §4.b; pages #4, #5, #40, #47, #53, #18).

**11. Acceptance checklist**

- [ ] M3. The props type has no buyer-name field and no buyer-location field.
- [ ] Cross-cutting: no buyer identity, address, city, delivery fee, or order total field.
- [ ] With `storeHref`, the name navigates to the public store on ListingCard, SellerMiniCard, and StoreCard.
- [ ] Without `storeHref`, the name is text and is not a broken link.
- [ ] AR-RTL light, AR-RTL dark, EN-LTR light, and EN-LTR dark.
- [ ] Empty, loading, and error remain the parent card’s states; this delta adds no second error surface.
- [ ] The store link and the listing activation are separate keyboard stops on ListingCard.
- [ ] No hardcoded Arabic or English.
- [ ] Nothing about the link is hover-only.
- [ ] Existing card signatures change only as §5a sanctions.

### 2.3 DataTable — Wave 1

**1. Purpose**

One table for the admin and seller lists named in §1, so each page does not invent a table.

**2. Data contract**

| Prop | TS type | Required | Source | Note |
|---|---|---|---|---|
| columns | { id: string; header: string }[] | yes | GENERIC | Page supplies headers. `header` is a string prop. |
| rows | Record<string, string>[] | yes | GENERIC | Page supplies cells as strings, including already formatted amounts. |
| sort | { columnId: string; direction: "asc" \| "desc" } \| null | no | GENERIC | Controlled. See §5d. |
| pageIndex | number | no | GENERIC | Controlled. See §5d. |
| pageCount | number | no | GENERIC | Controlled. See §5d. |

Callbacks, named and not implemented: `onSortChange`, `onPageChange`. The component emits the next sort or the next page index. It does not fetch.

**3. States**

Default: columns and rows. Loading: a skeleton whose column count matches `columns`, not a spinner in place of the table. Empty: one empty message in place of rows; the page passes a positive empty string for admin queues. Error: the error string replaces the rows and a retry callback is offered. Disabled: a column that the page marks not sortable does not emit sort.

**4. Variants**

One table. Seller lists and admin lists are the same component. The positive empty string is a prop, not a second variant.

**5. RTL / LTR-island notes**

Header text follows the page direction. Cells the page marks as amounts, references, phones, or digits are LTR islands. The page tells the table which column ids are islands; the table does not guess from the script.

**6. Themes**

Works in light and dark. Expected token names: `--muted`, `--muted-foreground`, `--foreground`, `--border`, `--card`, `--card-foreground`, `--ring`, `--destructive`, `--background`.

**7. i18n**

String props, proposed keys: `dataTable.empty`, `dataTable.error`, `dataTable.retry`, `dataTable.previous`, `dataTable.next`, `dataTable.caption`. Admin “queue is clear” copy is whatever string the page passes for `dataTable.empty`. The component hardcodes neither language.

**8. a11y**

A table with a caption from `dataTable.caption`. Sortable headers are buttons. Pagination controls have accessible names. Keyboard moves through headers and pagination. Focus stays inside the control that was activated. Sort and page changes are announced. Empty and error are in the table, not only a color. No hover-only row action.

**9. Responsive**

At the mobile breakpoint named in design brief §3, it stays one table. The region scrolls on the inline axis. See §5d. It does not become a second layout.

**10. MUST-NEVER-RENDER**

Cross-cutting only.

M3. This component takes no buyer-name prop and no buyer-location prop (REG-44; UI spec §4.b; pages #4, #5, #40, #47, #53, #18).

The props type has no buyer-identity, address, city, delivery-fee, or order-total field. A generic column id is the page’s string. This component does not define those columns. See §5j.

**11. Acceptance checklist**

- [ ] M3. The props type has no buyer-name field and no buyer-location field.
- [ ] The props type has no delivery-fee field and no order-total field.
- [ ] AR-RTL light, AR-RTL dark, EN-LTR light, and EN-LTR dark.
- [ ] Empty: the page’s empty string shows, including a positive admin empty.
- [ ] Loading: skeleton column count matches `columns`.
- [ ] Error: error string plus retry, in place of rows.
- [ ] Sort and page index change only through the callbacks.
- [ ] Amount, reference, phone, and digit columns are LTR islands.
- [ ] No hardcoded Arabic or English.
- [ ] Keyboard can sort and page; nothing is hover-only.
- [ ] Mobile behaviour matches the §5d choice.

### 2.4 ProofViewer — Wave 1

**1. Purpose**

Show an admin a file that already exists, on the pages in §1, without an upload control.

**2. Data contract**

| Prop | TS type | Required | Source | Note |
|---|---|---|---|---|
| sourceUrl | string | yes | FLAG | A signed URL the page already minted. Not a column. Underlying path, by page: LIVE `seller_documents.storage_path` (P49); TARGET `master_orders.proof_path` (ERD §6.1, P58); TARGET `return_evidence.storage_path` (ERD §6.1, P74). The component does not choose the path and does not upload. |

Callback, named and not implemented: `onLoadError`. The component emits that when the URL does not load. It emits no file.

**3. States**

Default: the file displays. Loading: a placeholder until the URL loads. Empty: no `sourceUrl`, so nothing is framed as a document. Error: the URL failed, or the type is outside §5f; the error string shows. Disabled: not an editor, so there is no disabled edit state.

**4. Variants**

One viewer. P49, P58, and P74 use it. P58 is FLAG in §1. No upload variant.

**5. RTL / LTR-island notes**

The image is direction-neutral. Any caption follows the page direction. A reference, if the page passes one later, is out of scope for this contract.

**6. Themes**

Works in light and dark. Expected token names: `--background`, `--foreground`, `--card`, `--border`, `--muted`, `--destructive`, `--ring`.

**7. i18n**

String props, proposed keys: `proof.loading`, `proof.empty`, `proof.error`, `proof.unsupported`, `proof.imageName`.

**8. a11y**

An image with accessible name `proof.imageName` when the file is an image. Loading and error are announced. Keyboard can reach the viewer and any retry the error state offers. No hover-only zoom as the only way to see the file. No upload control in the tab order.

**9. Responsive**

At the mobile breakpoint named in design brief §3, the file remains visible without a hover zoom.

**10. MUST-NEVER-RENDER**

ProofViewer has no upload affordance and serves admin surfaces only (UI spec §8, §9 `storage.objects`).

M3. This component takes no buyer-name prop and no buyer-location prop (REG-44; UI spec §4.b; pages #4, #5, #40, #47, #53, #18).

**11. Acceptance checklist**

- [ ] No upload affordance, and the props type has no upload callback.
- [ ] M3. The props type has no buyer-name field and no buyer-location field.
- [ ] Admin surfaces only; the props type has no seller-audience member.
- [ ] AR-RTL light, AR-RTL dark, EN-LTR light, and EN-LTR dark.
- [ ] Empty: no `sourceUrl` shows the empty string, not a fake document.
- [ ] Loading: placeholder until the URL loads.
- [ ] Error: failed URL, or a type outside §5f, shows `proof.error` or `proof.unsupported`.
- [ ] Displays the file types §5f sanctions, and does not assume any other type.
- [ ] No hardcoded Arabic or English.
- [ ] Keyboard reaches the viewer; the image has an accessible name; nothing is hover-only.

### 2.5 CartLine — Wave 2

**1. Purpose**

Show one cart line on P66, and the same line inside checkout when Phase 11 starts (P15), including blocked lines and the request-a-new-quote prompt.

**2. Data contract**

| Prop | TS type | Required | Source | Note |
|---|---|---|---|---|
| lineId | string | yes | TARGET | `cart_items.id`, ERD §6.1. Table is not live. |
| title | string | yes | LIVE | `listings.title_ar` / `listings.title_en`. Page picks the locale column. |
| unitPrice | number | yes | TARGET | `cart_items.unit_price`, ERD §6.1. |
| quantity | number | yes | TARGET | `cart_items.quantity`, ERD §6.1. |
| isCustom | boolean | yes | TARGET | `cart_items.is_custom`, ERD §6.1. |
| stockQty | number \| null | yes | LIVE | `listings.stock_qty`. Null means untracked and is not a stock block. |
| quoteExpiresAt | string \| null | no | TARGET | `inquiries.quote_expires_at`, ERD §6.3. Column is not live. |
| storeName | string | yes | LIVE | `stores.name_ar` / `stores.name_en`. Name only. |
| blockedReason | "stock" \| "quote_expired" \| null | yes | FLAG | Derived, not a column. UI spec P66. Stock: tracked `stockQty` is zero (R-C05, AC-CART-5). Quote: custom quote expired (R-C05, R-Q06, AC-CART-4). The page computes it. |
| droppedAfterRestore | boolean | yes | FLAG | REG-82. The custom line is absent after restore. Not a column. |

Callbacks, named and not implemented: `onQuantityChange`, `onRemove`, `onRequestNewQuote`. The component emits those. It does not emit a fee.

**3. States**

Default: quantity can change and the line can be removed. Loading: quantity change in progress, controls disabled. Empty: not a line; the cart page owns the empty cart. Error: the change failed and the error string shows. Disabled: `blockedReason` is set, or `droppedAfterRestore` is set, so quantity does not change. Domain: `stock`, `quote_expired`, and the REG-82 dropped-quote prompt. No other blocked reason.

**4. Variants**

Fixed-price line, custom line (`isCustom`), blocked line, and dropped-quote prompt. P66 requires all four. P15 reuses the line and refuses checkout while any line is blocked; it does not add a fifth variant.

**5. RTL / LTR-island notes**

Title and store name follow the page direction. `unitPrice` and `quantity` are LTR islands.

**6. Themes**

Works in light and dark. Expected token names: `--card`, `--card-foreground`, `--foreground`, `--muted`, `--muted-foreground`, `--border`, `--primary`, `--primary-foreground`, `--destructive`, `--warning`, `--warning-foreground`, `--ring`.

**7. i18n**

String props, proposed keys: `cartLine.increase`, `cartLine.decrease`, `cartLine.remove`, `cartLine.blockedStock`, `cartLine.blockedQuote`, `cartLine.requestNewQuote`, `cartLine.custom`, `cartLine.error`.

**8. a11y**

The line is a group named by `title`. Quantity has increase and decrease buttons with accessible names. Remove has an accessible name. Blocked reason and the new-quote prompt are text, not color alone. Keyboard can change quantity, remove, and request a new quote. Focus stays on the control that was used. The result is announced. No hover-only remove.

**9. Responsive**

At the mobile breakpoint named in design brief §3, quantity, the blocked reason, and the new-quote action stay reachable without hover.

**10. MUST-NEVER-RENDER**

No per-seller delivery fee and no commission (UI spec P66). The props type has no field for either.

M3. This component takes no buyer-name prop and no buyer-location prop (REG-44; UI spec §4.b; pages #4, #5, #40, #47, #53, #18).

**11. Acceptance checklist**

- [ ] The props type has no delivery-fee field and no commission field.
- [ ] M3. The props type has no buyer-name field and no buyer-location field.
- [ ] Blocked reasons are only `stock` and `quote_expired`, matching the cites in field 3.
- [ ] `droppedAfterRestore` shows the new-quote prompt and no quantity editor.
- [ ] AR-RTL light, AR-RTL dark, EN-LTR light, and EN-LTR dark.
- [ ] Loading: quantity controls disabled while a change is in progress.
- [ ] Error: the error string shows and the previous quantity remains.
- [ ] Disabled when blocked.
- [ ] Amounts and quantity are LTR islands.
- [ ] No hardcoded Arabic or English.
- [ ] Keyboard path for quantity, remove, and new quote; nothing is hover-only.

### 2.6 CheckoutSellerSections — Wave 2

**1. Purpose**

Group P15’s lines under each seller while the buyer sees one combined delivery figure and one order total.

The checkout page, not this component, shows the master deposit of 50% (UI spec P15; ADR-022). This component has no deposit prop.

**2. Data contract**

The page passes one `sections` array. Each field below is its own data prop.

| Prop | TS type | Required | Source | Note |
|---|---|---|---|---|
| storeName | string | yes | LIVE | `stores.name_ar` / `stores.name_en`. Inside each section. |
| title | string | yes | LIVE | `listings.title_ar` / `listings.title_en`. Inside each line. Page picks the locale column. |
| quantity | number | yes | TARGET | `cart_items.quantity`, ERD §6.1. Inside each line. |
| unitPrice | number | yes | TARGET | `cart_items.unit_price`, ERD §6.1. Inside each line. |
| combinedDelivery | number | yes | FLAG | REG-91 projection. Not a `cart_items` column (UI spec P66 and P15). The stored result `master_orders.combined_delivery_total` is TARGET (ERD §6.1) and is written at checkout. This component displays the number the page passes. |
| orderTotal | number | yes | FLAG | UI spec P15: one order total. Not a cart column. Not a per-seller total. |

No callbacks. The component emits nothing. Place-order stays on the page.

**3. States**

Default: one or more seller sections, one combined delivery, one order total. Loading: sections not ready, skeleton in their place. Empty: no sections; the empty string shows and no total is invented. Error: the projection failed; the error string shows and no zero is presented as a real total. Disabled: not applicable; this block does not edit lines (CartLine does).

**4. Variants**

One. N sellers are N sections of that one variant, not N fee breakdowns.

**5. RTL / LTR-island notes**

Store names and titles follow the page direction. `unitPrice`, `quantity`, `combinedDelivery`, and `orderTotal` are LTR islands.

**6. Themes**

Works in light and dark. Expected token names: `--card`, `--card-foreground`, `--foreground`, `--muted-foreground`, `--border`, `--primary`, `--background`.

**7. i18n**

String props, proposed keys: `checkoutSections.delivery`, `checkoutSections.total`, `checkoutSections.empty`, `checkoutSections.error`.

**8. a11y**

Each seller is a named group (`storeName`). The combined delivery and the order total are text, labeled by the string props. Loading, empty, and error are announced. Keyboard can move through the groups. No per-seller money appears on focus. No hover-only total.

**9. Responsive**

At the mobile breakpoint named in design brief §3, the sections, the one combined delivery, and the one order total remain in the document. Width does not reveal a per-seller fee.

**10. MUST-NEVER-RENDER**

CheckoutSellerSections shows the buyer one combined total and never a per-seller fee or commission (UI spec §8). The props type has no per-seller fee field and no commission field.

M3. This component takes no buyer-name prop and no buyer-location prop (REG-44; UI spec §4.b; pages #4, #5, #40, #47, #53, #18).

**11. Acceptance checklist**

- [ ] One `combinedDelivery` and one `orderTotal`, outside the seller sections.
- [ ] The props type has no per-seller fee field and no commission field.
- [ ] M3. The props type has no buyer-name field and no buyer-location field.
- [ ] No deposit prop.
- [ ] AR-RTL light, AR-RTL dark, EN-LTR light, and EN-LTR dark.
- [ ] Empty: no sections, empty string, no invented total.
- [ ] Loading: skeleton, no fake total.
- [ ] Error: error string, and no zero presented as a real total.
- [ ] Amounts are LTR islands.
- [ ] No hardcoded Arabic or English.
- [ ] The one total is visible without hover, including at the mobile breakpoint.

### 2.7 SellerOrderMoney — Wave 3

**1. Purpose**

Show subtotal, commission, refunded subtotal, and net on P25, P38, P39, P41, P42, and P43.

**2. Data contract**

| Prop | TS type | Required | Source | Note |
|---|---|---|---|---|
| subtotal | number | yes | LIVE | `orders.subtotal` today. Target name `seller_orders.subtotal`, kept, ERD §6.2. |
| commissionAmount | number | yes | LIVE | `orders.commission_amount` today. Kept, ERD §6.2. |
| refundedSubtotal | number | yes | TARGET | `seller_orders.refunded_subtotal`, ERD §6.2. Not on live `orders`. Goods portion only. |
| net | number | yes | FLAG | Not a column. The page supplies it. Order rows use subtotal minus commission minus refunded subtotal (UI spec §4.a). P41 and P43 pass the available net, which also subtracts payouts (UI spec P41). The component does not add any other term. |

String props, not data: `labelSubtotal`, `labelCommission`, `labelRefundedSubtotal`, `labelNet`.

No callbacks. The component emits nothing.

The props type is only those four numbers and those four labels.

**3. States**

Default: all four figures, including a refunded subtotal of zero. Loading: skeleton of the four figures. Empty: the page has no order money; the empty string shows and no zero set is invented as earnings. Error: the figures failed; the error string shows. Disabled: not applicable; this block does not edit money.

**4. Variants**

One. P41 and P43 pass a different `net` value. They do not get a second component and they do not get a fee slot.

**5. RTL / LTR-island notes**

Labels follow the page direction. All four numbers are LTR islands.

**6. Themes**

Works in light and dark. Expected token names: `--foreground`, `--muted-foreground`, `--card`, `--card-foreground`, `--border`, `--background`.

**7. i18n**

Proposed keys for the four label props: `sellerMoney.subtotal`, `sellerMoney.commission`, `sellerMoney.refundedSubtotal`, `sellerMoney.net`, plus `sellerMoney.empty` and `sellerMoney.error`.

**8. a11y**

A definition list or an equivalent labeled group: each label names its amount. Loading, empty, and error are announced. Keyboard can reach the group. No figure is conveyed by color alone. No hover-only amount.

**9. Responsive**

At the mobile breakpoint named in design brief §3, all four figures remain. None is dropped because the width changed.

**10. MUST-NEVER-RENDER**

M1. SellerOrderMoney has no slot for delivery fee or order total. Its props type has no field for either, not even optional (REG-90, ADR-020; UI spec §8: a slot that exists will get filled). Allowed: subtotal, commission, refunded_subtotal, net, labels.

M3. This component takes no buyer-name prop and no buyer-location prop (REG-44; UI spec §4.b; pages #4, #5, #40, #47, #53, #18).

No buyer identity, address, or city field (N28; UI spec §4.a).

**11. Acceptance checklist**

- [ ] M1. The props type has no delivery-fee field and no order-total field, not even optional.
- [ ] Allowed figures are only subtotal, commission, refunded subtotal, and net, plus their labels.
- [ ] M3. The props type has no buyer-name field and no buyer-location field.
- [ ] No buyer identity, address, or city field.
- [ ] AR-RTL light, AR-RTL dark, EN-LTR light, and EN-LTR dark.
- [ ] Empty: empty string, no invented zeros.
- [ ] Loading: skeleton of the four figures.
- [ ] Error: error string, no partial fee.
- [ ] A refunded subtotal of zero still uses that slot rather than a fee slot.
- [ ] Amounts are LTR islands.
- [ ] No hardcoded Arabic or English.
- [ ] All four figures remain at the mobile breakpoint, without hover.

### 2.8 RateMatrixEditor — Wave 3

**1. Purpose**

Edit origin, destination, weight band, and fee on the P63 Rates tab.

**2. Data contract**

| Prop | TS type | Required | Source | Note |
|---|---|---|---|---|
| id | string | no | TARGET | `courier_rates.id`, ERD §6.1. Absent on a row the page has not saved. |
| originGovernorate | string | yes | TARGET | `courier_rates.origin_governorate`, ERD §6.1. |
| destinationGovernorate | string | yes | TARGET | `courier_rates.destination_governorate`, ERD §6.1. |
| weightMinG | number | yes | TARGET | `courier_rates.weight_min_g`, ERD §6.1. |
| weightMaxG | number \| null | yes | TARGET | `courier_rates.weight_max_g`, ERD §6.1. Null is the open upper band. |
| feeEgp | number | yes | TARGET | `courier_rates.fee_egp`, ERD §6.1. This is the rate cell, not `seller_orders.delivery_fee`. |
| governorateOptions | { value: string; label: string }[] | yes | FLAG | No governorate table in the 51. The page supplies the list. The component hardcodes none. |

Callbacks, named and not implemented: `onChange`, `onRemove`. The component emits the edited row or a remove. It does not write the database.

**3. States**

Default: rows can be edited. Loading: skeleton rows. Empty: no rates; the empty string and an add action. Error: a row is invalid or the save failed; the error string sits on that row. Disabled: while a save is in progress, the row does not accept another edit.

**4. Variants**

One editor, on the Rates tab of P63. Not a seller screen.

**5. RTL / LTR-island notes**

Option labels follow the page direction. Weights and `feeEgp` are LTR islands.

**6. Themes**

Works in light and dark. Expected token names: `--card`, `--foreground`, `--border`, `--input`, `--muted`, `--muted-foreground`, `--ring`, `--destructive`, `--background`.

**7. i18n**

String props, proposed keys: `rateMatrix.origin`, `rateMatrix.destination`, `rateMatrix.weightMin`, `rateMatrix.weightMax`, `rateMatrix.fee`, `rateMatrix.openEnded`, `rateMatrix.add`, `rateMatrix.remove`, `rateMatrix.empty`, `rateMatrix.error`.

**8. a11y**

Each row is a group. Fields have labels from the string props. Add and remove have accessible names. The error is announced. Keyboard can move across fields, add, and remove. Focus moves to the new row on add and stays predictable on remove. No hover-only remove.

**9. Responsive**

At the mobile breakpoint named in design brief §3, every field on a row stays reachable. The region may scroll on the inline axis. No field is hover-only.

**10. MUST-NEVER-RENDER**

Cross-cutting only. `feeEgp` is the rate cell named above. It is not an order fee and not an order total.

M3. This component takes no buyer-name prop and no buyer-location prop (REG-44; UI spec §4.b; pages #4, #5, #40, #47, #53, #18).

**11. Acceptance checklist**

- [ ] M3. The props type has no buyer-name field and no buyer-location field.
- [ ] No buyer identity, address, or city field, and no order-total field.
- [ ] `feeEgp` is only the `courier_rates` cell.
- [ ] AR-RTL light, AR-RTL dark, EN-LTR light, and EN-LTR dark.
- [ ] Empty: empty string plus add.
- [ ] Loading: skeleton rows.
- [ ] Error: row error string.
- [ ] Null `weightMaxG` uses the open-ended label.
- [ ] Weights and fees are LTR islands.
- [ ] No hardcoded Arabic or English, and no hardcoded governorate list.
- [ ] Keyboard can edit, add, and remove; nothing is hover-only.

### 2.9 CourierLabelSheet — Wave 3

**1. Purpose**

Render the admin pickup label on P76 from the recipient snapshot and the store pickup address.

**2. Data contract**

| Prop | TS type | Required | Source | Note |
|---|---|---|---|---|
| audience | "admin" | yes | FLAG | Not a column. Only this literal renders the payload (§5c). The type has no other member. |
| recipientName | string | yes | TARGET | `master_orders.recipient_name`, ERD §6.1. |
| recipientPhone | string | yes | TARGET | `master_orders.recipient_phone`, ERD §6.1. |
| snapshotGovernorate | string | yes | TARGET | `master_orders.snapshot_governorate`, ERD §6.1. |
| snapshotCity | string | yes | TARGET | `master_orders.snapshot_city`, ERD §6.1. |
| snapshotStreetAddress | string | yes | TARGET | `master_orders.snapshot_street_address`, ERD §6.1. |
| snapshotBuildingNotes | string \| null | no | TARGET | `master_orders.snapshot_building_notes`, ERD §6.1. |
| pickupGovernorate | string | yes | TARGET | `store_pickup_addresses.governorate`, ERD §6.1. |
| pickupCity | string | yes | TARGET | `store_pickup_addresses.city`, ERD §6.1. |
| pickupStreetAddress | string | yes | TARGET | `store_pickup_addresses.street_address`, ERD §6.1. |
| pickupBuildingNotes | string \| null | no | TARGET | `store_pickup_addresses.building_notes`, ERD §6.1. |
| displayRef | string \| null | yes | TARGET | `seller_orders.display_ref`, ERD §6.2. Render only when non-null (REG-81). The component invents no format. |
| legacyBetkRef | string \| null | no | LIVE | `orders.betk_ref`. Historical order number only (UI spec §4.a). |

Callback, named and not implemented: `onPrintRequest`. The component emits that for the admin page. It does not emit the payload to a seller.

**3. States**

Default: the label shows for `audience` admin. Loading: snapshot not ready. Empty: `audience` is missing, or the payload is incomplete, so the label does not render. Error: a required snapshot field failed; the error string shows and the label does not print a blank as if it were an address. Disabled: `audience` is not the admin literal; render nothing.

**4. Variants**

One admin sheet. P76 only.

**5. RTL / LTR-island notes**

Names and street text follow the page direction. Phone and whichever reference is non-null are LTR islands.

**6. Themes**

Works in light and dark. Expected token names: `--background`, `--foreground`, `--card`, `--border`, `--muted-foreground`.

**7. i18n**

String props, proposed keys: `courierLabel.recipient`, `courierLabel.phone`, `courierLabel.address`, `courierLabel.pickup`, `courierLabel.ref`, `courierLabel.empty`, `courierLabel.error`, `courierLabel.print`.

**8. a11y**

The sheet is a region named by `courierLabel.ref` when a reference exists. Print is a button with accessible name `courierLabel.print`. Phone is text the admin can select. Empty and error are announced. Keyboard reaches print. Focus starts on the sheet when it opens and returns to the page control that opened it. No hover-only print.

**9. Responsive**

At the mobile breakpoint named in design brief §3, the admin still gets one sheet. It does not turn into a seller summary that drops the address.

**10. MUST-NEVER-RENDER**

M2. CourierLabelSheet cannot mount on a seller route. Its payload carries buyer name, phone and address (N28, ADR-024, UI spec §8).

M3. This component takes no buyer-name prop and no buyer-location prop for a review context (REG-44; UI spec §4.b; pages #4, #5, #40, #47, #53, #18). The recipient fields above are the admin label payload, not a review.

**11. Acceptance checklist**

- [ ] M2. `audience` is only `"admin"`. Any other value, including omission, renders nothing.
- [ ] M2. The sheet is not a seller component and has no seller-route prop.
- [ ] M3. No review surface and no review buyer-name prop.
- [ ] Payload fields are only the recipient snapshot, the pickup address, and the references in field 2.
- [ ] `displayRef` renders only when non-null; no format is invented.
- [ ] AR-RTL light, AR-RTL dark, EN-LTR light, and EN-LTR dark.
- [ ] Empty: incomplete payload does not render a label.
- [ ] Loading: no partial address presented as final.
- [ ] Error: error string, and no blank printed as an address.
- [ ] Phone and references are LTR islands.
- [ ] No hardcoded Arabic or English.
- [ ] Keyboard reaches print; nothing is hover-only.

### 2.10 ChartSeries — Wave 3

**1. Purpose**

Show the seller snapshot series on P46.

**2. Data contract**

| Prop | TS type | Required | Source | Note |
|---|---|---|---|---|
| snapshotDate | string | yes | LIVE | `betk_analytics.seller_snapshots.snapshot_date`. |
| profileViews | number | yes | LIVE | `seller_snapshots.profile_views`. |
| listingViews | number | yes | LIVE | `seller_snapshots.listing_views`. |
| inquiriesReceived | number | yes | LIVE | `seller_snapshots.inquiries_received`. |
| ordersConfirmed | number | yes | LIVE | `seller_snapshots.orders_confirmed`. |
| revenueEgp | number | yes | LIVE | `seller_snapshots.revenue_egp`. Definition is subtotal-based (ERD §6.4). Writer unpinned. |
| viewsDuringBoost | number | no | LIVE | `boosts.views_during_boost`. Not a snapshot column. The page supplies the points it can align. The component does not invent dates. |

The page passes an array of points with those fields. An empty array is the empty state.

No callbacks required. If a point must be readable without hover, the component may emit `onPointFocus` (named, not implemented) and the page’s string props announce it.

**3. States**

Default: one or more points. Loading: skeleton in place of the series. Empty: no snapshots; the empty string shows. An empty series is the empty state, not a zero series (UI spec §4.a). Error: the series failed; the error string shows. Disabled: not applicable.

**4. Variants**

One series block for P46. No second chart for fees.

**5. RTL / LTR-island notes**

Series names follow the page direction. Dates, counts, and `revenueEgp` are LTR islands.

**6. Themes**

Works in light and dark. Expected token names, and no others: `--foreground`, `--muted`, `--muted-foreground`, `--border`, `--card`, `--background`, `--primary`, `--accent`, `--info`, `--success`, `--warning`. If those cannot distinguish the series, see §5e. Do not propose a value.

**7. i18n**

String props, proposed keys: `chart.profileViews`, `chart.listingViews`, `chart.inquiries`, `chart.ordersConfirmed`, `chart.revenue`, `chart.boostViews`, `chart.empty`, `chart.loading`, `chart.error`, `chart.pointLabel`.

**8. a11y**

The series has a name. Each included measure has a text label from the string props, not color alone. A focused point announces `chart.pointLabel`. Keyboard can move across points when more than one is present. Loading, empty, and error are announced. No hover-only readout.

**9. Responsive**

At the mobile breakpoint named in design brief §3, each value stays readable without hover.

**10. MUST-NEVER-RENDER**

Do not chart `total_amount` or `delivery_fee` (UI spec P46). The props type has no field for either.

M3. This component takes no buyer-name prop and no buyer-location prop (REG-44; UI spec §4.b; pages #4, #5, #40, #47, #53, #18).

**11. Acceptance checklist**

- [ ] The props type has no `delivery_fee` field and no `total_amount` field.
- [ ] M3. The props type has no buyer-name field and no buyer-location field.
- [ ] Series fields are only the LIVE columns in field 2.
- [ ] AR-RTL light, AR-RTL dark, EN-LTR light, and EN-LTR dark.
- [ ] Empty: empty string, not a fabricated zero series.
- [ ] Loading: skeleton.
- [ ] Error: error string.
- [ ] Dates and amounts are LTR islands.
- [ ] No hardcoded Arabic or English.
- [ ] A point’s value is available without hover.
- [ ] No new dependency unless §5e is sanctioned by the human.
- [ ] No chart-chrome spec is implied beyond the series the page passes (UI spec §8).

---

## 3. Pins

These block no phase exit (phase plan §5). This brief specifies no visual fix.

**REG-52.** Recorded defect: the seller-onboarding category and subcategory picker is poorly organized. Affected surface: P23, `StepCategory.tsx`, a native primary select and a native secondary select. `src/components/ui/select.tsx` already exports Select. The UI spec says P23 composes Select until the picker is replaced, and this gap list does not add a picker component. Acceptance line that closes it: the category step uses the existing Select, parent then child from live `categories.parent_id`, every label a string prop, and the cap stays the admin setting rather than a third slot invented here. This delta does not ship that step, because delivery does not edit pages.

**REG-58.** Recorded defect: dark-theme search-bar text and background contrast fails the cited AA bar. Affected component: `SearchBar.tsx`, on P02. Acceptance line that closes it: in dark theme, SearchBar text and its background are legible without hover, in both directions, using only the 41 token names. This brief does not name a value and does not say which token to swap.

**REG-59.** Recorded defect: `/account` renders unstyled. Affected page: P09, `account/page.tsx`. The UI spec composes Input, Select, ConfirmDialog, and Button, and leaves this defect open. Page owner stays Phase 02. Acceptance line that closes it: every visible region on P09 is composed from kit controls that already exist, in all four contexts, so the page is not an unstyled document. This delta does not edit the page and does not add an account component.

**REG-60.** Recorded defect: the seller-console logo does not navigate home. Affected component: `ConsoleSidebar.tsx`, mounted by `SellerChrome.tsx`. The logo is not a navigation control. `AppTopbar.tsx` already exposes a logo activation callback; the sidebar does not. This is not REG-72. Acceptance line that closes it: the sidebar logo exposes a navigation callback the page can point at home, in all four contexts, and activating it navigates. See §5i for the signature. This brief does not draw the logo.

**REG-23.** Unresolved: the design brief’s living-reference pointer is still a placeholder URL and a placeholder SHA. No design-repo URL was pinned in this session. It matters because the design brief’s generator rule says to derive a missing value from that reference or to stop and ask. Until a human pins the URL and SHA, this delta stops and asks. It does not derive. See §5h.

---

## 4. Cross-cutting MUST-NEVER-RENDER

N28 (MVP scope §8): sellers see no buyer location — not address, not city. Order ref, items, and prep deadline only. UI spec §4.a extends the seller deny-list to buyer name and phone as well, and to delivery fee and order total.

- No seller-facing component in this delta accepts buyer identity, address, city, delivery fee, or order total.
- CheckoutSellerSections shows the buyer one combined total and never a per-seller fee or commission (UI spec §8). Stated again in §2.6 field 10.
- ProofViewer has no upload affordance and serves admin surfaces only (UI spec §8, §9 `storage.objects`). Stated again in §2.4 field 10.
- M1 is §2.7 field 10 and field 11. SellerOrderMoney’s props type has no fee field and no order-total field.
- M2 is §2.9 field 10 and field 11. CourierLabelSheet cannot mount on a seller route.
- M3 (REG-44; UI spec §4.b; pages #4, #5, #40, #47, #53, #18): review surfaces show no buyer name and no buyer location. A neutral keyed label is passed as a string. No component in this delta takes a buyer-name or buyer-location prop for a review context. Each §2 contract repeats M3 in field 10 and field 11.
- M4 is §2.1 field 10 and field 11. ShareButton shares only a public link.

Precedent this delta establishes: a component that must never show a value has no prop for it, not a hidden prop and not an optional prop.

---

## 5. Decisions needed

**a. Navigable store identity versus “keep existing signatures”.**

Question: sanction an optional `storeHref` on ListingCard, SellerMiniCard, and StoreCard, or a separate wrapper?

Options: (1) optional `storeHref` on the three cards; (2) a wrapper that does not change the three signatures; (3) do not navigate.

Recommendation: (1). The missing capability is the destination on the name. A wrapper cannot reach the name without a slot the cards do not have. Absent `storeHref`, behaviour stays as it is.

Who decides: human. The design brief §7 says keep existing signatures.

What it blocks: closing REG-72, and Phase 09’s store-name navigation.

**b. ShareButton fallback when the device share sheet is unavailable.**

Question: what happens instead of the sheet?

Options: (1) one control that copies the public URL, label from a string prop; (2) the same copy control plus a retry of the sheet; (3) leave the fallback unspecified.

Recommendation: (1). Channels stay unenumerated.

Who decides: human. REG-51 is a product channel rule.

What it blocks: ShareButton’s error state, and closing REG-51.

**c. CourierLabelSheet mount guard.**

Question: what the component enforces, versus an engineering import guard?

Options: (1) the component renders the payload only when `audience` is `"admin"` and otherwise renders nothing; (2) the component has no guard and Phase 14’s CI import ban is the only guard; (3) both.

Recommendation: (3). The component guard is in §2.9. The CI ban of this module on seller routes is Phase 14 engineering. It is not Claude Design’s work.

Who decides: human, for the split. Claude Design implements only the `audience` literal.

What it blocks: CourierLabelSheet, and the Phase 14 label task’s review.

**d. DataTable base, sort, and small-screen behaviour.**

Question: how the table base is added, who owns sort and pagination, and what happens at the mobile breakpoint?

Options: base — (1) official shadcn CLI `table` add, byte-vanilla, the T00-LAND precedent, or (2) no `components/ui` file and a shared table only. Sort and pagination — (1) controlled props, or (2) internal state. Small screen — (1) one table, inline-axis scroll, or (2) a second stacked layout.

Recommendation: CLI `table` add; controlled props; one table with inline-axis scroll. A stacked layout is a second layout this brief does not authorize.

Who decides: human, for the CLI add into `components/ui`. Claude Design does not hand-write that file.

What it blocks: DataTable, which Wave 1 needs for P33.

**e. ChartSeries dependency.**

Question: does the series need a new dependency?

Options: (1) no new dependency; draw with the existing kit and the token names in §2.10; (2) add a chart library.

Recommendation: (1). If a library is required, that is a human decision. FLAG it. Claude Design does not add it.

Additive token proposal, only if the named tokens in §2.10 cannot tell the series apart in both themes: Claude Design names the proposal, the human sanctions it. No value in this brief. Recommendation is that no new token is needed.

Who decides: human, if the answer is yes to a dependency or to a new token.

What it blocks: ChartSeries, first needed by Phase 19.

**f. ProofViewer file types.**

Question: which types must display?

Measured this session, names only, no downloads, `storage.objects` grouped by bucket and name extension: `docs` has `jpg` (2 objects). `media` has `png` (3 objects). `media` is not the docs bucket. No other extension was present. PDF was not present. Do not assume PDF.

Options: (1) display jpeg only, and any other URL uses `proof.unsupported`; (2) also display types that are not in this measurement.

Recommendation: (1), because that is the measured docs bucket. Seller documents and payment proofs are the docs bucket (UI spec §9). A further type is a human sanction, not an assumption.

Who decides: human.

What it blocks: ProofViewer’s default and error states.

**g. Whether REG-52, REG-58, REG-59, and REG-60 ride with Wave 1.**

Question: include the four pins in the Wave 1 delivery?

Options: (1) Wave 1 carries them; (2) a later delta carries them; (3) each pin rides with the first wave that already touches its file.

Recommendation: (1) for REG-58 and REG-60, which are kit defects. REG-52 and REG-59 close by page composition, which this delta is forbidden to edit, so Wave 1 records them and does not pretend to close them.

Who decides: human.

What it blocks: nothing on a phase exit (phase plan §5). It blocks closing those four rows.

**h. REG-23.**

Question: pin a design-repo URL and SHA, or record that the brief stays self-contained?

Options: (1) the human supplies the URL and SHA; (2) this handoff stays self-contained and the placeholder is not a source.

Recommendation: (2) for this delta. Do not invent the URL. The generator rule then means stop and ask, which this file already does.

Who decides: human.

What it blocks: any future “derive from the design reference” step. It does not block the contracts in §2, which are stated here.

**i. REG-60 signature.**

Question: add a logo activation callback to ConsoleSidebar?

Options: (1) an optional callback, same role as the topbar’s existing logo callback; (2) no signature change, so the pin stays open; (3) fold it into Navigable store identity.

Recommendation: (1). Do not fold it into REG-72 (UI spec §8.1).

Who decides: human. Design brief §7.

What it blocks: closing REG-60. Not Phase 09’s exit.

**j. DataTable generic columns.**

Question: can a generic column id carry a forbidden seller field?

Options: (1) the table defines no such column, and page review catches a bad id; (2) the table embeds an allow-list of column ids.

Recommendation: (1). An allow-list would invent a schema inside the kit. Seller pages still must not pass buyer identity, address, city, delivery fee, or order total (UI spec §4.a). The kit slot for those does not exist.

Who decides: human.

What it blocks: nothing in Wave 1 if (1) is accepted. It blocks a false sense that the generic table is itself the N28 boundary.

---

## 6. Blockers and dependencies per wave

**Wave 1.** Phase 09 stays blocked until this wave passes review and REG-75 and REG-88 are pinned (phase plan and session context). ShareButton and store `slug` use live columns. DataTable has no new column. ProofViewer’s P49 path is live `seller_documents.storage_path`. P58’s `master_orders.proof_path` and P74’s `return_evidence.storage_path` are TARGET and land in Phase 08; the viewer can still be built against `sourceUrl`. Legal prose is Stage E. It is not in this delta. P67–P70 and the agreement bodies stay out.

**Wave 2.** `cart_items` and `inquiries.quote_expires_at` are TARGET (ERD §6.1 and §6.3) and land in Phase 08. CartLine and CheckoutSellerSections can be built before those columns exist. Pages cannot wire them until Phase 08 has written them and Phases 10 and 11 compose them. The combined delivery figure is a projection (REG-91), not a cart column. REG-79 (phone versus add-to-cart) is not this delta. The deposit of 50% stays on the checkout page (UI spec P15; ADR-022), not inside CheckoutSellerSections.

**Wave 3.** `seller_orders.refunded_subtotal`, `seller_orders.display_ref`, `courier_rates`, `master_orders` recipient columns, and `store_pickup_addresses` are TARGET and land in Phase 08. Subtotal and commission are live on `orders`. Snapshot columns and `boosts.views_during_boost` are live, so ChartSeries has no Phase 08 column wait. REG-81’s reference format stays unpinned: the label renders the string it is given. REG-92 (the grant guard) is Phase 08 engineering, not Claude Design. Courier mechanism stays ADR-024 and is not chosen here. Legal prose for returns is Stage E and is not in this delta.

---

## 7. Delivery contract

Deliver per wave. Wave 1 first. One delta zip per wave. The zip contains:

- `components/shared` files for that wave’s items;
- `components/ui` files only as official shadcn CLI adds, byte-vanilla;
- the updated `components/shared/index.ts`;
- `CHANGELOG-DELTA.md`;
- any design-brief addendum text marked `sanctioned CD-DELTA-6`, for human review.

No edits to pages, services, queries, message catalogs, or token values.

Existing signatures change only where §5 sanctions the change.

Cursor lands each zip byte-for-byte in a CD-DELTA-6-LAND task.

Review happens in the planning chat against the §2 checklists. Phase 09 stays blocked until Wave 1 passes review and REG-75 and REG-88 are pinned.

Per-wave acceptance:

- every checklist ticked;
- four-context proof per item (AR-RTL / EN-LTR, each in light and dark);
- zero hardcoded strings;
- no forbidden field in any props type.
