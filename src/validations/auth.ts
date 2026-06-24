/**
 * Auth input schemas (Zod) — shared across the auth feature.
 *
 * Phase 02 / T01: `authIdentitySchema` validates the minimal identity that the
 * find-or-create primitive mirrors from a GoTrue `auth.users` session into
 * `betk.users`. T02 (phone login/verify) and T03 (OAuth callback) reuse this.
 *
 * Per ADR-010 (Model A): Supabase Auth (GoTrue) is canonical for OTP/OAuth and
 * sessions; `betk.users` is the find-or-create mirror keyed to `auth.users.id`.
 */

import { z } from "zod";

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
