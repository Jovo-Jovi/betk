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
 */
export const updateProfileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, { message: "الاسم الكامل مطلوب (حرفان على الأقل)" })
    .max(100, { message: "الاسم الكامل لا يتجاوز 100 حرف" }),
  governorate: z.enum(GOVERNORATE_VALUES as [string, ...string[]], {
    required_error: "المحافظة مطلوبة",
    invalid_type_error: "اختر محافظة صحيحة",
  }),
  city: z
    .string()
    .trim()
    .max(100, { message: "اسم المدينة لا يتجاوز 100 حرف" })
    .optional()
    .or(z.literal("")),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
