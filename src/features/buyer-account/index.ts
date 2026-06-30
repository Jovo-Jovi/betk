/**
 * Feature: buyer-account
 * FR IDs:  FR-BUY-1 (profile), FR-BUY-2 (addresses), FR-BUY-3 (wishlist), FR-BUY-4 (following)
 * UI Spec: §4.1–4.4 Buyer — account, addresses, wishlist, following
 * Tables:  betk.users, betk.buyer_profiles, betk.addresses, betk.wishlists, betk.store_follows
 */

// T05: profile query + edit action.
export { getProfile } from "./queries/getProfile";
export type { ProfileData } from "./queries/getProfile";
export { updateProfile } from "./actions/updateProfile";
export type { UpdateProfileResult } from "./actions/updateProfile";
