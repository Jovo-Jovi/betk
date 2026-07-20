/**
 * Feature: seller-onboarding
 * FR IDs:  FR-SEL-1 (become seller form), FR-SEL-2 (application status page)
 * UI Spec: §5.1–5.2 Seller onboarding, /seller/onboarding, /seller/status
 * Tables:  betk.seller_profiles, betk.stores, betk.seller_documents, betk.users
 * Gate:    Verified phone required (OD-4) — enforced at the action
 *          (requireVerifiedPhone) AND the DB (RESTRICTIVE seller_profiles_phone_gate).
 * Atomicity: ADR-012 — one SECURITY INVOKER rpc (submit_seller_application);
 *          role flip LAST via the service-role setUserRole() helper.
 */

// T03 — become-seller submit Server Action.
export { submitSellerApplication } from "./actions/submitSellerApplication";
export type {
  SubmitSellerApplicationInput,
  SubmitSellerApplicationResult,
} from "@/validations/sellerOnboarding";

// T03 — own-application read (status / resume; T05 consumes it).
export { getOwnSellerApplication } from "./queries/getOwnSellerApplication";
export type { OwnSellerApplication } from "./queries/getOwnSellerApplication";

// T05 — rejected-only resubmit Server Action (MW2, R-S08). Same ADR-012
// atomicity discipline as submitSellerApplication (one SECURITY INVOKER rpc).
export { resubmitSellerApplication } from "./actions/resubmitSellerApplication";
export type {
  ResubmitSellerApplicationInput,
  ResubmitSellerApplicationResult,
} from "@/validations/sellerOnboarding";
