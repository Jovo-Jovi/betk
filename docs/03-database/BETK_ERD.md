# BETK_ERD.md
> Step 3 of the BETK Dev OS. The ERD and SQL already exist (Architecture Conversations 2 & 3); this document wraps them with the highest-value remaining work: RLS strategy per table, index justifications, soft-delete decisions, row-ownership model, scale assumptions, and Supabase→TypeScript type mapping. The executable schema is filed as `BETK_DATABASE_SCHEMA.sql` (this directory).

## 1. Table count reconciliation (OD-6)

The C2/C3 headline says "28 tables"; the detailed specifications define **43 physical tables** across 13 domains + 2 analytics tables in `betk_analytics`. This document is authoritative: **43 tables**. Generated TypeScript types must reflect all 43.

Domains: Identity&Auth (users, otp_tokens, sessions); User Mgmt (buyer_profiles, addresses); Seller Mgmt (seller_profiles, seller_documents, seller_strikes); Store (stores, store_follows); Catalog (categories, listings, listing_images, listing_tags, wishlists, restock_alerts); Messaging (inquiries, inquiry_messages, order_messages); Orders (orders, order_items, order_status_history); Payments (payments, payouts); Delivery (shipments, shipment_tracking_events); Reviews (reviews, review_photos, rating_aggregates); Disputes (disputes, dispute_evidence, dispute_messages); Boosts (boost_packages, boosts); Admin (notifications, collections, collection_listings, flagged_content, moderation_logs, whatsapp_templates, admin_settings); Analytics (betk_analytics.seller_snapshots, betk_analytics.platform_snapshots).

### 1.1 Authoritative table inventory & counting methodology (OD-6, FROZEN)

**Authoritative count = 43 physical tables.** Counting methodology: a "table" is any `CREATE TABLE` that holds rows at runtime, counted across both schemas (`betk` + `betk_analytics`); enum types, helper functions, triggers, views, and the `betk_audit` schema are **not** counted. The stale "28 tables" headline in C2/C3 is superseded by this section.

Inventory (43): **betk (41)** — users, otp_tokens, sessions, buyer_profiles, addresses, seller_profiles, seller_documents, seller_strikes, stores, store_follows, categories, listings, listing_images, listing_tags, wishlists, restock_alerts, inquiries, inquiry_messages, order_messages, orders, order_items, order_status_history, payments, payouts, shipments, shipment_tracking_events, reviews, review_photos, rating_aggregates, disputes, dispute_evidence, dispute_messages, boost_packages, boosts, notifications, collections, collection_listings, flagged_content, moderation_logs, whatsapp_templates, admin_settings. **betk_analytics (2)** — seller_snapshots, platform_snapshots.

### 1.2 Identity model (OD-4, FROZEN — Google OAuth IN)

Sign-in via **phone-OTP or Google OAuth** (Supabase Auth links both to one `users` row). `users.phone_number` is **nullable + UNIQUE** (multiple NULLs allowed) so OAuth users exist before providing a phone; `users.auth_provider` (`'phone'|'google'`) records identity origin. **A verified phone is required before transacting** — `orders`, `seller_profiles` (becoming a seller), and `payouts` inserts require `users.phone_number IS NOT NULL`, enforced in Server Actions and RLS `WITH CHECK`. R-A01 amended accordingly (see `06-security/SECURITY_GUIDELINES.md`).

## 2. Row-ownership & tenant-isolation model

BETK is multi-tenant by **store** (the seller's unit of participation) and by **user**. Ownership columns:
- User-owned: `buyer_profiles.id=users.id`, `addresses.buyer_id`, `wishlists.buyer_id`, `restock_alerts.buyer_id`, `notifications.user_id`, `sessions.user_id`, `store_follows.buyer_id`.
- Store-owned (resolved via `betk.my_store_id()`): `stores.seller_id`, `listings.store_id`, `payouts.store_id`, `boosts.store_id`, `reviews.store_id` (denormalized), `disputes.store_id` (denormalized), `seller_analytics_snapshots.store_id`.
- Order-scoped (buyer OR store of the order): `orders`, `order_items`, `order_status_history`, `payments`, `shipments`, `order_messages`, and `reviews`/`disputes` by order.
- Admin-only: `moderation_logs`, `admin_settings`, `flagged_content` (write), `collections` (write), `platform_snapshots`.

Two `SECURITY DEFINER` helpers anchor isolation: `betk.is_admin()` and `betk.my_store_id()`. Both must use indexed lookups; `auth.uid()` should be cached in session context where possible (C3 §8.1 RLS performance note).

## 3. RLS strategy per table

Principles (C3 §5): RLS enabled on **every** table; default-deny; admins bypass via `is_admin()`; service_role (background jobs) bypasses RLS; sellers see only their store data; buyers see only their own rows.

| Table | SELECT | INSERT | UPDATE | DELETE | Policy basis |
|---|---|---|---|---|---|
| users | self or admin | (Supabase Auth) | self or admin | — | `users_self` |
| otp_tokens | service/admin | service | service | cron cleanup | not client-readable |
| sessions | self | Auth | Auth | self/expiry | self-scope |
| buyer_profiles | self or admin (public name/gov for discovery) | self | self | — | `bp_self` |
| addresses | self or admin | self | self | self | `addr_self` |
| seller_profiles | self, public if active, admin | self | self or admin | — | `sp_select`,`sp_update` |
| seller_documents | own seller or admin | own | own/admin | — | `sdoc_own` (private bucket) |
| seller_strikes | own seller or admin | admin | admin | — | admin-write |
| stores | public if active, own, admin | own | own or admin | — | `stores_public`,`stores_manage` |
| store_follows | self or admin | self | — | self | self-scope |
| categories | public if active, admin | admin | admin | admin | `cat_public`,`cat_admin` |
| listings | active+not-deleted public, own store, admin | own store | own store or admin | soft-delete only | `listings_public`,`listings_seller` |
| listing_images / listing_tags | follows listing | own store | own store | own store | via listing |
| wishlists | self or admin | self | self | self | `wishlist_own` |
| restock_alerts | self or admin | self | service (notified_at) | self | self-scope |
| inquiries | buyer or store or admin | buyer | store/admin | — | `inq_buyer` |
| inquiry_messages | thread parties | thread parties | sender | — | via inquiry |
| order_messages | order parties | order parties/system | sender | — | via order |
| orders | buyer or store or admin | buyer | store/admin | — | `orders_access` |
| order_items | follows order | system (checkout) | — | — | via order |
| order_status_history | follows order | system/actor | — (append-only) | — (append-only) | immutable |
| payments | order parties or admin | system (checkout) | seller(confirm)/admin | — | `payments_access` |
| payouts | own store or admin | own store | admin | — | `payouts_own`,`payouts_insert` |
| shipments / shipment_tracking_events | order parties or admin | store/courier | store/courier | — | via order |
| reviews | visible public, author, store, admin | buyer (own) | buyer<deadline / store(reply) / admin | — | `reviews_public/buyer/edit` |
| review_photos | follows review | author | — | author<deadline | via review |
| rating_aggregates | public | trigger | trigger | — | read-public |
| disputes | buyer or store or admin | buyer | admin/parties | — | `disputes_access` |
| dispute_evidence / dispute_messages | dispute parties or admin | parties | sender | — | via dispute |
| boosts | active public, own store, admin | own store | admin(confirm)/cron(expire) | — | `boosts_public` |
| boost_packages | active public, admin | admin | admin | admin | `boost_pkg_public` |
| notifications | self or admin | system | self(read) | self | `notif_own` |
| collections | live public, admin | admin | admin | admin | `collections_public/admin` |
| collection_listings | follows collection | admin | admin | admin | via collection |
| flagged_content | admin | any/system | admin | — | admin-managed |
| moderation_logs | admin | admin | — (append-only) | — (append-only) | `modlog_admin` |
| whatsapp_templates | admin | admin | admin | — | admin-managed |
| admin_settings | admin | admin | admin | — | `settings_admin` |
| betk_analytics.seller_snapshots | own store or admin | cron | cron | — | `seller_snap_own` |
| betk_analytics.platform_snapshots | admin | cron | cron | — | `platform_snap_admin` |

## 4. Index justifications (41 indexes)

> **Count correction (T14 + R4):** the DoD/pre-build estimate was 34; live = **41 non-constraint indexes** (40 `idx_*` + the partial-unique `uq_active_boost_per_listing`). Over-provisioned, **none missing** — do not drop indexes to "match" the old estimate.

GIN on `listings.search_vector` — full-text 1–2 keyword search (unaccent). B-tree `listings(store_id,status)`, `(category_id,status)`, partial `(created_at DESC) WHERE active&!deleted` (new arrivals), partial `(view_count DESC) WHERE active&!deleted` (popularity), `(store_id) WHERE active&!deleted` (storefront/location). `inquiries(store_id,status)`,`(buyer_id)`,`(store_id,last_message_at DESC)` (inbox sort). `orders(buyer_id,status)`,`(store_id,status)`,`(store_id,created_at DESC)`. `order_status_history(order_id,created_at DESC)`. `payments(order_id)`, partial `(status) WHERE pending`. `payouts(store_id)`, partial `(requested_at) WHERE pending`. `reviews(store_id) WHERE is_visible`. `disputes(status,sla_deadline) WHERE not resolved/closed` (SLA monitor), `(store_id)`. Partial unique `boosts(listing_id) WHERE active` (concurrent-boost guard, R-B01) + `boosts(expires_at) WHERE active` (expiry cron). `notifications(user_id) WHERE !is_read` (unread badge), `(user_id,sent_at DESC)`. `flagged_content(severity,created_at) WHERE pending`. `moderation_logs(target_id,target_type)`,`(admin_id,created_at DESC)`. `seller_snapshots(store_id,snapshot_date DESC)`,`(snapshot_date DESC)`. Apply all on day 1 (C2 §7.3).

## 5. Soft-delete vs hard-delete decisions

- **Soft delete (`deleted_at`):** `listings` only — historical `order_items` reference listings, so removal must preserve integrity (R-L10). `order_items` additionally snapshots `listing_title_ar` + `unit_price` so order history survives even if a listing row is later purged.
- **Status-based hiding (not deletion):** suspended sellers/stores/listings are hidden via `status` filters (R-S07), never deleted.
- **Append-only (no delete):** `order_status_history`, `moderation_logs` (legal/audit). Enforce via RULES/policies preventing UPDATE/DELETE.
- **Hard delete (allowed):** `listing_images`/`review_photos`/`dispute_evidence` (with matching CDN/Storage delete), `wishlists`/`store_follows`/`addresses` (user-controlled), `otp_tokens` (hourly cron cleanup of expired), expired `sessions`.
- **Account deletion (OD-2, FROZEN):** MVP = **deactivate-only** via `users.status`. The columns `users.deleted_at` and `users.anonymized_at` (both `TIMESTAMPTZ NULL`) are **added now** (forward-compat — avoids a later `users` migration) but carry no MVP behavior: login is blocked when status≠active **or** `deleted_at IS NOT NULL` (R-A05); no hard delete, no anonymization. Full MW1 anonymization workflow populates `anonymized_at` post-MVP.

## 6. Scale assumptions at launch

< 50K listings (search safe for 2+ yrs); < 100K orders/month; `notifications` 5–10 rows/order → archive `is_read=TRUE` > 90 days before 50K orders; `order_status_history` ~5 rows/order, archive > 1yr; `rating_aggregates` 1 row/store (trigger-updated); `seller_snapshots` 1 row/store/day → partition by year before 10K sellers; split payments = 2 rows/order with UNIQUE `(order_id,payment_type)` to prevent duplicates. (C3 §8.1.)

## 7. Triggers (5)

`update_listing_search_vector` (BEFORE INSERT/UPDATE on listings → tsvector from title_ar+title_en+description_ar via unaccent); `set_review_edit_deadline` (BEFORE INSERT on reviews → `edit_deadline = created_at + 48h`); `set_dispute_sla` (BEFORE INSERT on disputes → `sla_deadline = created_at + 48h`); `recalculate_rating_aggregate` (AFTER INSERT/UPDATE/DELETE on reviews → recompute `rating_aggregates`, R-R07); `decrement_stock_on_confirm` (on order confirmation → `listings.stock_qty`, set sold_out at 0, R-L05/06). At MVP scale these are acceptable; post-MVP move rating recompute to a queue (C3 §8.3).

## 8. Supabase → TypeScript type mapping

- Generate types: `supabase gen types typescript --linked --schema betk,betk_analytics > src/lib/supabase/types.ts`. Regenerate after **every** migration; commit the diff in the same PR (CI checks it is current — see `CICD_PIPELINE.md`).
- Mapping conventions: Postgres `uuid`→`string`; `timestamptz`→`string` (ISO); `numeric`→`number` (watch precision on money — treat EGP amounts as `number` but format/round at the edge; never do float math for totals — compute server-side); `jsonb`→typed via hand-written interfaces in `src/types/` layered over the generated `Json` type (e.g. `StorePaymentMethods`, `StoreDeliveryOptions`, `NotificationPrefs`, `NotificationData`); enums → generated string-literal unions matching C3 §2 (`user_role`, `order_status`, `payment_method`, `dispute_status`, …). Re-export enum unions from `src/constants/enums.ts` so UI badge maps (`StatusBadge`) stay in sync.
- Validation boundary: generated types describe DB shape; **Zod** schemas in `src/validations/` validate all inputs (forms, Server Actions, API routes) before they touch Supabase. Types and Zod are kept separate by design (Dev OS Step 5).

## 9. Executable schema

The full PostgreSQL 17 / Supabase DDL — extensions, **34 enum types** (verified via `pg_type` query, T12 2026-06-23), 43 `CREATE TABLE`s, constraints, 41 indexes, 5 triggers, 39 RLS policies (36 permissive + 3 restrictive, post-T01-FIX), 2 helper functions, 6 pg_cron jobs — is the contract in `BETK_DATABASE_SCHEMA.sql`. Migrations run in the exact 057-step dependency order from C3 §7 (note the circular `inquiries.converted_to_order_id` ↔ `orders` resolved by ALTER after both exist; seed boost_packages at 039 and admin_settings at 048).
