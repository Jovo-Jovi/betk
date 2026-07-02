/**
 * Account / buyer-profile input schemas (Zod).
 *
 * Phase 02 / T05: `updateProfileSchema` validates the editable buyer_profiles
 * fields. ALL editable fields target `betk.buyer_profiles` only — confirmed
 * before writing the action. `betk.users` has no permissive UPDATE policy so
 * any write to a users column would be default-denied; we never attempt it.
 *
 * R-A06: phone_number is READ-ONLY — it is never included in this schema.
 */

import { z } from "zod";
import { GOVERNORATE_VALUES } from "@/constants/governorates";

/**
 * Editable buyer profile fields (all on betk.buyer_profiles).
 *
 * Column constraints (from BETK_DATABASE_SCHEMA.sql):
 *   full_name   VARCHAR(100) NOT NULL
 *   governorate VARCHAR(50)  NOT NULL
 *   city        VARCHAR(100) nullable
 *
 * NOTE — i18n (OD-7 / BL-02): `message` values are translation KEYS into the
 * `validation` namespace (messages/{ar,en}.json), NOT display strings. The
 * calling Server Action must translate via
 * `(await getTranslations("validation"))(issue.message)`.
 */
export const updateProfileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, { message: "fullNameRequired" })
    .max(100, { message: "fullNameTooLong" }),
  governorate: z.enum(GOVERNORATE_VALUES as [string, ...string[]], {
    required_error: "governorateRequired",
    invalid_type_error: "governorateInvalid",
  }),
  city: z
    .string()
    .trim()
    .max(100, { message: "cityTooLong" })
    .optional()
    .or(z.literal("")),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Account deactivation confirmation (OD-2, DEACTIVATE-only).
 *
 * Phase 02 / T06. The deactivate Server Action carries NO user data — it only
 * sets `betk.users.deleted_at = now()` for the live `auth.uid()`. The single
 * input is an explicit confirmation token so a deactivation can never fire
 * without the user deliberately confirming (defence-in-depth: enforced
 * server-side here, not only by the two-step UI). The literal value is sent by
 * the checked confirmation control in DeactivateAccountForm.
 */
export const deactivateAccountSchema = z.object({
  confirm: z.literal("DEACTIVATE", {
    errorMap: () => ({ message: "deactivateConfirmRequired" }),
  }),
});

export type DeactivateAccountInput = z.infer<typeof deactivateAccountSchema>;
