/**
 * Feature: auth
 * FR IDs:  FR-AUTH-1 (phone OTP sign-in), FR-AUTH-2 (Google OAuth), FR-AUTH-3 (verify + register)
 * UI Spec: §3 Auth flows (login, verify, register, blocked)
 * Tables:  betk.users, betk.otp_tokens, betk.sessions
 * OD-4:    phone_number nullable; Google OAuth additive; verified phone required before transacting.
 * Model:   ADR-010 (GoTrue-canonical / Model A).
 */

// T01 find-or-create primitive — shared by phone (T02) and Google OAuth (T03).
export {
  findOrCreateUser,
  AuthUserError,
  UserDeactivatedError,
  UserNotActiveError,
  PhoneNumberTakenError,
} from "./queries/findOrCreateUser";
export { authIdentitySchema, authProviderSchema } from "@/validations/auth";
export type { AuthIdentity, AuthProviderInput } from "@/validations/auth";

// T07 verified-phone transaction gate — canonical gate consumed by
// checkout (Phase 07), become-seller (Phase 04), payout (Phase 13).
export {
  requireVerifiedPhone,
  requireVerifiedPhoneForUser,
  requireActiveUser,
  requireActiveUserForUser,
  NotAuthenticatedError,
  PhoneRequiredError,
} from "./queries/requireVerifiedPhone";
export type { VerifiedPhoneUser } from "./queries/requireVerifiedPhone";

// Phase 07 / T02b admin gate — consumed by confirmDepositPayment + /admin/* (T05).
export { requireAdmin, requireAdminForUser, NotAdminError } from "./queries/requireAdmin";

// T07 phone-capture flow — Server Actions for an authenticated phone-NULL user.
export { sendPhoneOtp } from "./actions/sendPhoneOtp";
export type { SendPhoneOtpResult } from "./actions/sendPhoneOtp";
export { verifyPhoneOtp } from "./actions/verifyPhoneOtp";
export type { VerifyPhoneOtpResult } from "./actions/verifyPhoneOtp";

// T02 Server Actions — phone OTP login + verify.
export { sendOtp } from "./actions/sendOtp";
export type { SendOtpResult } from "./actions/sendOtp";
export { verifyOtp } from "./actions/verifyOtp";
export type { VerifyOtpResult } from "./actions/verifyOtp";

// T04 Server Action — buyer profile completion.
export { completeProfile } from "./actions/completeProfile";
export type { CompleteProfileResult } from "./actions/completeProfile";
