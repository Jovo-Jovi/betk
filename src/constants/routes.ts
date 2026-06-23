/**
 * Route builders — mirrors every route in BETK_UI_SPEC.md §2 (top-level) and §3 (all pages).
 *
 * Convention:
 *   - Static routes: plain string constants (no trailing slash).
 *   - Dynamic routes: typed arrow functions that return a string.
 *   - Grouped by surface: public / auth / buyer / seller / admin.
 *
 * Usage:
 *   import { routes } from "@/constants/routes"
 *   href={routes.listing(id)}
 *   href={routes.store(slug)}
 *   href={routes.seller.orderDetail(orderId)}
 *   href={routes.admin.disputeDetail(id)}
 *   href={routes.checkout(inquiryId)}
 */

// ── Public / Guest ─────────────────────────────────────────────────────────
// UI Spec §2 top-level + §3 PUBLIC/GUEST pages
const publicRoutes = {
  /** `/` — Homepage */
  home: "/",

  /** `/search` — Search & Filter Results (append ?q=&category=&… as needed) */
  search: "/search",

  /** `/category/[slug]` — Category Browse */
  category: (slug: string) => `/category/${slug}`,

  /** `/listing/[id]` — Listing Detail */
  listing: (id: string) => `/listing/${id}`,

  /** `/store/[slug]` — Public Storefront */
  store: (slug: string) => `/store/${slug}`,
} as const;

// ── Auth ──────────────────────────────────────────────────────────────────
// UI Spec §3 AUTH pages
const authRoutes = {
  /** `/auth/login` — Phone Entry / Google OAuth start */
  login: "/auth/login",

  /** `/auth/verify` — OTP Verification */
  verify: "/auth/verify",

  /** `/auth/register` — Complete Buyer Profile (mid-auth, profile incomplete) */
  register: "/auth/register",
} as const;

// ── Buyer (protected) ─────────────────────────────────────────────────────
// UI Spec §3 BUYER pages
const buyerRoutes = {
  /** `/account` — Account / Profile */
  account: "/account",

  /** `/account/addresses` — Address Book */
  addresses: "/account/addresses",

  /** `/account/following` — Followed Sellers */
  following: "/account/following",

  /** `/wishlist` — Wishlist & Saved */
  wishlist: "/wishlist",

  /** `/inbox` — Buyer Inbox list */
  inbox: "/inbox",

  /** `/inbox/[inquiryId]` — Buyer Inbox thread */
  inboxThread: (inquiryId: string) => `/inbox/${inquiryId}`,

  /** `/checkout/confirmation/[orderId]` — Order Confirmation & Payment Instructions */
  checkoutConfirmation: (orderId: string) => `/checkout/confirmation/${orderId}`,

  /** `/orders` — Order History */
  orders: "/orders",

  /** `/orders/[id]` — Order Detail / Track Order */
  orderDetail: (id: string) => `/orders/${id}`,

  /** `/orders/[id]/review` — Leave Review */
  orderReview: (id: string) => `/orders/${id}/review`,

  /** `/orders/[id]/dispute/new` — Raise Dispute */
  orderDisputeNew: (id: string) => `/orders/${id}/dispute/new`,

  /** `/disputes/[id]` — Dispute Detail / Thread (Buyer) */
  disputeDetail: (id: string) => `/disputes/${id}`,

  /** `/notifications` — Notifications Center */
  notifications: "/notifications",
} as const;

// ── Seller (role: seller) ─────────────────────────────────────────────────
// UI Spec §3 SELLER pages
const sellerRoutes = {
  /** `/seller/onboarding` — Seller Onboarding (5-step wizard) */
  onboarding: "/seller/onboarding",

  /** `/seller/status` — Seller Application Status (pending / rejected / suspended) */
  status: "/seller/status",

  /** `/seller` — Seller Dashboard (active sellers only) */
  dashboard: "/seller",

  // ── Store settings ──────────────────────────────────────────────────────

  /** `/seller/store` — Store Profile Settings */
  store: "/seller/store",

  /** `/seller/store/delivery` — Delivery Settings */
  storeDelivery: "/seller/store/delivery",

  /** `/seller/store/returns` — Return Policy Settings */
  storeReturns: "/seller/store/returns",

  /** `/seller/store/payments` — Payment Methods Settings */
  storePayments: "/seller/store/payments",

  // ── Listings ────────────────────────────────────────────────────────────

  /** `/seller/listings` — Listings Management */
  listings: "/seller/listings",

  /** `/seller/listings/new` — Create Listing */
  listingNew: "/seller/listings/new",

  /** `/seller/listings/[id]/edit` — Edit Listing */
  listingEdit: (id: string) => `/seller/listings/${id}/edit`,

  /** `/seller/listings/[id]/boost` — Boost Listing */
  listingBoost: (id: string) => `/seller/listings/${id}/boost`,

  /** `/seller/inventory` — Stock & Inventory */
  inventory: "/seller/inventory",

  /** `/seller/boosts` — Boost Management / History */
  boosts: "/seller/boosts",

  // ── Inbox ───────────────────────────────────────────────────────────────

  /** `/seller/inbox` — Seller Inbox list */
  inbox: "/seller/inbox",

  /** `/seller/inbox/[inquiryId]` — Seller Inbox thread */
  inboxThread: (inquiryId: string) => `/seller/inbox/${inquiryId}`,

  // ── Orders ──────────────────────────────────────────────────────────────

  /** `/seller/orders` — Orders Management */
  orders: "/seller/orders",

  /** `/seller/orders/[id]` — Order Detail (Seller) */
  orderDetail: (id: string) => `/seller/orders/${id}`,

  // ── Reviews & Earnings ──────────────────────────────────────────────────

  /** `/seller/reviews` — Reviews Management */
  reviews: "/seller/reviews",

  /** `/seller/earnings` — Earnings */
  earnings: "/seller/earnings",

  /** `/seller/transactions` — Transactions ledger */
  transactions: "/seller/transactions",

  /** `/seller/payouts` — Payout request history */
  payouts: "/seller/payouts",

  /** `/seller/payouts/new` — Request Payout form */
  payoutsNew: "/seller/payouts/new",

  // ── Growth ──────────────────────────────────────────────────────────────

  /** `/seller/level` — Level Progress */
  level: "/seller/level",

  /** `/seller/analytics` — Seller Analytics */
  analytics: "/seller/analytics",

  // ── Disputes ────────────────────────────────────────────────────────────

  /** `/seller/disputes/[id]` — Dispute Detail (Seller participation) */
  disputeDetail: (id: string) => `/seller/disputes/${id}`,
} as const;

// ── Admin (role: admin | superadmin) ──────────────────────────────────────
// UI Spec §3 ADMIN pages
const adminRoutes = {
  /** `/admin` — Admin Dashboard */
  dashboard: "/admin",

  // ── Seller moderation ────────────────────────────────────────────────────

  /** `/admin/sellers/approvals` — Seller Approval Queue */
  sellerApprovals: "/admin/sellers/approvals",

  /** `/admin/users` — User & Seller Management (suspend/ban) */
  users: "/admin/users",

  // ── Catalog & content ───────────────────────────────────────────────────

  /** `/admin/listings` — Listings Moderation */
  listings: "/admin/listings",

  /** `/admin/moderation/flags` — Flagged Content Queue */
  moderationFlags: "/admin/moderation/flags",

  /** `/admin/moderation/log` — Moderation Log (immutable audit trail) */
  moderationLog: "/admin/moderation/log",

  /** `/admin/reviews` — Reviews Moderation */
  reviews: "/admin/reviews",

  /** `/admin/categories` — Categories Management */
  categories: "/admin/categories",

  // ── Commerce ────────────────────────────────────────────────────────────

  /** `/admin/orders` — Orders Management (Admin) */
  orders: "/admin/orders",

  /** `/admin/disputes` — Disputes Management queue */
  disputes: "/admin/disputes",

  /** `/admin/disputes/[id]` — Dispute Detail / Resolution (Admin) */
  disputeDetail: (id: string) => `/admin/disputes/${id}`,

  /** `/admin/payments` — Payments Management */
  payments: "/admin/payments",

  /** `/admin/payouts` — Payouts Management */
  payouts: "/admin/payouts",

  // ── Content & Boosts ────────────────────────────────────────────────────

  /** `/admin/collections` — Editorial Collections list */
  collections: "/admin/collections",

  /** `/admin/collections/[id]` — Collection editor (listings picker) */
  collectionDetail: (id: string) => `/admin/collections/${id}`,

  /** `/admin/boosts` — Boost Approval & package config (MW3) */
  boosts: "/admin/boosts",

  // ── Notifications & Settings ─────────────────────────────────────────────

  /** `/admin/notifications` — Notifications Broadcast (MW4) */
  notifications: "/admin/notifications",

  /**
   * `/admin/settings` — Admin Settings (General tab + Notifications tab).
   * WhatsApp templates live under the Notifications tab here (OD-5 FROZEN —
   * no standalone route).
   */
  settings: "/admin/settings",
} as const;

// ── Composed export ───────────────────────────────────────────────────────

/**
 * Single import for all BETK routes.
 *
 * Surfaces:
 *   routes.home / routes.search / routes.listing(id) / routes.store(slug)
 *   routes.category(slug)
 *   routes.checkout(inquiryId)          ← buyer entrypoint, top-level for convenience
 *   routes.auth.*
 *   routes.buyer.*
 *   routes.seller.*
 *   routes.admin.*
 */
export const routes = {
  ...publicRoutes,

  /** `/checkout?inquiry=[inquiryId]` — Checkout (requires confirmed inquiry, OD-4 phone gate) */
  checkout: (inquiryId: string) => `/checkout?inquiry=${inquiryId}`,

  auth: authRoutes,
  buyer: buyerRoutes,
  seller: sellerRoutes,
  admin: adminRoutes,
};
