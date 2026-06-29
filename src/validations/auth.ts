/**
 * Auth input schemas (Zod) — shared across the auth feature.
 *
 * Phase 02 / T01: `authIdentitySchema` validates the minimal identity that the
 * find-or-create primitive mirrors from a GoTrue `auth.users` session into
 * `betk.users`. T02 (phone login/verify) and T03 (OAuth callback) reuse this.
 *
 * Phase 02 / T02: `phoneInputSchema` validates + normalises Egyptian phone
 * numbers; `otpVerifySchema` validates the 6-digit code + phone forwarded from
 * the login page.
 *
 * Per ADR-010 (Model A): Supabase Auth (GoTrue) is canonical for OTP/OAuth and
 * sessions; `betk.users` is the find-or-create mirror keyed to `auth.users.id`.
 */

import { z } from "zod";

// ── Identity (T01 primitive) ────────────────────────────────────────────────

/** Mirrors betk.auth_provider ('phone' | 'google'). */
export const authProviderSchema = z.enum(["phone", "google"]);

/**
 * The identity the caller extracts from `supabase.auth.getUser()` after a
 * successful GoTrue sign-in, normalised for mirroring into `betk.users`.
 *
 * - `id`           — the GoTrue `auth.users.id` (UUID); becomes `betk.users.id` 1:1.
 * - `phoneNumber`  — E.164-ish digits from the phone identity, or NULL for Google.
 *                    `betk.users.phone_number` is VARCHAR(15), nullable + UNIQUE.
 * - `authProvider` — origin of the identity; sets `betk.users.auth_provider`.
 *
 * Structural validation only: the canonical Egyptian-format phone check lives at
 * the T02 login input boundary (GoTrue has already accepted the number by the
 * time we mirror it here).
 */
export const authIdentitySchema = z.object({
  id: z.string().uuid(),
  phoneNumber: z.string().trim().min(1).max(15).nullable(),
  authProvider: authProviderSchema,
});

export type AuthProviderInput = z.infer<typeof authProviderSchema>;
export type AuthIdentity = z.infer<typeof authIdentitySchema>;

// ── Phone-OTP login (T02) ───────────────────────────────────────────────────

/**
 * Accepts Egyptian phone numbers in two formats and normalises to E.164 (+20…):
 *
 *   Local format   : 01XXXXXXXXX  (11 digits, starts with 01)
 *   E.164 format   : +201XXXXXXXXX (13 chars, country code +20)
 *
 * Egyptian mobile operators (OD-4): Vodafone 010/011, Etisalat 011,
 * Orange 012, We 015. All start with 01X ⇒ local = exactly 11 digits `01[0-9]{9}`.
 *
 * Transformation: strip leading '0' from local, prepend '+20' → E.164 "+20XXXXXXXXXX".
 * GoTrue requires E.164 for signInWithOtp.
 */
const EGYPTIAN_LOCAL_RE = /^01[0-9]{9}$/;
const EGYPTIAN_E164_RE = /^\+201[0-9]{9}$/;

export const phoneInputSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1, { message: "رقم الهاتف مطلوب" })
    .transform((raw) => {
      // Strip spaces, dashes, parentheses that users commonly add.
      const cleaned = raw.replace(/[\s\-().]/g, "");

      if (EGYPTIAN_LOCAL_RE.test(cleaned)) {
        // Local: 01XXXXXXXXX → +201XXXXXXXXX (drop leading 0, prepend +20)
        return `+20${cleaned.slice(1)}`;
      }
      if (EGYPTIAN_E164_RE.test(cleaned)) {
        return cleaned;
      }

      // Return as-is so refinement below can produce the correct error.
      return cleaned;
    })
    .refine((normalized) => EGYPTIAN_E164_RE.test(normalized), {
      message: "رقم هاتف مصري غير صحيح. استخدم صيغة 01XXXXXXXXX أو +201XXXXXXXXX",
    }),
});

export type PhoneInput = z.infer<typeof phoneInputSchema>;

/**
 * OTP verification input: the normalised E.164 phone forwarded from the login
 * page, plus the 6-digit code the user entered.
 *
 * NEVER include the raw token in logs, errors, or DB writes.
 */
export const otpVerifySchema = z.object({
  phone: z.string().regex(EGYPTIAN_E164_RE, {
    message: "رقم الهاتف غير صحيح",
  }),
  token: z
    .string()
    .length(6, { message: "الكود يجب أن يكون 6 أرقام" })
    .regex(/^\d{6}$/, { message: "الكود يجب أن يحتوي على أرقام فقط" }),
});

export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;

// ── Google OAuth callback (T03) ─────────────────────────────────────────────

/**
 * Query params on the OAuth redirect back to `/auth/callback`.
 *
 * - `code`              — the PKCE authorization code, exchanged server-side for
 *                         a session. `null` when the provider returned an error
 *                         (consent denied) or the route was hit without a flow.
 * - `error`             — provider error slug (e.g. `access_denied`); present on
 *                         user-cancelled / failed consent.
 * - `error_description` — human-readable provider text. NEVER echoed back to the
 *                         client (info-leak / reflected-injection surface).
 * - `returnUrl`         — optional post-auth destination; sanitised separately by
 *                         `sanitizeReturnUrl` (open-redirect guard).
 *
 * SECURITY: this schema only structurally validates the redirect inputs. State /
 * PKCE verification is owned by Supabase Auth (`exchangeCodeForSession`); we do
 * NOT hand-roll it.
 */
export const oauthCallbackSchema = z.object({
  code: z.string().min(1).nullable(),
  error: z.string().min(1).nullable().optional(),
  error_description: z.string().nullable().optional(),
  returnUrl: z.string().nullable().optional(),
});

export type OAuthCallbackInput = z.infer<typeof oauthCallbackSchema>;
