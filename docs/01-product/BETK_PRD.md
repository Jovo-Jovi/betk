# BETK_PRD.md
> Step 2 of the BETK Dev OS. Functional requirements are derived **one block per wireframed page** in `BETK_UI_SPEC.md`; each maps to an acceptance criterion. Business rules are quoted by ID from the C1 Business Rules catalog (R-Axx … R-Bxx). Reads with `BETK_MVP_SCOPE.md` (frozen) and `BETK_ERD.md` (data contract).

## 1. Executive summary

BETK is an Arabic-first RTL marketplace for Egypt's informal creative economy — bilingual Arabic/English with light/dark theming (OD-7), Arabic-first by default. Sellers get free verified storefronts; buyers get neighborhood discovery, local split-payment, and structured buyer protection. Monetization is via listing boosts **and a platform commission on custodial orders (OD-8 — buyer pays BETK, which settles to the seller net of commission)**. The product is a responsive Next.js 15 web app on Supabase (Postgres + Auth + Storage), deployed on Vercel. This PRD defines what to build for MVP — bounded exactly by the 59 pages of the UI Spec and the 43-table schema.

## 2. Problem statement

50.7M Egyptian social users sell informally over WhatsApp/Instagram with no trust layer, no structured payments, no discovery, and no buyer protection. No single platform serves products *and* services in one Arabic-first marketplace (bilingual AR/EN + light/dark, OD-7). Buyers cannot verify sellers, track orders, or recover from bad transactions; sellers cannot build durable storefronts or reputation.

## 3. Solution

A verified-storefront marketplace: phone-OTP identity, admin-gated seller verification (national ID), Arabic-first listings (products and services; bilingual AR/EN + light/dark, OD-7), 1–2 keyword full-text search with governorate/city filters, structured inquiries that convert to orders, a 50/50 split-payment model (deposit upfront + COD) that is **custodial — the buyer pays BETK, which settles to the seller net of a platform commission (OD-8/ADR-016)**, courier integration (Bosta) plus self-deliver/pickup/remote, reviews and seller levels for trust, admin-mediated disputes with a 48h SLA, and boosts for monetization.

## 4. Actors

As defined in `BETK_MVP_SCOPE.md §2`: Guest (public), Buyer (protected), Seller (role: seller, status-gated), Admin/Superadmin (role: admin). Identity is unified in `users`; `buyer_profiles`/`seller_profiles` extend 1:1. Roles are additive over time (R-A04).

## 5. Functional requirements (one block per page)

Format: **FR-[area]-[n]** → page (UI Spec §3) · auth gate · primary tables · key rules. Acceptance criterion is in §9 with the same ID.

### Public / Guest
- **FR-PUB-1 Homepage** — `/` · public · `collections`/`collection_listings`/`listings`/`listing_images`/`rating_aggregates`/`categories`/`boosts` · live collections by `homepage_position`; new arrivals; boosted strip; guest write-actions redirect to login.
- **FR-PUB-2 Search & Filter** — `/search` · public · `listings.search_vector` (tsvector/GIN/unaccent), `categories`, `stores` · 1–2 keyword search; filters category/type/governorate/city/price; boosted ranking (R-B04).
- **FR-PUB-3 Category Browse** — `/category/[slug]` · public · `categories` (self-ref), `listings` · inactive category → 404.
- **FR-PUB-4 Listing Detail** — `/listing/[id]` · public · `listings`,`listing_images`,`listing_tags`,`stores`,`seller_profiles`,`rating_aggregates`,`reviews`,`review_photos`,`wishlists`,`restock_alerts` · `view_count` increment; price_type handling (R-L09); sold_out → restock CTA (R-N06); removed → 404 (R-L10).
- **FR-PUB-5 Public Storefront** — `/store/[slug]` · public · `stores`,`seller_profiles`,`rating_aggregates`,`listings`,`reviews`,`store_follows` · suspended store hidden (R-S07).

### Auth
- **FR-AUTH-1 Phone Entry / Sign-in** — `/auth/login` · public · `otp_tokens`,`users` · OTP **or Google OAuth** (OD-4); no passwords (R-A01 amended); 60s OTP expiry, one active per phone (R-A02); phone unique but **nullable** (R-A03 amended); `auth_provider` records origin; suspended/deactivated blocked (R-A05). **Verified phone required before transacting** (checkout/become-seller/payout) — Google-only users are prompted for phone+OTP at that point.
- **FR-AUTH-2 OTP Verify** — `/auth/verify` · public · `otp_tokens`,`sessions`,`users` · hash compare; ≤5 attempts; on success create session (30d mobile/24h web), set `last_login_at`; role routing.
- **FR-AUTH-3 Complete Buyer Profile** — `/auth/register` · protected · `buyer_profiles`,`categories` · full_name + governorate required.

### Buyer
- **FR-BUY-1 Account/Profile** — `/account` · protected · `buyer_profiles`,`users` · phone read-only (R-A06); deactivate per OD-2.
- **FR-BUY-2 Address Book** — `/account/addresses` · protected · `addresses` · max one `is_default` per buyer.
- **FR-BUY-3 Wishlist** — `/wishlist` · protected · `wishlists`,`listings`,`restock_alerts` · restock toggle on sold_out (R-N06).
- **FR-BUY-4 Followed Sellers** — `/account/following` · protected · `store_follows`,`stores` · new-listing indicator vs `followed_at`.
- **FR-BUY-5 Buyer Inbox** — `/inbox`,`/inbox/[id]` · protected · `inquiries`,`inquiry_messages` · confirmed inquiry → checkout CTA.
- **FR-BUY-6 Checkout** — `/checkout` · protected · `orders`,`order_items`,`addresses`,`payments`,`admin_settings` · order only from confirmed inquiry (R-O01); BETK-ref (R-O02); two payment rows split, **payee = BETK (custodial, OD-8/ADR-016) — BETK's deposit rails + commission rate + flat delivery fee read from `admin_settings`; `commission_rate`/`commission_amount` snapshotted on the order at creation**; stock decremented on seller confirm not here (R-L05).
- **FR-BUY-7 Order Confirmation** — `/checkout/confirmation/[id]` · protected · `orders`,`payments`,`admin_settings` · deposit instructions render **BETK's** handles (`admin_settings`, not the store's); buyer uploads the transfer screenshot to `payments.proof_path` (private `docs` bucket, own-prefix); awaiting-review convention = `proof_path IS NOT NULL AND status='pending'`; **deposit verified by admin** (R-O05 amended; R-O04 COD auto-confirm retired — every order carries the split).
- **FR-BUY-8 Order History** — `/orders` · protected · `orders`,`order_items`.
- **FR-BUY-9 Order Detail / Track** — `/orders/[id]` · protected · `orders`,`order_status_history`,`order_items`,`payments`,`shipments`,`shipment_tracking_events`,`order_messages` · cancel only while pending (R-O03); review only if delivered+window (R-R01/03); dispute only delivered/dispatched (R-D01).
- **FR-BUY-10 Leave Review** — `/orders/[id]/review` · protected · `reviews`,`review_photos`,`rating_aggregates` · one per order (R-O07/R-R02); ≤3 photos; edit ≤48h (R-R03); aggregate recompute (R-R07).
- **FR-BUY-11 Raise Dispute** — `/orders/[id]/dispute/new` · protected · `disputes`,`dispute_evidence` · one active per order (R-O06/R-D06); ≤5 evidence (R-D05); SLA 48h (R-D02).
- **FR-BUY-12 Dispute Detail** — `/disputes/[id]` · protected · `disputes`,`dispute_evidence`,`dispute_messages` · resolution notifies both (R-D04).
- **FR-BUY-13 Notifications** — `/notifications` · protected · `notifications` · unread badge via partial index.

### Seller
- **FR-SEL-1 Onboarding (5-step)** — `/seller/onboarding` · protected→seller · `seller_profiles`,`stores`,`seller_documents`,`categories` · one store per seller (R-S01); unique URL-safe slug (R-S02); ID front+back (R-S05).
- **FR-SEL-2 Application Status** — `/seller/status` · role:seller · `seller_profiles`,`seller_documents`,`stores` · approval gates go-live (R-S04); resubmit retains docs (R-S08); SLA 24h (R-M01).
- **FR-SEL-3 Dashboard** — `/seller` · role:seller(active) · `seller_analytics_snapshots`,`rating_aggregates`,`seller_profiles`,`orders`,`inquiries`,`listings`.
- **FR-SEL-4 Store Profile** — `/seller/store` · role:seller · `stores` · slug change once (R-S03).
- **FR-SEL-5 Delivery Settings** — `/seller/store/delivery` · role:seller · `stores.delivery_options`.
- **FR-SEL-6 Return Policy** — `/seller/store/returns` · role:seller · `stores.return_policy`.
- **FR-SEL-7 Payment Methods** — `/seller/store/payments` · role:seller · `stores.payment_methods` · ≥1 method required to publish (R-S09).
- **FR-SEL-8 Listings Management** — `/seller/listings` · role:seller · `listings`,`listing_images` · soft delete (R-L10).
- **FR-SEL-9 Create/Edit Listing** — `/seller/listings/new|[id]/edit` · role:seller · `listings`,`listing_images`,`listing_tags`,`categories` · publish needs ≥1 image (R-L02) + ar title (R-L03) + category (R-L04); service hides stock (R-L09).
- **FR-SEL-10 Stock & Inventory** — `/seller/inventory` · role:seller · `listings`,`restock_alerts` · 0 → sold_out (R-L06); restock → active (R-L07); low-stock DERIVED (OD-1).
- **FR-SEL-11 Boost Listing** — `/seller/listings/[id]/boost` · role:seller · `boosts`,`boost_packages` · one active boost per listing (R-B01/R-L08); activates within 5 min of admin confirm (R-B02).
- **FR-SEL-12 Boost Management** — `/seller/boosts` · role:seller · `boosts`,`boost_packages` · ROI (R-B05); auto-expire (R-B03).
- **FR-SEL-13 Seller Inbox** — `/seller/inbox`,`/seller/inbox/[id]` · role:seller · `inquiries`,`inquiry_messages` · confirm→enables checkout; reply updates `avg_response_hours`; notify ≤5s (R-N04).
- **FR-SEL-14 Orders Management** — `/seller/orders` · role:seller · `orders`,`payments`,`order_status_history` · **seller accepts** pending→confirmed (AC-SEL-14, fires the stock trigger), gated on the **admin-confirmed deposit** (R-O05 amended: admin verifies the deposit, not the seller); R-O04 COD auto-confirm retired.
- **FR-SEL-15 Order Detail** — `/seller/orders/[id]` · role:seller · `orders`,`payments`,`order_status_history`,`shipments`,`shipment_tracking_events`,`order_messages` · status changes notify (R-N03).
- **FR-SEL-16 Reviews Management** — `/seller/reviews` · role:seller · `reviews`,`review_photos`,`rating_aggregates` · one immutable reply (R-R04).
- **FR-SEL-17 Earnings** — `/seller/earnings` · role:seller · `seller_analytics_snapshots`,`payouts`,`payments`.
- **FR-SEL-18 Transactions** — `/seller/transactions` · role:seller · `payments`,`orders`.
- **FR-SEL-19 Request Payout** — `/seller/payouts`,`/seller/payouts/new` · role:seller · `payouts` · min EGP 100 (R-O09); manual processing (R-O10).
- **FR-SEL-20 Level Progress** — `/seller/level` · role:seller · `seller_profiles`,`rating_aggregates` · thresholds (R-S06); nightly recalc.
- **FR-SEL-21 Seller Analytics** — `/seller/analytics` · role:seller · `seller_analytics_snapshots`,`rating_aggregates`,`boosts`.
- **FR-SEL-22 Dispute Detail (Seller)** — `/seller/disputes/[id]` · role:seller · `disputes`,`dispute_evidence`,`dispute_messages`.

### Admin
- **FR-ADM-1 Dashboard** — `/admin` · role:admin · `platform_analytics_snapshots`,`seller_analytics_snapshots`,`seller_profiles`,`disputes`,`flagged_content` · SLA panel.
- **FR-ADM-2 Seller Approval Queue** — `/admin/sellers/approvals` · role:admin · `seller_profiles`,`seller_documents`(signed URL),`stores`,`moderation_logs` · 24h SLA (R-M01); approve flips to active (R-S04).
- **FR-ADM-3 User & Seller Mgmt** — `/admin/users` · role:admin · `users`,`seller_profiles`,`seller_strikes`,`moderation_logs`,`notifications` · temp suspension auto-lifts (R-M03); permanent ban needs confirm (R-M04).
- **FR-ADM-4 Listings Moderation** — `/admin/listings` · role:admin · `listings`,`flagged_content`,`moderation_logs` · auto-flag keywords (R-M06).
- **FR-ADM-5 Flagged Content Queue** — `/admin/moderation/flags` · role:admin · `flagged_content`,`listings`,`reviews`,`moderation_logs` · 24h review (R-M05).
- **FR-ADM-6 Reviews Moderation** — `/admin/reviews` · role:admin · `reviews`,`review_photos`,`flagged_content`,`moderation_logs` · hide via is_visible (R-R06); recompute (R-R07).
- **FR-ADM-7 Categories Mgmt** — `/admin/categories` · role:admin · `categories`.
- **FR-ADM-8 Orders Mgmt** — `/admin/orders` · role:admin · `orders`,`order_items`,`payments`,`order_status_history`,`shipments`,`moderation_logs`.
- **FR-ADM-9 Disputes Mgmt** — `/admin/disputes`,`/admin/disputes/[id]` · role:admin · `disputes`,`dispute_evidence`,`dispute_messages`,`orders`,`payments`,`moderation_logs` · SLA 48h (R-D02); outcomes (R-D03); notify both (R-D04); SLA alert 47h (R-N05).
- **FR-ADM-10 Payments Mgmt** — `/admin/payments` · role:admin · `payments`,`orders`,`disputes`,`moderation_logs` · **admin verifies the deposit against the buyer's uploaded proof (`proof_path`) → `payments.status='confirmed'` + `confirmed_by`/`confirmed_at`; confirms the COD balance after courier remittance; closes the order (settlement signal, OD-8 §3)**; refund → status refunded.
- **FR-ADM-11 Payouts Mgmt** — `/admin/payouts` · role:admin · `payouts`,`moderation_logs` · manual (R-O10); **payouts settle BETK→seller net of commission (seller net = `subtotal − commission_amount`, OD-8/ADR-016); the seller's `stores.payment_methods` is now that settlement destination, not a buyer-facing handle**.
- **FR-ADM-12 Editorial Collections** — `/admin/collections`,`/admin/collections/[id]` · role:admin · `collections`,`collection_listings`,`listings` · scheduling via publish_at/archive_at.
- **FR-ADM-13 Notifications Broadcast** — `/admin/notifications` · role:admin · `notifications`,`whatsapp_templates`,audience tables · channel prefs (R-N01); WhatsApp templates (R-N02); MW4 no campaign entity (OD-3).
- **FR-ADM-14 WhatsApp Templates** — **merged into Admin → Settings → Notifications** (no standalone route; OD-5) · role:admin · `whatsapp_templates` · template CRUD + activate/deactivate within the Settings page.
- **FR-ADM-15 Admin Settings** — `/admin/settings` · role:admin(super for sensitive) · `admin_settings`,`boost_packages` · SLA + auto-flag keywords; add CHECK on numeric keys (C3 §8.2 RISK 2).
- **FR-ADM-16 Moderation Log** — `/admin/moderation/log` · role:admin · `moderation_logs` · immutable, read-only (R-M02).
- **FR-ADM-17 Boost Approval** — `/admin/boosts` · role:admin · `boosts`,`boost_packages`,`moderation_logs` · confirm payment activates (R-B02, MW3).

## 6. Non-functional requirements

- **Performance:** homepage/storefront p95 < 2.5s on Egyptian mobile networks; cache homepage (60s TTL) and rating_aggregates (5-min TTL, Redis or Edge); PgBouncer from day 1 (C3 §8.1).
- **Localization:** Arabic-first RTL throughout, bilingual AR/EN + light/dark theming (OD-7 — see `BETK_UI_SPEC.md §4`); LTR islands for digits/refs; `unaccent` search.
- **Availability:** Supabase managed Postgres; Vercel edge; graceful section-level degradation (homepage strips fail independently).
- **Scale assumptions:** < 50K listings, < 100K orders/month at launch; archive `notifications` > 90 days before 50K orders; partition `seller_snapshots` before 10K sellers (C3 §8.1).
- **Accessibility:** WCAG AA targets; keyboard + screen-reader; focus ring on `--ring`.
- **Observability:** Sentry error tracking; PostHog product analytics on key funnels.

## 7. Business rules

Authoritative rule set is the C1 catalog (R-A, R-S, R-L, R-O, R-R, R-D, R-N, R-M, R-B) reproduced in `BETK_ERD.md §Business Rule Enforcement Map`, which states for each rule whether it is enforced at the **database** (constraint/RLS/trigger) or **application** (Server Action/Zod) layer. The PRD does not restate them; it references by ID (see §5).

## 8. Security requirements

Phone-OTP **and Google OAuth** sign-in (Supabase Auth; R-A01 amended — OD-4); `users.phone_number` nullable+UNIQUE; **verified phone required before transacting**; hashed OTP & session tokens (C3 §8.2); private Supabase Storage bucket for `seller_documents` with ≤15-min signed URLs (C3 §8.2 RISK 5); RLS enabled + default-deny on every table (C3 §5); Zod validation on **every** Server Action and API route; `moderation_logs`/`order_status_history` append-only; admin actions logged. The five pre-launch security conditions in C3 §8.5 are mandatory gates (see `LAUNCH_CHECKLIST.md` and `06-security/SECURITY_GUIDELINES.md`).

## 9. Acceptance criteria (page → criterion)

Each FR has a binary acceptance criterion of the form: *"Page renders at its route behind the correct auth gate; performs its documented data reads/writes against the named tables; enforces the cited business rules; and renders correct empty, loading, and error states per `UI_STATE_STANDARDS.md`."* QA validates per page using the UI Spec page section as the test script. A feature is "done" only when its FR acceptance criterion passes in a PR review by the QA + UI-reviewer agents (see `10-ai-development/BETK_AI_TEAM.md`).

Representative high-risk criteria spelled out:
- **AC-BUY-6 (Checkout):** Given a *confirmed* inquiry, placing an order atomically creates one `orders` row (valid `betk_ref`, **with `commission_rate`+`commission_amount` snapshotted**), its `order_items`, and exactly two `payments` rows (deposit+balance) **whose payee is BETK (custodial, OD-8/ADR-016)**; a non-confirmed inquiry is rejected; no partial writes on failure.
- **AC-SEL-14 (Confirm order):** The **seller** transitions pending→confirmed (order/service acceptance — actor UNCHANGED), which writes `order_status_history`, decrements `listings.stock_qty` (→ sold_out at 0), and notifies the buyer. The seller cannot accept until the **admin** has confirmed the deposit (`payments.status='confirmed'`, OD-8 §3 — only the *deposit confirmation* moved to admin, not the acceptance); R-O04 COD auto-confirm retired — every order carries the split.
- **AC-ADM-9 (Resolve dispute):** Resolution sets `resolution`+`resolution_notes`, writes `moderation_logs`, and dispatches push+SMS to both parties; SLA alert fires at 47h for unresolved disputes.
- **AC-AUTH-2 (OTP):** ≤5 attempts per token; expired/used tokens rejected; success creates a session and never persists the raw OTP.
