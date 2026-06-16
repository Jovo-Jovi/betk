/**
 * Feature: auth
 * FR IDs:  FR-AUTH-1 (phone OTP sign-in), FR-AUTH-2 (Google OAuth), FR-AUTH-3 (verify + register)
 * UI Spec: §3 Auth flows (login, verify, register, blocked)
 * Tables:  betk.users, betk.otp_tokens, betk.sessions
 * OD-4:    phone_number nullable; Google OAuth additive; verified phone required before transacting.
 */

export {};
