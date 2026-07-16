# BETK_UI_SPEC.md

> **Source & provenance note.** The uploaded corpus consists of the three BETK Architecture Review conversations: **C1 — Domain Modeling & Entity Discovery**, **C2 — ERD & Database Architecture**, and **C3 — Supabase Production Schema (SQL, RLS, pg_cron)**. No standalone *Dev OS* file and no standalone *Wireframes* file were present in the uploads. The page-by-page UI surface is nevertheless fully specified *inside* these documents as: the 70-row Use Case Coverage Matrix (C2 §6), the Actor User Journeys and Marketplace Workflows WF1–WF10 (C1 §1.3–1.4), and the explicit screen/tab references embedded in the Entity Catalog "Use Case(s)" columns (e.g. *Seller Inbox*, *Wishlist & Saved*, *Followed Sellers tab*, *Seller Dashboard*, *Level Progress*, *Store Header*, *Moderation Log tab*, *Homepage featured strip*). Every page below maps to one or more of those documented surfaces. Data requirements are cross-referenced against the physical tables, columns, enums, and RLS policies defined in C2 §3 / C3 §3–5. No page or feature has been invented; gaps in either direction are flagged inline as **[DATA GAP]** or **[UI GAP]**.
>
> *Schema count clarification:* C2/C3 label the schema "28 tables," but the detailed table specifications actually define **43 physical tables** across 13 domains (the "28" is a stale headline count). This spec validates against all 43.

---

## 1. Design System

**The visual language is defined in one place: [`BETK_DESIGN_BRIEF.md`](./BETK_DESIGN_BRIEF.md) — the LOCKED, self-contained design source.** All token *values* (all frozen tokens, light **and** dark), the type / spacing / radius / shadow scales, per-component anatomy (with default/skeleton/empty/error states, RTL-canonical + explicit LTR notes), and the logo system live there. **This spec does not duplicate value tables** — it references the brief so there is a single source. When a value or component detail is needed, read the brief; never inline a hex/HSL here.

The design system is constrained by three documented requirements: **bilingual Arabic/English** with **Arabic-first RTL as the canonical direction** and EN-LTR mirrored (G5, C1 §1.1; OD-7 — see §4 Localization & theming), a trust-forward marketplace aesthetic (G2), and a low-end Egyptian mobile-network target (C2 §7.3 — connection churn, aggressive caching; no hover-only controls). Everything must be usable in all four AR-RTL / EN-LTR × light / dark contexts.

- **Component library:** shadcn/ui (Radix primitives + Tailwind). All interactive primitives (Dialog, Sheet, DropdownMenu, Tabs, Toast, Command, Form) come from shadcn. Direction/lang derive from the `[locale]` layout (`ar → dir="rtl" lang="ar"`, `en → dir="ltr" lang="en"`); LTR islands (Latin handles, BETK refs, tracking numbers, prices, OTP) use `dir="ltr"` wrappers.
- **Styling:** Tailwind CSS (v3.3+), native logical-property utilities (`ps-*/pe-*/ms-*/me-*/start-*/end-*/rounded-s-*/rounded-e-*`) resolve correctly under both directions — **no `tailwindcss-rtl` plugin, no raw `left/right`** in shared components.
- **Tokens & scales:** see `BETK_DESIGN_BRIEF.md §2` (color tokens, light + dark; frozen names) and `§3` (type / spacing / radius / shadow). Token names are FROZEN (`tailwind.config.ts` + shared components + DS-I18N wiring depend on them).
- **Status-to-color mapping** is centralized (see §4 `StatusBadge` and `constants/statusColors.ts`) so the order/seller/dispute/payment enums from C3 §2 render consistently everywhere; the per-enum tints are recorded in `BETK_DESIGN_BRIEF.md §5.5`.

---

## 2. Navigation Structure

### Top-level routes

```
/                         Homepage (public)
/search                   Search & filter results (public)
/category/[slug]          Category browse (public)
/listing/[id]             Listing detail (public)
/store/[slug]             Public storefront (public)
/auth/login               Phone entry (public)
/auth/verify              OTP verification (public)
/auth/register            Complete buyer profile (public, mid-auth)
/account, /wishlist, /orders, /inbox, /notifications, /checkout, /disputes/[id]   Buyer (protected)
/seller/**                Seller console (role: seller)
/admin/**                 Admin console (role: admin | superadmin)
```

### Auth gates

Gates map directly to C3 §5 RLS. Four levels:

- **public** — no session. RLS allows `SELECT` where `status='active'` (stores, listings, categories), `is_visible=TRUE` (reviews), `status='live'` (collections). Guest can read but cannot write (no wishlist, no inquiry, no checkout — C1 Guest journey).
- **protected** — any authenticated user (`auth.uid()` present). Buyer self-scoped tables: `buyer_profiles`, `addresses`, `wishlists`, `notifications`, own `orders/inquiries/disputes`.
- **role: seller** — `users.role='seller'` AND `seller_profiles.status` gate. Store-scoped data resolved via `betk.my_store_id()`. A `pending` seller is routed to `/seller/status`, not the dashboard (R-S04).
- **role: admin** — `betk.is_admin()` (`role IN ('admin','superadmin') AND status='active'`). Admin bypasses row scoping on all tables.

Suspended/banned users (`users.status`) are blocked at the gate on every authenticated request (R-A05).

### Navigation patterns

- **Public + Buyer:** sticky **topbar** (logo → `/`, full-width search, category menu, notifications bell, account menu / "Login") + **mobile bottom nav** (Home · Search · Wishlist · Inbox · Account). RTL: logo on the right, account cluster on the left.
- **Seller console:** persistent **left sidebar** (Dashboard, Listings, Inbox, Orders, Reviews, Earnings, Boosts, Analytics, Store Settings) collapsing to a Sheet on mobile; topbar shows store avatar, level badge, payout balance.
- **Admin console:** persistent **left sidebar** grouped (Overview · Moderation · Catalog · Commerce · Content · System) collapsing to a Sheet on mobile; topbar shows SLA alert counters (seller-approval 24h, dispute 48h, flagged-content 24h).

---

## 3. Pages

Pages are grouped by surface area. Every page lists its documenting use case(s) and validates data needs against C2/C3 tables.

---

### — PUBLIC / GUEST —

### Homepage
- **Route:** `/`
- **Auth gate:** public
- **Layout:** PublicShell (topbar + bottom nav)
- **Use case(s):** Browse Homepage; Homepage featured strip (WF3)
- **Components:** Hero/search bar, `CategoryGrid` (icon tiles), `CollectionStrip` (one horizontal carousel per live collection, ordered by `homepage_position`), `ListingCard` grids for "New Arrivals" and "Featured/Boosted", `StoreCard` row for featured stores, footer.
- **Data requirements:** `collections` (status='live', ordered by `homepage_position`) → `collection_listings` (sort_order) → `listings`; `categories` (is_active, sort_order, icon_url); `listings` (status='active', `deleted_at IS NULL`, ordered `created_at DESC` for new arrivals); boosted set = `boosts` (status='active') joined to `listings`; `listing_images` (sort_order=0 hero); `rating_aggregates` (average_rating, total_reviews) per store on each card; `stores` (name_ar, avatar_url, level badge via `seller_profiles.level`). Cache: collections/new-arrivals 60s TTL, rating_aggregates 5-min TTL (C2 §7.3).
- **User flows:** Happy — guest lands, scrolls collections/categories, taps a `ListingCard` → `/listing/[id]`. Edge — tap wishlist on a card while unauthenticated → redirect to `/auth/login` with return URL.
- **Empty state:** No live collections → fall back to pure "New Arrivals" grid; if zero active listings platform-wide → friendly "BETK is just getting started" panel with a Become-a-Seller CTA.
- **Loading state:** Skeleton — category tiles as muted circles, two skeleton carousels (4 card skeletons each), new-arrivals grid skeleton (8 cards). Progressive: render collections as each resolves.
- **Error state:** Section-level inline retry card per failed strip (homepage never hard-fails as a whole); topbar toast on total fetch failure.

### Search & Filter Results
- **Route:** `/search?q=&category=&governorate=&city=&type=&price_min=&price_max=&sort=`
- **Auth gate:** public
- **Layout:** PublicShell
- **Use case(s):** Search Listings, Filter Listings (WF3)
- **Components:** `SearchBar` (1–2 keyword, C2 decision), `FilterSheet`/sidebar (category tree, type product|service, governorate, city, price range, sort), active-filter chips, `ListingCard` grid, sort dropdown (relevance, newest, price, popularity), pagination/infinite scroll, boosted-results banner at top of relevant category.
- **Data requirements:** `listings.search_vector` (tsvector, GIN, `unaccent` for Arabic) filtered by `status='active' AND deleted_at IS NULL`; `categories` for the filter tree (self-referential `parent_id`); `stores.governorate/city` for location filter; price on `listings.price`; sort by `created_at DESC` / `view_count DESC`; boosted ranking via `boosts.status='active'` (R-B04); `listing_images` hero; `rating_aggregates` per card.
- **User flows:** Happy — type keyword → results render → refine via FilterSheet → tap card. Edge — query returns nothing; filters too narrow; RTL Arabic input normalization via `unaccent`.
- **Empty state:** "No results for «{query}»" with suggestions to clear filters + popular categories; if filters applied, a one-tap "Clear all filters".
- **Loading state:** Card-grid skeleton (12 cards); filter rail renders immediately from cached categories.
- **Error state:** Inline "Search is temporarily unavailable" card with retry; preserves entered query and filters in the URL.

### Category Browse
- **Route:** `/category/[slug]`
- **Auth gate:** public
- **Layout:** PublicShell
- **Use case(s):** Filter Listings; Manage Categories (consumer view)
- **Components:** Category header (name_ar, icon), subcategory chips, `FilterSheet`, `ListingCard` grid, breadcrumb.
- **Data requirements:** `categories` resolved by `slug` (+ children where `parent_id = category.id`); `listings` where `category_id` or `subcategory_id` matches, `status='active'`; `listing_images`, `rating_aggregates`.
- **User flows:** Happy — tap category tile on homepage → browse → drill into subcategory chip. Edge — inactive/hidden category (`is_active=false`) → 404; empty category.
- **Empty state:** "No active listings in {category} yet" + link to parent category and homepage.
- **Loading state:** Header skeleton + 12-card grid skeleton.
- **Error state:** Full-page error card with retry and link home.

### Listing Detail
- **Route:** `/listing/[id]`
- **Auth gate:** public (write actions gated)
- **Layout:** PublicShell
- **Use case(s):** View Listing Detail; Upload Product Images (display side); Save to Wishlist; Send Inquiry (entry)
- **Components:** `ImageGallery` (up to 5, sort_order, hero first), title (ar/en), `PriceBlock` (handles `price_type`: fixed / per_hour / starting_from / quote_only), stock/availability badge (product vs service vs made-to-order), tag chips, seller mini-card (avatar, name, level badge, rating, avg response time), `WishlistButton`, `InquiryButton` → opens inquiry composer, share button (WhatsApp deep-link), reviews summary + recent reviews list with photos and seller replies, "more from this store" rail, restock-alert toggle when `sold_out`.
- **Data requirements:** `listings` (full row; increments `view_count`); `listing_images` (ordered); `listing_tags`; `stores` + `seller_profiles` (level, is_verified, avg_response_hours); `rating_aggregates` (avg + distribution); `reviews` (is_visible=TRUE, with `seller_reply`) → `review_photos`; `wishlists` (current buyer membership) + `restock_alerts` for sold-out; price/stock rules R-L05/06/09. `is_made_to_order`, `stock_qty`, `low_stock_threshold`, `accepts_custom_orders`, `custom_order_notes`.
- **User flows:** Happy — view → tap Inquire → composer (quantity, delivery_preference, special_requests) → submit (requires auth). Edge — guest taps Inquire/Wishlist → `/auth/login` return-redirect; `quote_only` hides quantity/price-paid; `sold_out` swaps CTA to "Notify me when back" (writes `restock_alerts`); soft-deleted/removed listing → 404.
- **Empty state:** No reviews yet → "Be the first to review after purchase"; no other listings from store → hide rail.
- **Loading state:** Gallery skeleton + title/price skeleton + reviews skeleton block.
- **Error state:** 404 for missing/removed; otherwise full-page retry card.

### Public Storefront
- **Route:** `/store/[slug]`
- **Auth gate:** public
- **Layout:** PublicShell
- **Use case(s):** View Seller Storefront; Follow Seller; Store Header / Level badge
- **Components:** Cover banner + avatar, store name (ar/en), bio, **verified badge**, level badge (Bronze/Silver/Gold), rating summary (avg + count + distribution bars), avg response time, `FollowButton`, governorate/city, return policy accordion, tabs: Listings (filterable grid) · Reviews · About (payment & delivery methods). 
- **Data requirements:** `stores` by `slug` (status='active' RLS); `seller_profiles` (level, is_verified, avg_response_hours, total_orders_completed, total_reviews_count); `rating_aggregates`; `listings` (store_id, active); `reviews` (store_id, is_visible); `store_follows` (current buyer membership + count); `stores.payment_methods` / `delivery_options` (JSONB) / `return_policy`.
- **User flows:** Happy — open storefront → browse listings tab → follow store (writes `store_follows`, unique buyer+store). Edge — guest follow → login redirect; suspended store (R-S07) → 404/"unavailable"; slug not found → 404.
- **Empty state:** Store with no active listings → "This store has no live listings yet"; no reviews → reviews tab empty copy.
- **Loading state:** Cover/avatar skeleton, stat-row skeleton, listings grid skeleton.
- **Error state:** Full-page retry; 404 on unknown/suspended slug.

---

### — AUTH —

### Phone Entry (Login / Register start)
- **Route:** `/auth/login`
- **Auth gate:** public
- **Layout:** AuthShell (centered card, RTL)
- **Use case(s):** Sign In, Register (R-A01, R-A03)
- **Components:** Phone input (E.164 `+20` prefix, LTR island for digits), "Send code" button, **"Continue with Google" button (Supabase OAuth — OD-4)** with an "or" divider, terms/role note, link "Become a seller", error/help text. No password field anywhere (R-A01 amended: OTP + Google OAuth only, still no passwords).
- **Data requirements:** Writes/reads `otp_tokens` (creates token, `expires_at = NOW()+60s`, one active per phone — R-A02; `token_hash` only, never raw); checks `users.phone_number` uniqueness to branch new vs returning (R-A03). Suspended/banned check on returning users (R-A05).
- **User flows:** Happy — enter phone → request OTP → `/auth/verify`. Edge — invalid format; rate-limited resend (R-A02, `attempt_count`); suspended account message.
- **Empty state:** N/A (single form).
- **Loading state:** Button spinner ("Sending code…"); inputs disabled during request.
- **Error state:** Inline field error (format/uniqueness); toast on SMS-dispatch failure with retry.

### OTP Verification
- **Route:** `/auth/verify`
- **Auth gate:** public (mid-auth)
- **Layout:** AuthShell
- **Use case(s):** Sign In, Register, Forgot Password
- **Components:** 6-digit OTP input (mono, LTR), 60s countdown timer, resend button (disabled until expiry), change-number link.
- **Data requirements:** Verifies against `otp_tokens` (`token_hash`, `expires_at`, `is_used`, `attempt_count` ≤ 5 — R-A02); on success creates `sessions` (token_hash, device_info, expires_at: 30d mobile / 24h web) and sets `users.last_login_at`; resolves `users.role` for routing.
- **User flows:** Happy — enter code → verified → role routing (buyer→`/auth/register` if no profile else `/`; seller→`/seller` or `/seller/status`; admin→`/admin`). Edge — expired code → prompt resend; >5 attempts → lockout message; reused token rejected.
- **Empty state:** N/A.
- **Loading state:** Inline verify spinner on the digit field.
- **Error state:** Shake + inline "Incorrect or expired code"; resend path always offered.

### Complete Buyer Profile
- **Route:** `/auth/register`
- **Auth gate:** protected (session exists, profile incomplete)
- **Layout:** AuthShell
- **Use case(s):** Register (buyer_profiles creation)
- **Components:** Form — full_name (required), governorate select (27 Egyptian governorates), city (optional), interests multi-select (category slugs), notification prefs toggles (push/sms/whatsapp/email), submit.
- **Data requirements:** Inserts `buyer_profiles` (id = users.id, full_name NN, governorate NN, interests JSONB, notification_prefs JSONB); `categories` for the interests picker.
- **User flows:** Happy — fill → save → land on `/` personalized. Edge — skip optional fields; governorate required validation.
- **Empty state:** N/A.
- **Loading state:** Submit button spinner.
- **Error state:** Field-level validation; toast on save failure (session preserved).

---

### — BUYER —

### Account / Profile
- **Route:** `/account`
- **Auth gate:** protected
- **Layout:** BuyerShell
- **Use case(s):** Manage Profile; Account Deletion (MW1)
- **Components:** Editable profile form (full_name, governorate, city, interests, notification prefs), avatar (optional), add/verify-phone prompt for Google-only users (OD-4), links to Addresses / Wishlist / Following / Orders / Notifications, "Become a seller" CTA, **Deactivate account** (destructive, confirm dialog), logout.
- **Data requirements:** `buyer_profiles` (read/update own — RLS `bp_self`); `users` (phone read-only, R-A06; status); for delete: MW1 anonymization preserving `orders` references. **[DATA GAP]** — MW1 account-deletion workflow requires an anonymization/retention state, but no `deleted_at`/`anonymized_at` column exists on `users` or `buyer_profiles` in the schema; deletion behavior is undefined at the data layer.
- **User flows:** Happy — edit fields → save (toast). Edge — attempt to edit phone → blocked, "requires re-verification" (R-A06); delete account → confirm modal → MW1.
- **Empty state:** N/A.
- **Loading state:** Form skeleton on first load.
- **Error state:** Field validation + save-failure toast.

### Address Book
- **Route:** `/account/addresses`
- **Auth gate:** protected
- **Layout:** BuyerShell
- **Use case(s):** Manage Addresses
- **Components:** Address list cards, add/edit `AddressForm` (label, governorate, city, street_address, building_notes, is_default), set-default toggle, delete (confirm).
- **Data requirements:** `addresses` (CRUD own — RLS `addr_self`); enforce max one `is_default=true` per buyer at app layer.
- **User flows:** Happy — add address → set default → reused at checkout. Edge — deleting the default → prompt to choose a new default; deleting an address referenced by an active order (kept via `orders.delivery_address_id` nullable).
- **Empty state:** "No saved addresses" + prominent "Add address" CTA.
- **Loading state:** List skeleton (3 rows).
- **Error state:** Inline form errors; toast on save/delete failure.

### Wishlist & Saved
- **Route:** `/wishlist`
- **Auth gate:** protected
- **Layout:** BuyerShell
- **Use case(s):** Save to Wishlist; Wishlist Restock Alert Toggle
- **Components:** Saved `ListingCard` grid, per-item remove, **restock-alert toggle** on sold-out items, "in stock again" badge.
- **Data requirements:** `wishlists` (own — RLS `wishlist_own`) → `listings` + `listing_images` + `rating_aggregates`; `wishlists.restock_alert` flag; sold-out items surface restock toggle that writes `restock_alerts` (R-N06).
- **User flows:** Happy — view saved → tap into listing or remove. Edge — saved listing removed/soft-deleted by seller → show "no longer available" tombstone; toggle restock on sold-out item.
- **Empty state:** "Your wishlist is empty" + browse CTA.
- **Loading state:** Card-grid skeleton (6 cards).
- **Error state:** Inline retry card.

### Followed Sellers
- **Route:** `/account/following`
- **Auth gate:** protected
- **Layout:** BuyerShell
- **Use case(s):** Follow Seller; Followed Sellers tab
- **Components:** Followed `StoreCard` list (avatar, name, level, rating, new-listing count), unfollow button.
- **Data requirements:** `store_follows` (own) → `stores` + `seller_profiles` (level) + `rating_aggregates`; new-listing indicator from `listings.created_at > followed_at`.
- **User flows:** Happy — view followed stores → open storefront / unfollow. Edge — followed store suspended → hidden/"unavailable".
- **Empty state:** "You're not following any stores yet" + discover CTA.
- **Loading state:** List skeleton (4 rows).
- **Error state:** Inline retry.

### Buyer Inbox (Inquiries)
- **Route:** `/inbox` · thread `/inbox/[inquiryId]`
- **Auth gate:** protected
- **Layout:** BuyerShell (list + thread; split on desktop, stacked on mobile)
- **Use case(s):** Send Inquiry, Respond to Inquiry
- **Components:** Thread list (store, listing thumb, last message, unread dot, status chip), `MessageThread` (bubbles by sender_type), composer, listing context header, "seller confirmed → go to checkout" banner when `status='confirmed'`, WhatsApp deep-link button.
- **Data requirements:** `inquiries` (buyer_id = self — RLS `inq_buyer`; status open/replied/confirmed/declined/expired; `converted_to_order_id`); `inquiry_messages` (sender_id, sender_type buyer|seller, is_read, body); ordered by `last_message_at DESC` (C2 §7.1 index); `listings`/`stores` for context.
- **User flows:** Happy — send inquiry from listing → seller replies → seller confirms → CTA to `/checkout`. Edge — declined/expired inquiry (read-only); unread badge sync.
- **Empty state:** "No inquiries yet" + browse CTA; thread pane empty prompt on desktop.
- **Loading state:** Thread-list skeleton + message-bubble skeletons.
- **Error state:** Send-failure inline retry on the failed bubble; list retry card.

### Checkout
- **Route:** `/checkout?inquiry=[inquiryId]`
- **Auth gate:** protected
- **Layout:** BuyerShell (focused, minimal nav)
- **Use case(s):** Checkout & Place Order, Select Delivery Method, Pay via Instapay/COD/Wallet
- **Components:** Order summary (line items from inquiry/listing, qty, unit price, subtotal), `AddressSelect` (from address book or pickup/remote), `DeliveryMethodSelect` (delivery/pickup/remote + computed fee), **split-payment panel** (50% deposit method: Instapay / Vodafone Cash / Orange Cash; 50% balance = COD), totals (subtotal + delivery_fee = total), place-order button (irreversible confirm).
- **Data requirements:** Creates `orders` (betk_ref `BETK-YYYYMMDD-XXXX` R-O02; buyer_id, store_id, inquiry_id, delivery_address_id nullable, delivery_method, delivery_fee, subtotal, total_amount, status='pending') + `order_items` (snapshot `listing_title_ar`, `unit_price`, subtotal — R-O01 requires confirmed inquiry); creates **two** `payments` rows (deposit + balance, split model, C2 §3.8); reads `addresses`, `stores.delivery_options`/`payment_methods` (JSONB), `shipments` fee basis (Calculate Shipping Cost). Order created only from `confirmed` inquiry (R-O01).
- **User flows:** Happy — review → pick address + delivery + deposit method → place order → `/checkout/confirmation/[orderId]`. Edge — no saved address (inline add); COD-only store; service/remote order (no address); inquiry not in `confirmed` state → blocked with explanation; stock decrement happens on seller confirmation, not here (R-L05).
- **Empty state:** Invalid/expired inquiry → redirect to inbox with message.
- **Loading state:** Summary skeleton; place-order button spinner with disabled inputs.
- **Error state:** Inline payment/address validation; place-order failure toast (no partial order — atomic create).

### Order Confirmation & Payment Instructions
- **Route:** `/checkout/confirmation/[orderId]`
- **Auth gate:** protected
- **Layout:** BuyerShell
- **Use case(s):** Pay via Instapay/COD/Wallet (instruction display)
- **Components:** Success header with BETK ref (mono), **deposit payment instructions** (seller's Instapay handle / wallet number from store config), amount due now (50%), transfer-reference input (optional), "I've paid" affordance, balance-on-delivery note (COD 50%), track-order link.
- **Data requirements:** `orders` (by id, own — RLS `orders_access`); `payments` (deposit row: amount, method, status='pending', `transfer_reference`); `stores.payment_methods` (instapay_handle, vodafone_cash, orange_cash) for instructions; seller confirms receipt later (R-O05).
- **User flows:** Happy — read instructions → transfer externally → optionally enter reference → await seller confirmation. Edge — COD-only path auto-confirms (R-O04, no deposit step); wrong/missing store payment handle.
- **Empty state:** N/A.
- **Loading state:** Instruction-card skeleton.
- **Error state:** Retry card; instructions remain reachable from order detail.

### Order History
- **Route:** `/orders`
- **Auth gate:** protected
- **Layout:** BuyerShell
- **Use case(s):** View Order History
- **Components:** Filter tabs by status, order cards (BETK ref, store, thumbnail, total, `StatusBadge`, date), pagination.
- **Data requirements:** `orders` (buyer_id = self) + `order_items` (preview); status enum (pending…returned); index `(buyer_id, status)` (C2 §7.1).
- **User flows:** Happy — browse → tap → order detail. Edge — filter with no matches.
- **Empty state:** "No orders yet" + browse CTA.
- **Loading state:** Order-card list skeleton (5).
- **Error state:** Inline retry card.

### Order Detail / Track Order
- **Route:** `/orders/[id]`
- **Auth gate:** protected
- **Layout:** BuyerShell
- **Use case(s):** Track Order; Cancel Order; Leave Review (entry); Raise Dispute (entry); Request Return/Refund (entry)
- **Components:** Header (BETK ref, `StatusBadge`), `OrderTimeline` (status history with timestamps), line items, payment panel (deposit + balance status), shipment/tracking card (courier, tracking number/url, event timeline), order message thread (post-order), action bar (Cancel if pending · Leave review if delivered + within window · Raise dispute if delivered/dispatched · Request return if delivered).
- **Data requirements:** `orders` (own); `order_status_history` (ordered `created_at DESC` — Track Order, C2 §7.1); `order_items`; `payments` (both rows); `shipments` + `shipment_tracking_events`; `order_messages` (post-order thread); eligibility gates: cancel only while `pending` (R-O03), review only if `delivered` + buyer match within 48h (R-O01/R-R03), dispute only if delivered/dispatched (R-D01), return only after delivered (R-O08); one review per order (R-O07), one active dispute per order (R-O06).
- **User flows:** Happy — track status → on delivery, leave review. Edge — cancel pending order (writes status history, cancelled_by='buyer'); raise dispute; pickup/remote order with no shipment; balance COD due on delivery.
- **Empty state:** No shipment (pickup/remote) → hide tracking card; no messages → empty thread prompt.
- **Loading state:** Header + timeline skeleton; tracking card skeleton.
- **Error state:** 404 for non-own/missing; retry card otherwise.

### Leave Review
- **Route:** `/orders/[id]/review`
- **Auth gate:** protected
- **Layout:** BuyerShell (focused)
- **Use case(s):** Leave Review
- **Components:** Star rating (1–5), text body (≤500), photo upload (≤3), submit; edit mode within 48h.
- **Data requirements:** Inserts `reviews` (order_id UQ → one per order R-R02/R-O07; buyer_id, store_id denormalized, rating CHK 1–5, body, `edit_deadline = created_at + 48h`, is_visible default true) — RLS `reviews_buyer`/`reviews_edit`; `review_photos` (≤3, sort_order); triggers `rating_aggregates` recompute (R-R07). Goes live ~5 min (R-R05).
- **User flows:** Happy — rate → optional text/photos → submit. Edge — already reviewed → redirect to edit (if within 48h) or read-only; not delivered/not own order → blocked (R-R01); edit after deadline → blocked (R-R03).
- **Empty state:** N/A.
- **Loading state:** Submit spinner; photo upload progress.
- **Error state:** Field validation; upload-failure inline; submit toast.

### Raise Dispute
- **Route:** `/orders/[id]/dispute/new`
- **Auth gate:** protected
- **Layout:** BuyerShell (focused)
- **Use case(s):** Raise Dispute, Request Return, Request Refund
- **Components:** Reason select (not_received / not_as_described / damaged / wrong_item / return_request / refund_request), description, evidence upload (≤5 photos), submit; BETK-Guarantee explainer.
- **Data requirements:** Inserts `disputes` (order_id UQ — one active per order R-O06/R-D06; buyer_id, store_id, reason enum, status='submitted', `sla_deadline = created_at + 48h` R-D02) — RLS `disputes_access`; `dispute_evidence` (≤5 R-D05). Eligibility: delivered/dispatched only (R-D01).
- **User flows:** Happy — pick reason → describe → attach evidence → submit → `/disputes/[id]`. Edge — order ineligible (not dispatched/delivered) → blocked; existing active dispute → redirect to it.
- **Empty state:** N/A.
- **Loading state:** Submit spinner; upload progress per photo.
- **Error state:** Validation (reason required); upload/submit failure toast.

### Dispute Detail / Thread (Buyer)
- **Route:** `/disputes/[id]`
- **Auth gate:** protected
- **Layout:** BuyerShell
- **Use case(s):** Review Dispute (buyer side)
- **Components:** Status header + SLA indicator, evidence gallery, isolated dispute `MessageThread` (buyer/seller/admin), resolution banner when resolved (outcome + notes), linked order summary.
- **Data requirements:** `disputes` (own — RLS); `dispute_evidence`; `dispute_messages` (sender_type buyer|seller|admin, immutable); `orders` summary. Resolution enum (buyer_favour/seller_favour/partial/no_action) + `resolution_notes`; both parties notified (R-D04).
- **User flows:** Happy — follow status → message admin → receive resolution. Edge — resolved/closed → thread read-only.
- **Empty state:** No messages yet → "Our team will review within 48 hours" copy.
- **Loading state:** Header + thread skeleton.
- **Error state:** 404 non-own; retry card.

### Notifications Center
- **Route:** `/notifications`
- **Auth gate:** protected
- **Layout:** BuyerShell (also surfaced as topbar bell dropdown)
- **Use case(s):** Send Notifications (recipient view); unread badge
- **Components:** Notification list grouped by date, type icon, read/unread state, deep-link on tap, mark-all-read, channel-pref shortcut to account.
- **Data requirements:** `notifications` (user_id = self — RLS `notif_own`; type, channel, title, body, data JSONB deep-link payload, is_read, read_at); unread badge via partial index `(user_id) WHERE is_read=false` (C2 §7.1).
- **User flows:** Happy — open → tap notification → deep-link to order/dispute/listing; mark read. Edge — stale deep-link target (deleted entity) → graceful fallback.
- **Empty state:** "No notifications" illustration.
- **Loading state:** List skeleton (8 rows).
- **Error state:** Inline retry; bell badge falls back to last-known count.

---

### — SELLER —

### Seller Onboarding (5-step)
- **Route:** `/seller/onboarding`
- **Auth gate:** protected (becomes role: seller on submit)
- **Layout:** AuthShell → wizard (Stepper)
- **Use case(s):** Create Seller Storefront (WF1); Seller Registration Step 5 (ID upload)
- **Components:** 5-step `Stepper` — (1) Identity (store name_ar/en, bio), (2) Category (primary + optional secondary, governorate/city), (3) Payment config (instapay_handle, vodafone_cash, orange_cash, cod_enabled), (4) Delivery config (self_deliver/bosta/pickup/remote + est days per gov), (5) National ID upload (front + back). Slug picker with availability check. Submit-for-review.
- **Data requirements:** Creates `seller_profiles` (status='pending', level='bronze', `submitted_at`) and `stores` (seller_id UQ — one store per seller R-S01; slug UQ + URL-safe R-S02; name_ar NN; category_primary; payment_methods/delivery_options JSONB); `seller_documents` (two rows: national_id_front/back, storage_path via signed URL, review_status='pending' — R-S05); `categories` for pickers.
- **User flows:** Happy — complete 5 steps → submit → `/seller/status` (pending). Edge — slug taken (R-S02); missing required payment method blocks publish later (R-S09); resume incomplete wizard.
- **Empty state:** N/A (wizard).
- **Loading state:** Per-step save spinners; slug-availability inline check; upload progress.
- **Error state:** Per-field validation; slug-collision inline; upload-failure retry per document.

### Seller Application Status
- **Route:** `/seller/status`
- **Auth gate:** role: seller (status = pending/suspended/banned/rejected)
- **Layout:** SellerShell (restricted)
- **Use case(s):** WF1 approval/rejection; Seller Resubmission (MW2)
- **Components:** Status banner (pending / approved / rejected), SLA note (24h, R-M01), rejection reason display, **resubmit** flow (re-upload documents, edit store), approval CTA → dashboard.
- **Data requirements:** `seller_profiles` (status, `rejected_reason`, `approved_at`, `submitted_at`); `seller_documents` (retained on rejection for resubmit — R-S08, MW2); `stores.status` mirrors seller status.
- **User flows:** Happy — pending → approved → auto-route to `/seller`. Edge — rejected → read reason → resubmit (MW2, previous docs retained); suspended → restricted view.
- **Empty state:** N/A.
- **Loading state:** Status-card skeleton.
- **Error state:** Retry card; resubmit upload errors inline.

### Seller Dashboard
- **Route:** `/seller`
- **Auth gate:** role: seller (status = active)
- **Layout:** SellerShell (sidebar)
- **Use case(s):** Seller Daily Operations; Seller Dashboard KPIs
- **Components:** KPI cards (profile views, listing views, inquiries, orders, revenue — today/period), level progress widget, rating snapshot, recent inquiries, recent orders, low-stock alerts, payout balance, quick actions (new listing, boost).
- **Data requirements:** `seller_analytics_snapshots` (latest, store-scoped — RLS; profile_views, listing_views, inquiries_received, orders_confirmed, revenue_egp); `rating_aggregates`; `seller_profiles` (level, level_score, totals, avg_response_hours); `orders`/`inquiries` recent (store_id = my_store_id); low-stock from `listings` where `stock_qty <= low_stock_threshold`.
- **User flows:** Happy — review KPIs → jump to inbox/orders/listings. Edge — brand-new seller with zero snapshots/orders.
- **Empty state:** "No activity yet — add your first listing" guidance + CTA when no listings/orders.
- **Loading state:** KPI-card skeletons + list skeletons (progressive per widget).
- **Error state:** Per-widget inline retry; dashboard never hard-fails wholesale.

### Store Profile Settings
- **Route:** `/seller/store`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Manage Store Profile
- **Components:** Edit form (name_ar/en, bio_ar, avatar upload 200×200+, cover 1200×400, category primary/secondary, governorate/city, min_order_egp), **slug editor (change-once)** with lock indicator.
- **Data requirements:** `stores` (update own — RLS `stores_manage`); slug change allowed only once via `slug_changed_at` (R-S03); avatar_url/cover_url to CDN; `categories` for selects.
- **User flows:** Happy — edit → save (toast). Edge — second slug-change attempt blocked (R-S03); image dimension validation.
- **Empty state:** N/A.
- **Loading state:** Form skeleton; image upload progress.
- **Error state:** Field validation; slug-lock message; save toast.

### Delivery Settings
- **Route:** `/seller/store/delivery`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Manage Delivery Settings
- **Components:** Toggles (self_deliver, bosta, pickup, remote), per-governorate estimated delivery days, default delivery fee.
- **Data requirements:** `stores.delivery_options` (JSONB) update; used by checkout fee calc and `shipments`.
- **User flows:** Happy — configure options → save. Edge — disabling all delivery methods warning.
- **Empty state:** Sensible defaults pre-filled.
- **Loading state:** Form skeleton.
- **Error state:** Save toast; validation on est-days.

### Return Policy Settings
- **Route:** `/seller/store/returns`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Manage Return Policy
- **Components:** Rich-text/plain `return_policy` editor, public-preview note.
- **Data requirements:** `stores.return_policy` (TEXT) update; rendered on storefront.
- **User flows:** Happy — write policy → save → visible publicly. Edge — empty policy allowed (NULL).
- **Empty state:** Placeholder template suggestion.
- **Loading state:** Editor skeleton.
- **Error state:** Save toast.

### Payment Methods Settings
- **Route:** `/seller/store/payments`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Store payment configuration (R-S09)
- **Components:** Instapay handle, Vodafone Cash number, Orange Cash number, COD toggle; validation that ≥1 method is set before listings can publish.
- **Data requirements:** `stores.payment_methods` (JSONB: instapay_handle, vodafone_cash, orange_cash, cod_enabled); gate enforced before listing publish (R-S09). **Note:** sellers must not enter these as secrets in any third-party field — they are display handles surfaced to buyers at checkout.
- **User flows:** Happy — add at least one method → save → can now publish listings. Edge — try to publish a listing with no payment method → blocked with link here (R-S09).
- **Empty state:** Warning banner "Add a payment method to start selling".
- **Loading state:** Form skeleton.
- **Error state:** Validation; save toast.

### Listings Management
- **Route:** `/seller/listings`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Manage Listings
- **Components:** Listings table/grid (thumb, title, type, price, stock, status badge, views, inquiries), status filter tabs (draft/active/sold_out/paused/removed), bulk + per-row actions (edit, pause, boost, delete), new-listing CTA.
- **Data requirements:** `listings` (store_id = my_store_id — RLS `listings_seller`; status lifecycle R-L06/07/10; view_count, inquiry_count); `listing_images` (hero); soft-delete via `deleted_at` (R-L10).
- **User flows:** Happy — view catalog → edit/pause/boost. Edge — sold_out filter; removed (soft-deleted) shown in dedicated tab; pause/unpause.
- **Empty state:** "No listings yet — create your first" CTA.
- **Loading state:** Table skeleton (6 rows).
- **Error state:** Inline retry; row-action failure toast.

### Create / Edit Listing
- **Route:** `/seller/listings/new` · `/seller/listings/[id]/edit`
- **Auth gate:** role: seller
- **Layout:** SellerShell (form)
- **Use case(s):** Manage Listings; Upload Product Images
- **Components:** Type toggle (product/service), title_ar (required) + title_en, description_ar, category + subcategory, `PriceBlock` (price + price_type fixed/per_hour/starting_from/quote_only), stock fields (stock_qty, is_made_to_order, low_stock_threshold — hidden for services R-L09), custom-order toggle + notes, tags (≤5), per-listing delivery override, **image uploader (≤5 ordered, hero = sort_order 0)**, save-draft / publish.
- **Data requirements:** `listings` insert/update (store_id, category_id NN R-L01, type, title_ar NN R-L03, price/price_type, stock_qty nullable R-L09, status draft→active); `listing_images` (≥1 required to publish R-L02, ≤5, sort_order); `listing_tags` (≤5, unique per listing); `categories`. Publish validation: ≥1 image (R-L02) + Arabic title (R-L03) + category (R-L04) + store has payment method (R-S09). `search_vector` auto-generated.
- **User flows:** Happy — fill → upload images → publish (active). Edge — save as draft (skips publish validation); service hides stock; quote_only nulls price; reorder images (hero change); publish blocked until requirements met.
- **Empty state:** New form pre-filled with defaults.
- **Loading state:** Form skeleton on edit load; per-image upload progress.
- **Error state:** Inline publish-requirement checklist; upload retry per image; save toast.

### Stock & Inventory
- **Route:** `/seller/inventory`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Manage Stock & Inventory; Restock Alert
- **Components:** Stock table (listing, current stock, threshold, status), inline stock edit, low-stock highlight, restock action (sold_out → active R-L07), made-to-order indicator, "buyers waiting" count for restock alerts.
- **Data requirements:** `listings.stock_qty`, `low_stock_threshold`, `is_made_to_order`, status (sold_out auto at 0 — R-L06; restock reverts to active — R-L07); `restock_alerts` count per listing (waiting buyers; R-N06 fires on restock). **[DATA GAP]** — C1 §6.1 and C2 §1 approved an "Inventory Alert" *record* (low-stock alert log), but the final schema persists **no `inventory_alerts` table**; low-stock alerting is derivable only from `listings.stock_qty <= low_stock_threshold` at query time, with no stored alert/acknowledgement history.
- **User flows:** Happy — adjust stock → status auto-updates → restock fires buyer alerts. Edge — restock a sold_out item with waiting buyers (notifications dispatched); made-to-order rows show "unlimited".
- **Empty state:** "No stocked products" (e.g. services-only store).
- **Loading state:** Table skeleton.
- **Error state:** Inline edit retry; save toast.

### Boost Listing
- **Route:** `/seller/listings/[id]/boost`
- **Auth gate:** role: seller
- **Layout:** SellerShell (focused)
- **Use case(s):** Boost Listing (WF9)
- **Components:** Package selector (24h/EGP20, 48h/EGP50, 72h/EGP100 from `boost_packages`), payment method (instapay/vodafone_cash/orange_cash), payment-instruction panel, submit → pending_payment, status note ("activates within 5 min of admin confirmation").
- **Data requirements:** `boost_packages` (is_active, sort_order, duration_hours, price_egp); inserts `boosts` (listing_id, store_id, package_id, payment_method, amount_paid snapshot, status='pending_payment'); concurrent-boost guard via partial unique index `(listing_id) WHERE status='active'` (R-B01/R-L08). Activation by admin (MW3, R-B02).
- **User flows:** Happy — pick package → pay externally → await admin confirm → boost active (R-B02). Edge — listing already has an active boost → blocked (R-B01); non-active listing cannot be boosted.
- **Empty state:** N/A.
- **Loading state:** Package-card skeleton; submit spinner.
- **Error state:** Validation; submit toast; concurrent-boost inline message.

### Boost Management / History
- **Route:** `/seller/boosts`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Boost ROI analytics (R-B05)
- **Components:** Active/expired boost list, ROI card (views_during_boost vs baseline), status (pending_payment/active/expired/cancelled), expiry countdown.
- **Data requirements:** `boosts` (store_id; status, starts_at, expires_at, views_during_boost — R-B05); `boost_packages` for labels; `listings` for titles.
- **User flows:** Happy — review ROI → re-boost. Edge — pending_payment awaiting admin; auto-expired (pg_cron, R-B03).
- **Empty state:** "No boosts yet" + boost CTA.
- **Loading state:** List skeleton.
- **Error state:** Inline retry.

### Seller Inbox (Inquiries)
- **Route:** `/seller/inbox` · thread `/seller/inbox/[inquiryId]`
- **Auth gate:** role: seller
- **Layout:** SellerShell (list + thread)
- **Use case(s):** Respond to Inquiry; Seller Inbox; Confirm order from inquiry
- **Components:** Inquiry list (buyer, listing, last message, status, unread, response-time chip), `MessageThread`, composer, **confirm-order** action (sets inquiry→confirmed, enables buyer checkout), decline action, WhatsApp deep-link, listing/qty/special-requests context.
- **Data requirements:** `inquiries` (store_id = my_store_id — RLS; status open→replied→confirmed/declined; `converted_to_order_id`); `inquiry_messages` (sender_type buyer|seller, is_read); ordered by `last_message_at DESC`; reply updates `seller_profiles.avg_response_hours` (Inquiry Response Time merged metric); new-inquiry notify within 5s (R-N04).
- **User flows:** Happy — receive inquiry → reply → confirm → buyer checks out → inquiry converts to order. Edge — decline; expired; quote_only negotiation.
- **Empty state:** "No inquiries yet."
- **Loading state:** List + bubble skeletons.
- **Error state:** Send-retry inline; list retry.

### Orders Management (Seller)
- **Route:** `/seller/orders`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Manage Orders, Confirm Orders, Update Order Status
- **Components:** Orders table (BETK ref, buyer, total, payment status, `StatusBadge`, date), status filter tabs, per-row quick actions (confirm payment, advance status), new-order indicator.
- **Data requirements:** `orders` (store_id = my_store_id; status lifecycle); `order_items`; `payments` (deposit confirmation gate — R-O05); `order_status_history` written on each change; index `(store_id, created_at DESC)` (C2 §7.1).
- **User flows:** Happy — confirm deposit payment → status pending→confirmed (R-O05) → preparing→dispatched→delivered. Edge — COD auto-confirmed (R-O04); cancel; return flow.
- **Empty state:** "No orders yet."
- **Loading state:** Table skeleton (6).
- **Error state:** Inline retry; action-failure toast.

### Order Detail (Seller)
- **Route:** `/seller/orders/[id]`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Confirm Orders, Update Order Status, Process Returns, Create Shipment, Update Shipment Status, Generate Tracking Number
- **Components:** Order header + `StatusBadge`, buyer/delivery info, line items, **payment confirmation panel** (deposit + balance), **status stepper** with advance controls, **shipment panel** (courier, generate/enter tracking number + url, mark dispatched/delivered), order message thread, return processing.
- **Data requirements:** `orders` (own store); `payments` (confirm deposit → `confirmed_by`/`confirmed_at`, R-O05); `order_status_history` (changed_by, changed_by_type, notes); `shipments` (1:1, courier, tracking_number/url, status) + `shipment_tracking_events`; `order_messages`; status changes notify buyer+seller (R-N03/R-O / Update Order Status).
- **User flows:** Happy — confirm deposit → preparing → create shipment + tracking → dispatched → delivered (opens 48h review window via `delivered_at`). Edge — pickup/remote (no shipment); return request handling; cancel with reason.
- **Empty state:** No shipment for pickup orders → hide panel.
- **Loading state:** Header + panel skeletons.
- **Error state:** 404 non-own; action toasts; tracking save inline.

### Reviews Management (Seller)
- **Route:** `/seller/reviews`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Reply to Review
- **Components:** Review list (rating, body, buyer, photos, date, admin-verified badge), **reply box (one reply, immutable after submit)**, rating distribution summary.
- **Data requirements:** `reviews` (store_id = my_store_id, is_visible); `review_photos`; `rating_aggregates` summary; seller_reply written once via update (R-R04) — RLS `reviews_edit` (store branch); `seller_replied_at`.
- **User flows:** Happy — read review → reply once. Edge — already replied (read-only); hidden review (admin-removed) not shown to seller as actionable.
- **Empty state:** "No reviews yet."
- **Loading state:** Review-list skeleton.
- **Error state:** Reply-submit toast; one-reply guard inline.

### Earnings
- **Route:** `/seller/earnings`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** View Earnings
- **Components:** Balance card, revenue chart (period), confirmed-orders revenue, request-payout CTA, payout history link.
- **Data requirements:** `seller_analytics_snapshots` (revenue_egp series, store-scoped); `payouts` (history/status); `payments` (confirmed deposits/balances basis). Note split-payment model: BETK does not hold funds (C2 §3.8) — "earnings" reflect confirmed buyer→seller transfers.
- **User flows:** Happy — view earnings → request payout. Edge — balance below EGP 100 minimum (R-O09) → payout disabled with explanation.
- **Empty state:** "No earnings yet."
- **Loading state:** Card + chart skeleton.
- **Error state:** Per-widget retry.

### Transactions
- **Route:** `/seller/transactions`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** View Transactions
- **Components:** Transaction ledger (order ref, payment_type deposit/balance, method, amount, status, date), filters by type/status.
- **Data requirements:** `payments` (via store orders — RLS `payments_access`); `orders` for ref/context.
- **User flows:** Happy — review transactions → drill to order. Edge — refunded/failed payment rows.
- **Empty state:** "No transactions yet."
- **Loading state:** Ledger skeleton.
- **Error state:** Inline retry.

### Request Payout
- **Route:** `/seller/payouts` (list) · `/seller/payouts/new`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Request Payout (WF10)
- **Components:** Payout request form (amount ≥ EGP 100, method instapay/vodafone_cash/orange_cash, account_details), payout history list (status pending/processing/processed/rejected, rejection_reason).
- **Data requirements:** `payouts` insert (store_id, amount CHK ≥ 100 — R-O09, method, account_details, status='pending'); admin processes manually (R-O10).
- **User flows:** Happy — request payout → admin processes → notified. Edge — below minimum blocked (R-O09); rejected with reason shown.
- **Empty state:** "No payout requests yet."
- **Loading state:** Form + history skeleton.
- **Error state:** Min-amount validation; submit toast.

### Level Progress
- **Route:** `/seller/level`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Level Progress; Seller Dashboard (level widget)
- **Components:** Current level badge (Bronze/Silver/Gold), progress to next tier, criteria checklist (orders, rating, response rate), score breakdown.
- **Data requirements:** `seller_profiles` (level, level_score 0–100, total_orders_completed, total_reviews_count, avg_response_hours); thresholds R-S06 (Silver: 10+ orders & 4.0+; Gold: 50+ & 4.5+); `rating_aggregates` (average_rating). Recalculated nightly (pg_cron, C2 §7.3).
- **User flows:** Happy — view progress → understand next-tier criteria. Edge — recently recalculated; demotion edge.
- **Empty state:** New seller at Bronze with 0 score.
- **Loading state:** Badge + checklist skeleton.
- **Error state:** Inline retry.

### Seller Analytics
- **Route:** `/seller/analytics`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** View Analytics Dashboard (Seller)
- **Components:** Time-series charts (views, inquiries, conversion, revenue), funnel (views→inquiries→orders), rating trend, boost ROI summary.
- **Data requirements:** `seller_analytics_snapshots` (daily series, store-scoped, index `(store_id, snapshot_date DESC)`); `rating_aggregates`; `boosts.views_during_boost`. Conversion derived (orders_confirmed / listing_views).
- **User flows:** Happy — pick range → read KPIs. Edge — sparse history for new sellers.
- **Empty state:** "Analytics will appear after your first day of activity."
- **Loading state:** Chart skeletons (progressive).
- **Error state:** Per-chart retry.

### Dispute Detail (Seller)
- **Route:** `/seller/disputes/[id]`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Resolve Disputes (seller participation)
- **Components:** Dispute status + SLA, buyer evidence gallery, dispute `MessageThread` (respond to admin/buyer), linked order, resolution banner.
- **Data requirements:** `disputes` (store_id = my_store_id — RLS `disputes_access`); `dispute_evidence`; `dispute_messages` (sender_type seller); `orders`. Resolution + notes set by admin (R-D03/R-D04).
- **User flows:** Happy — respond with explanation/evidence → admin resolves. Edge — awaiting_seller status prompts response; resolved → read-only.
- **Empty state:** N/A.
- **Loading state:** Header + thread skeleton.
- **Error state:** 404 non-own; send-retry inline.

---

### — ADMIN —

### Admin Dashboard
- **Route:** `/admin`
- **Auth gate:** role: admin
- **Layout:** AdminShell (sidebar)
- **Use case(s):** View Analytics Dashboard (Admin); Platform Analytics
- **Components:** Platform KPI cards (GMV, new users/sellers, orders created/delivered, disputes open/resolved, boost revenue), trend charts, **SLA alert panel** (sellers awaiting approval >23h, disputes >47h, flagged content >24h), activity feed.
- **Data requirements:** `platform_analytics_snapshots` (daily: gmv_egp, total/new buyers & sellers, orders_created/delivered, disputes_opened/resolved, boost_revenue_egp); `seller_analytics_snapshots` (aggregate); live counts from `seller_profiles` (pending), `disputes` (status, sla_deadline), `flagged_content` (pending). Admin bypasses RLS (`is_admin()`).
- **User flows:** Happy — scan KPIs + SLA panel → jump to the at-risk queue. Edge — no snapshot for today yet (pre-midnight job).
- **Empty state:** Pre-launch "awaiting first snapshot" placeholder.
- **Loading state:** KPI + chart skeletons (progressive).
- **Error state:** Per-widget retry; SLA panel falls back to live query.

### Seller Approval Queue
- **Route:** `/admin/sellers/approvals`
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Verify Seller Profile, Verify Store (WF1, R-M01)
- **Components:** Pending-application list (store, submitted_at, SLA countdown 24h), detail drawer (store info, **ID document viewer via signed URL**, payment/delivery config), approve / reject (with reason) actions.
- **Data requirements:** `seller_profiles` (status='pending', submitted_at, approved_at, rejected_reason); `seller_documents` (signed-URL fetch, never public — review_status); `stores`; writes `moderation_logs` (action approve/reject_seller, target_type='seller') (R-M02); approval flips seller+store to active (R-S04); SMS on outcome (WF1).
- **User flows:** Happy — open application → view ID docs → approve → store goes live. Edge — reject with reason (resubmittable, R-S08/MW2); SLA breach highlight (R-M01).
- **Empty state:** "No applications awaiting review."
- **Loading state:** Queue skeleton; document-viewer spinner.
- **Error state:** Signed-URL failure inline; action toast.

### User & Seller Management
- **Route:** `/admin/users`
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Manage Users & Sellers, Suspend Seller, Suspend Buyer
- **Components:** User table (phone, role, status, joined), search/filter, detail drawer, **suspend/ban actions** (with strike, type warning/temp_suspension/permanent_ban), reinstate, strike history. Permanent ban requires confirm dialog (R-M04).
- **Data requirements:** `users` (status: active/suspended/banned); `seller_profiles` (status, suspension_ends_at, strike_count); `seller_strikes` (issued_by, strike_type, reason, is_active — R-M03 temp auto-lift); writes `moderation_logs` + `notifications` (R-M02). Suspended store/listings hidden not deleted (R-S07).
- **User flows:** Happy — find user → issue strike/suspend → notified. Edge — temp suspension auto-lifts after period (R-M03, pg_cron); permanent ban → confirm dialog (R-M04).
- **Empty state:** Filtered no-results state.
- **Loading state:** Table skeleton.
- **Error state:** Action toast; confirm-dialog guard for destructive ban.

### Listings Moderation (Admin)
- **Route:** `/admin/listings`
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Manage Listings (Admin)
- **Components:** Listing table (all stores), filters (status, category, flagged), detail view, remove/restore actions, auto-flag indicator.
- **Data requirements:** `listings` (admin sees all via RLS bypass; status, deleted_at); `flagged_content` (content_type='listing'); writes `moderation_logs` (remove_listing). Auto-flag keywords (R-M06) route to flagged queue.
- **User flows:** Happy — review listing → remove if violating (soft-delete R-L10). Edge — restore; auto-flagged listing review.
- **Empty state:** Filtered no-results.
- **Loading state:** Table skeleton.
- **Error state:** Action toast.

### Flagged Content Queue
- **Route:** `/admin/moderation/flags`
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Content Moderation (R-M05/R-M06)
- **Components:** Flag queue (content_type listing|review, reason, severity, reporter_type, SLA 24h countdown), polymorphic content preview, actions (action/dismiss), severity sort.
- **Data requirements:** `flagged_content` (content_type, content_id polymorphic, reported_by/reporter_type, reason enum, severity, status pending→reviewed/actioned/dismissed, reviewed_by); resolves `listings` or `reviews` by content_id; writes `moderation_logs`. Review within 24h (R-M05).
- **User flows:** Happy — open flag → inspect content → action or dismiss. Edge — system auto-flag (reported_by NULL, R-M06); high-severity prioritization.
- **Empty state:** "Moderation queue is clear."
- **Loading state:** Queue skeleton.
- **Error state:** Action toast; content-preview retry.

### Reviews Moderation
- **Route:** `/admin/reviews`
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Verify Reviews, Remove Review
- **Components:** Review list with filters (flagged, unverified), **verify badge toggle**, **hide/remove** (is_visible), review detail with photos.
- **Data requirements:** `reviews` (admin all; admin_verified toggle, is_visible toggle → hide without delete R-R06); `review_photos`; `flagged_content` (reviews); writes `moderation_logs`; rating recompute on removal (R-R07).
- **User flows:** Happy — verify legitimate review / hide policy-violating one. Edge — hidden review excluded from `rating_aggregates`.
- **Empty state:** "No reviews to moderate."
- **Loading state:** List skeleton.
- **Error state:** Action toast.

### Categories Management
- **Route:** `/admin/categories`
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Manage Categories
- **Components:** Category tree (drag-order), add/edit (name_ar/en, slug, icon_url, parent, sort_order), active toggle.
- **Data requirements:** `categories` (CRUD — RLS `cat_admin`; self-referential parent_id; slug UQ; is_active; sort_order). Used across search/homepage/listing forms.
- **User flows:** Happy — add subcategory → reorder → activate. Edge — deactivate category with active listings (hidden, not deleted); slug collision.
- **Empty state:** Seed-categories prompt on empty taxonomy.
- **Loading state:** Tree skeleton.
- **Error state:** Slug-collision inline; save toast.

### Orders Management (Admin)
- **Route:** `/admin/orders`
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Manage Orders (Admin)
- **Components:** Global orders table (all stores), filters (status, store, date), detail view (items, payments, history, shipment), admin override actions.
- **Data requirements:** `orders` (admin all); `order_items`; `payments`; `order_status_history`; `shipments`; writes `moderation_logs` for any intervention.
- **User flows:** Happy — investigate an order → view full trail. Edge — admin-forced cancellation (cancelled_by='admin').
- **Empty state:** Filtered no-results.
- **Loading state:** Table skeleton.
- **Error state:** Inline retry; action toast.

### Disputes Management (Admin)
- **Route:** `/admin/disputes` (queue) · `/admin/disputes/[id]` (detail)
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Manage Disputes, Review Dispute, Resolve Disputes, Manage Inbox (Admin)
- **Components:** Dispute queue (reason, status, SLA 48h countdown, assignee), detail: order summary, buyer evidence gallery, **3-party message thread**, **assign-to-me**, **resolution form** (outcome buyer_favour/seller_favour/partial/no_action + notes), close.
- **Data requirements:** `disputes` (admin all; status submitted→under_review→awaiting_seller→resolved/closed; assigned_to; sla_deadline created_at+48h R-D02; resolution + resolution_notes R-D03); `dispute_evidence`; `dispute_messages` (sender_type admin); `orders`/`payments` (for refund-type, Process Refund); writes `moderation_logs` (resolve_dispute); resolution notifies both parties via push+SMS (R-D04). SLA breach (47h) admin SMS alert (R-D05/R-N05).
- **User flows:** Happy — assign → review evidence → message parties → resolve with outcome. Edge — refund_request resolution touches `payments.status='refunded'` (Process Refund); SLA-breach escalation.
- **Empty state:** "No open disputes."
- **Loading state:** Queue + detail skeletons.
- **Error state:** Resolution-submit toast; thread send-retry.

### Payments Management (Admin)
- **Route:** `/admin/payments`
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Manage Payments, Process Refund, Process Payment
- **Components:** Payment ledger (all orders, deposit/balance, method, status), filters, refund action, order link.
- **Data requirements:** `payments` (admin all; status pending/confirmed/failed/refunded; payment_type deposit/balance); `orders`; `disputes` (refund context); writes `moderation_logs`.
- **User flows:** Happy — locate payment → process refund (status→refunded). Edge — failed/duplicate deposit reconciliation (composite uniqueness order_id+payment_type, C2 §7.3).
- **Empty state:** Filtered no-results.
- **Loading state:** Ledger skeleton.
- **Error state:** Refund-action toast.

### Payouts Management (Admin)
- **Route:** `/admin/payouts`
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Manage Payouts (WF10, R-O10)
- **Components:** Payout request queue (store, amount, method, account_details, status), process / reject (reason) actions.
- **Data requirements:** `payouts` (admin all; status pending→processing→processed/rejected; processed_by, processed_at, rejection_reason); writes `moderation_logs`; notifies seller. Manual processing only (R-O10). Admin must not enter the seller's payout credentials anywhere — they transfer externally and record the outcome.
- **User flows:** Happy — review request → mark processing → processed → seller notified. Edge — reject below-minimum or invalid details (R-O09).
- **Empty state:** "No payout requests."
- **Loading state:** Queue skeleton.
- **Error state:** Action toast.

### Editorial Collections
- **Route:** `/admin/collections` (list) · `/admin/collections/[id]` (editor)
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Manage Editorial Collections
- **Components:** Collection list (status, homepage_position), editor (name_ar/en, description, homepage_position, status draft/live/scheduled/archived, publish_at/archive_at scheduling), **listing picker with drag-order**.
- **Data requirements:** `collections` (CRUD — RLS `collections_admin`; created_by, homepage_position, status, publish_at/archive_at scheduling); `collection_listings` (junction, sort_order, unique collection+listing); `listings` for the picker. Live collections power Homepage.
- **User flows:** Happy — create collection → add/reorder listings → schedule publish. Edge — scheduled (publish_at future); archive_at seasonal auto-archive.
- **Empty state:** "No collections — create one for the homepage."
- **Loading state:** List + editor skeletons.
- **Error state:** Save toast; picker retry.

### Notifications Broadcast
- **Route:** `/admin/notifications`
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Send Notifications (MW4 bulk broadcast)
- **Components:** Audience selector (all buyers / all sellers / by category), channel selector (push/sms/whatsapp/email), message composer, **WhatsApp template selector** (for whatsapp channel), preview, send + delivery summary.
- **Data requirements:** Writes `notifications` (fan-out per recipient: user_id, type, channel, title, body, data); `whatsapp_templates` (event_type, language, body_template — referenced for the whatsapp channel; channel prefs honored R-N01/R-N02). Audience resolved from `users`/`buyer_profiles`/`seller_profiles`. **Note:** MW4 broadcast (audience selection, templating, delivery tracking) is documented as a *missing workflow* (C1 §6.3) — UI is specified here; delivery-tracking persistence beyond per-row `notifications` is not modeled.
- **User flows:** Happy — pick audience + channel → compose (template for WhatsApp) → send. Edge — WhatsApp requires approved template (R-N02); large audience confirmation dialog.
- **Empty state:** N/A (compose form).
- **Loading state:** Send progress / delivery counter.
- **Error state:** Per-channel failure summary; confirm dialog before mass send.

### WhatsApp Templates (merged — Admin → Settings → Notifications)
- **Route:** `/admin/settings` → **Notifications tab** (no standalone route; OD-5 FROZEN)
- **Auth gate:** role: admin
- **Layout:** AdminShell (sub-tab of Admin Settings)
- **Use case(s):** Send Order/Payment Confirmation (WhatsApp) — template management
- **Components:** Within the Settings "Notifications" tab: template list (name, event_type, language, active), editor ({{variable}} placeholders), activate/deactivate. (No separate nav item.)
- **Data requirements:** `whatsapp_templates` (name UQ, event_type, language ar/en, body_template, is_active). Per C3 §8.2 RISK 1, **log all template changes** to `moderation_logs`.
- **User flows:** Happy — open Settings → Notifications tab → edit template → activate. Edge — deactivate without delete.
- **Empty state:** "No templates configured."
- **Loading state:** List skeleton.
- **Error state:** Save toast; name-uniqueness inline.

### Admin Settings
- **Route:** `/admin/settings`
- **Auth gate:** role: admin (superadmin for sensitive keys)
- **Layout:** AdminShell
- **Use case(s):** Admin Settings; Moderation Rules (R-M06)
- **Components:** Tabs — **General** (key-value config: seller_approval_sla_hours, dispute_sla_hours, low_stock_default, **auto-flag keywords**, fee rates; descriptions per key; boost-package management link) and **Notifications** (WhatsApp template management — see merged section above, OD-5).
- **Data requirements:** `admin_settings` (key PK, value, description, updated_by — RLS `settings_admin`; add CHECK on numeric keys per C3 §8.2 RISK 2); `whatsapp_templates` (Notifications tab); auto-flag keywords drive R-M06; SLA thresholds drive R-M01/R-D02. Boost packages via `boost_packages`.
- **User flows:** Happy — adjust SLA/keyword config → save (no deploy). Edge — superadmin-only sensitive keys; invalid value type.
- **Empty state:** Seeded defaults.
- **Loading state:** Settings-list skeleton.
- **Error state:** Per-key validation; save toast.

### Moderation Log
- **Route:** `/admin/moderation/log`
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Moderation Log tab (R-M02)
- **Components:** Immutable audit table (admin, action, target_type, target_id, reason, timestamp), filters (admin, target_type, date), read-only.
- **Data requirements:** `moderation_logs` (read-only — RLS `modlog_admin`; immutable, no UPDATE/DELETE; index target_id/admin_id/created_at). Append-only audit trail (R-M02).
- **User flows:** Happy — audit who-did-what. Edge — filter by target entity to reconstruct a case.
- **Empty state:** "No moderation actions logged yet."
- **Loading state:** Table skeleton.
- **Error state:** Inline retry (read-only, no mutations).

### Boost Approval (Admin)
- **Route:** `/admin/boosts`
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Boost Payment Verification (MW3, R-B02); Admin Boost Config
- **Components:** Pending-payment boost queue (store, listing, package, amount, method), **confirm-payment** action (activates boost), boost-package config (24/48/72h, prices, active toggle).
- **Data requirements:** `boosts` (status='pending_payment' → confirm sets payment_confirmed_by/at, starts_at, expires_at=starts_at+duration, status='active' R-B02); `boost_packages` (CRUD); writes `moderation_logs`. Expiry via pg_cron (R-B03).
- **User flows:** Happy — verify seller's external payment → confirm → boost active within 5 min (R-B02). Edge — non-payment/timeout → cancel; concurrent-boost guard (R-B01).
- **Empty state:** "No boosts awaiting confirmation."
- **Loading state:** Queue skeleton.
- **Error state:** Confirm-action toast.

---

## 4. Shared Components

Components appearing across multiple pages, with the tables/enums they consume.

- **`AppTopbar` / `MobileBottomNav`** — public + buyer surfaces. Reads session, `notifications` unread count (partial index), search entry.
- **`SellerSidebar` / `AdminSidebar`** — console navigation; SLA counters on admin (`seller_profiles` pending, `disputes`/`flagged_content` SLA).
- **`ListingCard`** — Homepage, Search, Category, Storefront, Wishlist, Collections. Consumes `listings` + `listing_images` (hero) + `rating_aggregates` + boost badge (`boosts.status='active'`).
- **`StoreCard`** — Homepage, Following, Search. Consumes `stores` + `seller_profiles.level` + `rating_aggregates`.
- **`PriceBlock`** — Listing Detail, Create/Edit Listing, Checkout. Renders `listings.price` by `price_type` (fixed/per_hour/starting_from/quote_only).
- **`StatusBadge`** — centralized enum→color/label map for `order_status`, `seller_status`, `dispute_status`, `payment_status`, `boost_status`, `listing_status`, `flag_status`, `payout_status` (C3 §2). Single source of truth for status color tokens.
- **`StarRating`** — Listing Detail, Storefront, Leave Review, Reviews Management. `reviews.rating` (1–5).
- **`RatingSummary`** — Storefront, Listing Detail, Seller Dashboard. `rating_aggregates` (average + distribution rating_5…rating_1).
- **`LevelBadge`** — Storefront, Store header, Dashboard, Level Progress. `seller_profiles.level`.
- **`VerifiedBadge`** — Storefront, Listing Detail. `seller_profiles.is_verified`.
- **`MessageThread`** — Buyer Inbox, Seller Inbox (`inquiry_messages`), Order Detail (`order_messages`), Dispute Detail (`dispute_messages`). Parameterized by `sender_type` and source table.
- **`ImageUploader`** — Create/Edit Listing (`listing_images` ≤5), Onboarding (`seller_documents`), Leave Review (`review_photos` ≤3), Raise Dispute (`dispute_evidence` ≤5), Store Settings (avatar/cover). Handles WebP conversion + ordering + signed-URL preview.
- **`OrderTimeline`** — Order Detail (buyer + seller). `order_status_history` ordered.
- **`AddressForm` / `AddressSelect`** — Address Book, Checkout. `addresses`.
- **`FilterSheet`** — Search, Category. `categories` tree + governorate/city + price + type.
- **`SLABadge`** — Approval queue, Disputes, Flagged content, Admin dashboard. Countdown from `submitted_at`/`sla_deadline`.
- **`EmptyState`** / **`SkeletonGrid`** / **`SkeletonTable`** / **`ErrorRetryCard`** — universal state primitives (see §6).
- **`ConfirmDialog`** — every irreversible/destructive action (cancel order, delete listing, permanent ban R-M04, account delete, mass broadcast).
- **`Toaster`** — global toast host (shadcn).

---

## 5. Auth Flow

Step-by-step states, mapped to `users`, `otp_tokens`, `sessions`, and C3 §5 RLS.

1. **Unauthenticated (guest).** No `sessions` row; `auth.uid()` null. Public RLS grants read on active stores/listings/categories, visible reviews, live collections. UI: public shell, write controls render but route to login on tap.
2. **Login start (`/auth/login`).** Two paths (OD-4): **(a) Phone** — enter E.164, system checks `users.phone_number` (R-A03) → new vs returning → creates `otp_tokens` (`token_hash`, `expires_at=NOW()+60s`, one active/phone R-A02). **(b) Google OAuth** — Supabase OAuth; on return, find-or-create `users` with `auth_provider='google'` and `phone_number=NULL`. No passwords either way (R-A01 amended).
3. **OTP challenge (`/auth/verify`).** Validate code vs `otp_tokens` (hash, not expired, not used, `attempt_count ≤ 5`). On failure: resend (after expiry) or lockout. Suspended/banned blocked here (R-A05).
4. **Session established.** On success: create `sessions` (token_hash, device_info, expires_at 30d mobile / 24h web), set `users.last_login_at`, mark token used. `auth.uid()` now resolves; RLS self-scoping active.
5. **Profile gate.** If buyer has no `buyer_profiles` row → `/auth/register` (complete profile). Otherwise proceed.
6. **Role routing.** Resolve `users.role`:
   - `buyer` → `/` (buyer shell).
   - `seller` → check `seller_profiles.status`: `active` → `/seller`; `pending`/`rejected` → `/seller/status`; `suspended`/`banned` → restricted status view.
   - `admin` / `superadmin` → `/admin` (`is_admin()` true).
7. **Authenticated steady state.** Every authenticated request updates `sessions.last_active_at` and re-checks `users.status` and `deleted_at` (R-A05). Role/store scoping enforced by RLS. **Transaction gate (OD-4):** before checkout, becoming a seller, or requesting a payout, the app requires `users.phone_number IS NOT NULL` (verified); a Google-only user is sent through a phone+OTP step at that moment, then continues.
8. **Re-verification / phone change.** Phone is read-only post-registration (R-A06); change requires a fresh OTP cycle.
9. **Logout / expiry.** Session invalidated; revert to guest. Multi-device sessions are independent (`users` 1:N `sessions`).

---

## 6. UI State Standards

### Loading patterns — skeleton vs spinner
- **Skeletons** for any view rendering data from a table fetch (lists, grids, tables, dashboards, detail pages). Match the final layout (card grid → card skeletons; table → row skeletons). Render progressively: each dashboard widget / homepage strip resolves independently rather than blocking the whole page.
- **Spinners** only for in-place actions with no layout to preview: button submission ("Sending code…", "Placing order…"), inline save, image-upload progress, OTP verification.
- **Rule of thumb:** *navigation/data load → skeleton; user-triggered mutation → spinner on the triggering control.* Never show a full-page spinner where a skeleton can preview structure.

### Empty state copy and CTA standards
- Every empty state = one-line plain-Arabic explanation + a single primary CTA toward the unblocking action (e.g. Wishlist empty → "ابدأ بحفظ ما يعجبك" + Browse; no listings → Add listing; no orders → Browse).
- Distinguish **no-data-yet** (encouraging, with CTA) from **filtered-no-results** (offer "clear filters"). Never a bare "No data".
- Admin queues use a *positive* empty state ("Queue is clear") — absence of work is good news.

### Error message patterns
- **Field-level:** inline, beneath the input, specific and actionable (format, required, uniqueness/slug collision).
- **Section-level:** `ErrorRetryCard` scoped to the failed region (a homepage strip, a dashboard widget) so the rest of the page survives.
- **Page-level:** full-page retry card only when the primary resource fails entirely; `404` for missing/non-owned/soft-deleted entities (RLS denial is surfaced as not-found, not "forbidden", to avoid leaking existence).
- **Action failure:** toast with a retry affordance; never lose user input on failure (preserve form/query state). No partial writes (checkout order creation is atomic; split-payment rows created together).
- Copy is non-technical; never expose SQL/RLS/internal reasons.

### Toast vs modal decision rule
- **Toast** — non-blocking confirmation or recoverable failure of a completed/attempted action that does **not** require a decision: saved, sent, status advanced, copied, "couldn't save — retry". Auto-dismiss; one retry action max.
- **Modal (`ConfirmDialog`)** — *before* any irreversible or high-consequence action, to gather an explicit decision: cancel order, delete/remove listing, **permanent ban (mandatory, R-M04)**, account deletion, payout reject, dispute resolution, mass notification broadcast. Blocks until confirmed/cancelled.
- **Rule:** *consequence already happened, no decision needed → toast. Consequence is destructive/irreversible and needs consent → modal.* Inline validation (not modal/toast) handles form correctness.

---

## 4. Localization & theming (OD-7)

BETK is a **bilingual Arabic/English** app with **light/dark** theming over the existing 56 pages — **no new pages/tables/content columns, no translation service** (ADR-002; scope OD-7). This section is the ground truth for how any page localizes.

- **Locales & URLs.** `ar` (default) + `en`. Routing is `localePrefix: 'as-needed'`: **Arabic is unprefixed** (existing URLs/SEO unchanged — `/`, `/listing/[id]`, `/seller`, …); **English is mirrored under `/en`** (`/en`, `/en/listing/[id]`, …). A locale outside `{ar, en}` is a **404**. Locale persists via the URL + `NEXT_LOCALE` cookie.
- **Direction & fonts.** `<html dir lang>` derives from the locale: **ar → `dir="rtl"` `lang="ar"`**, **en → `dir="ltr"` `lang="en"`**. Keep using logical Tailwind utilities (`ps-*/pe-*/ms-*/me-*/start-*/end-*`) so the same components mirror correctly under LTR; no raw `left/right` in shared components. LTR islands (Latin handles, BETK refs, tracking numbers) still use `dir="ltr"` wrappers.
- **Theme.** Light/dark via `next-themes`, class strategy on `<html>` (`.dark`), matching the Phase 01 T03 tokens; `defaultTheme="system"`. Theme persists in `localStorage`. No DB column.
- **What is translated vs shown as-authored:**
  - **Shell chrome** (nav, buttons, labels, empty/error/validation copy) → `next-intl` catalogs `messages/{ar,en}.json` (BETK owns EN copy).
  - **Structured lists** (categories, badges, statuses, filters, governorates, delivery) → existing `*_ar`/`*_en` columns.
  - **Names/titles** (listing titles, store/collection/category names) → **`localizedName()` = `COALESCE(locale column, other)`**, never blank (`title_en` is nullable — no migration; the seller-entered bilingual title is a Phase-04 listing-form decision).
  - **Descriptions / store bios / custom-order notes** → a **single field in the author's language, shown as-authored to everyone**. No translation, no fallback (an English user may see an Arabic description — accepted).
  - **Transactional/structured fields** (price, stock, condition, dates) → language-neutral/enum.
- **Switch location.** The language switch (AR ↔ EN) and theme switch (light/dark/system) live in **Account → Settings** (built in BL-03). Switching language keeps the user on the same page in the other locale.
- **Deferred papercut.** `order_items` snapshots only `listing_title_ar`, so English buyers' order history shows the Arabic title (fixing = a future `_en` column, out of OD-7 scope).

---

## Acceptance matrix — AR-RTL / EN-LTR × light / dark (OD-7)

Every screen in the frozen page inventory must pass in **four cells**: `{ar-RTL, en-LTR} × {light, dark}`. Check a cell off (`☑`) only when that screen has shipped and been UI-reviewed in that context (from Phase 03 **T02** onward). **Screen inventory is FROZEN — no screen added or removed here.** Rows are the documented pages of §3, grouped by surface. Legend: `☐` not yet shipped/verified · `☑` shipped + UI-reviewed.

> **Count reconciliation (docs-hygiene FLAG, not a scope change):** §3 documents **60 page headings** (**59 standalone pages** — *WhatsApp Templates* is a merged Admin→Settings tab per OD-5, not a standalone page). The headline figure carried elsewhere is "**56 pages**", and the `MVP_SCOPE §4` parenthetical breakdown `Public(5)/Auth(3)/Buyer(13)/Seller(22)/Admin(18)` sums to 61 — three different numbers. This is a pre-existing numbering inconsistency in the source docs; reconciling the headline is a docs-hygiene follow-up (see the Phase-4 worklist), **not** an add/remove of any screen. The matrix below enumerates exactly the §3 pages.

### Public / Guest (5)
| Screen | ar-RTL light | ar-RTL dark | en-LTR light | en-LTR dark |
|---|---|---|---|---|
| Homepage | ☐ | ☐ | ☐ | ☐ |
| Search & Filter Results | ☐ | ☐ | ☐ | ☐ |
| Category Browse | ☐ | ☐ | ☐ | ☐ |
| Listing Detail | ☐ | ☐ | ☐ | ☐ |
| Public Storefront | ☐ | ☐ | ☐ | ☐ |

### Auth (3)
| Screen | ar-RTL light | ar-RTL dark | en-LTR light | en-LTR dark |
|---|---|---|---|---|
| Phone Entry (Login / Register start) | ☐ | ☐ | ☐ | ☐ |
| OTP Verification | ☐ | ☐ | ☐ | ☐ |
| Complete Buyer Profile | ☐ | ☐ | ☐ | ☐ |

### Buyer (13)
| Screen | ar-RTL light | ar-RTL dark | en-LTR light | en-LTR dark |
|---|---|---|---|---|
| Account / Profile | ☐ | ☐ | ☐ | ☐ |
| Address Book | ☐ | ☐ | ☐ | ☐ |
| Wishlist & Saved | ☐ | ☐ | ☐ | ☐ |
| Followed Sellers | ☐ | ☐ | ☐ | ☐ |
| Buyer Inbox (Inquiries) | ☐ | ☐ | ☐ | ☐ |
| Checkout | ☐ | ☐ | ☐ | ☐ |
| Order Confirmation & Payment Instructions | ☐ | ☐ | ☐ | ☐ |
| Order History | ☐ | ☐ | ☐ | ☐ |
| Order Detail / Track Order | ☐ | ☐ | ☐ | ☐ |
| Leave Review | ☐ | ☐ | ☐ | ☐ |
| Raise Dispute | ☐ | ☐ | ☐ | ☐ |
| Dispute Detail / Thread (Buyer) | ☐ | ☐ | ☐ | ☐ |
| Notifications Center | ☐ | ☐ | ☐ | ☐ |

### Seller (22)
| Screen | ar-RTL light | ar-RTL dark | en-LTR light | en-LTR dark |
|---|---|---|---|---|
| Seller Onboarding (5-step) | ☐ | ☐ | ☐ | ☐ |
| Seller Application Status | ☐ | ☐ | ☐ | ☐ |
| Seller Dashboard | ☐ | ☐ | ☐ | ☐ |
| Store Profile Settings | ☐ | ☐ | ☐ | ☐ |
| Delivery Settings | ☐ | ☐ | ☐ | ☐ |
| Return Policy Settings | ☐ | ☐ | ☐ | ☐ |
| Payment Methods Settings | ☐ | ☐ | ☐ | ☐ |
| Listings Management | ☐ | ☐ | ☐ | ☐ |
| Create / Edit Listing | ☐ | ☐ | ☐ | ☐ |
| Stock & Inventory | ☐ | ☐ | ☐ | ☐ |
| Boost Listing | ☐ | ☐ | ☐ | ☐ |
| Boost Management / History | ☐ | ☐ | ☐ | ☐ |
| Seller Inbox (Inquiries) | ☐ | ☐ | ☐ | ☐ |
| Orders Management (Seller) | ☐ | ☐ | ☐ | ☐ |
| Order Detail (Seller) | ☐ | ☐ | ☐ | ☐ |
| Reviews Management (Seller) | ☐ | ☐ | ☐ | ☐ |
| Earnings | ☐ | ☐ | ☐ | ☐ |
| Transactions | ☐ | ☐ | ☐ | ☐ |
| Request Payout | ☐ | ☐ | ☐ | ☐ |
| Level Progress | ☐ | ☐ | ☐ | ☐ |
| Seller Analytics | ☐ | ☐ | ☐ | ☐ |
| Dispute Detail (Seller) | ☐ | ☐ | ☐ | ☐ |

### Admin (17 headings — incl. WhatsApp Templates as a merged tab)
| Screen | ar-RTL light | ar-RTL dark | en-LTR light | en-LTR dark |
|---|---|---|---|---|
| Admin Dashboard | ☐ | ☐ | ☐ | ☐ |
| Seller Approval Queue | ☐ | ☐ | ☐ | ☐ |
| User & Seller Management | ☐ | ☐ | ☐ | ☐ |
| Listings Moderation (Admin) | ☐ | ☐ | ☐ | ☐ |
| Flagged Content Queue | ☐ | ☐ | ☐ | ☐ |
| Reviews Moderation | ☐ | ☐ | ☐ | ☐ |
| Categories Management | ☐ | ☐ | ☐ | ☐ |
| Orders Management (Admin) | ☐ | ☐ | ☐ | ☐ |
| Disputes Management (Admin) | ☐ | ☐ | ☐ | ☐ |
| Payments Management (Admin) | ☐ | ☐ | ☐ | ☐ |
| Payouts Management (Admin) | ☐ | ☐ | ☐ | ☐ |
| Editorial Collections | ☐ | ☐ | ☐ | ☐ |
| Notifications Broadcast | ☐ | ☐ | ☐ | ☐ |
| WhatsApp Templates *(merged tab — Admin → Settings → Notifications; not a standalone page, OD-5)* | ☐ | ☐ | ☐ | ☐ |
| Admin Settings | ☐ | ☐ | ☐ | ☐ |
| Moderation Log | ☐ | ☐ | ☐ | ☐ |
| Boost Approval (Admin) | ☐ | ☐ | ☐ | ☐ |

---

## Appendix A — Gap Register

### [DATA GAP] — wireframe/use-case data needs with no matching table
- **Inventory / low-stock alert log** (Stock & Inventory page). C1 §6.1 and C2 §1 approved an "Inventory Alert" record, but the final schema has **no `inventory_alerts` table**. Low-stock is only derivable live from `listings.stock_qty ≤ low_stock_threshold`; no persisted alert/acknowledgement history exists.
- **Account-deletion / anonymization state** (Account page, MW1). RESOLVED (OD-2 FROZEN): `users.deleted_at` + `users.anonymized_at` added now; MVP behavior is deactivate-only (no anonymization); full MW1 is post-MVP.
- **Broadcast delivery tracking** (Notifications Broadcast, MW4). MW4 calls for delivery tracking of bulk sends; only per-recipient `notifications` rows exist — there is no campaign/batch entity to track aggregate delivery.

### [UI GAP] — tables with no corresponding documented wireframe page
- **`sessions`** — UI intentionally OUT for MVP (OD-5 FROZEN). `device_info` retained for a post-MVP security/active-sessions dashboard. Sessions are used only implicitly by the auth flow in MVP.
- **`whatsapp_templates`** — RESOLVED (OD-5 FROZEN): managed under Admin → Settings → Notifications tab; not a standalone page. Change-logging required (C3 §8.2 RISK 1).

### Coverage confirmation
- All other 41 physical tables map to at least one documented page above.
- All 70 use cases in the C2 §6 Coverage Matrix are represented by at least one page.
- No page references a data field without a backing table/column except where flagged **[DATA GAP]** above.

---

*End of BETK_UI_SPEC.md — derived from BETK Architecture Review Conversations 1–3; validated against the C2/C3 ERD, SQL schema, enums, and RLS policies.*
