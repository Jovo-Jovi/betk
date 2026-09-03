/**
 * Address write-layer schema (Zod) — Phase 07 / T03 (checkout select-or-create).
 *
 * Minimal slice of `betk.addresses` needed for the CHECKOUT "select existing or
 * create new" flow (T03). This is NOT the full `/account/addresses` Address Book
 * CRUD (UI_SPEC §4.2, still unbuilt) — that page owns edit/delete/set-default;
 * this schema only covers CREATE, scoped to what checkout needs.
 *
 * Columns (BETK_DATABASE_SCHEMA.sql L165-175): label VARCHAR(50) nullable,
 * governorate VARCHAR(50) NOT NULL, city VARCHAR(100) NOT NULL, street_address
 * TEXT NOT NULL, building_notes TEXT nullable, is_default BOOLEAN DEFAULT false.
 * `is_default` is DELIBERATELY not exposed here — every address created via this
 * schema lands `is_default=false` (the DB default), so the "max one default"
 * invariant (UI_SPEC L189, app-layer) is trivially respected: this path never
 * sets a second default. The Address Book task owns the set-default affordance.
 *
 * NOTE (compose-time flag, not fixed here): the kit `AddressForm`'s `AddressValue`
 * carries `fullName`/`phone` fields with NO corresponding `addresses` column (the
 * table has no recipient name/phone — REG-14/communication-posture precedent puts
 * the buyer's name+phone on the SHIPPING LABEL via `buyer_profiles`/`users`, not
 * per-address). T03 composes `AddressForm` AS-IS (compose-only, no restyle) but
 * never forwards `fullName`/`phone` to this schema/the DB — there is no column to
 * receive them. Flagged for Claude Design / the Address Book task, not patched here.
 */

import { z } from "zod";
import { GOVERNORATE_VALUES } from "@/constants/governorates";

export const createAddressSchema = z.object({
  label: z.string().trim().max(50).optional(),
  governorate: z.enum(GOVERNORATE_VALUES as [string, ...string[]]),
  city: z.string().trim().min(1).max(100),
  streetAddress: z.string().trim().min(1),
  buildingNotes: z.string().trim().max(1000).optional(),
});
export type CreateAddressInput = z.input<typeof createAddressSchema>;

/**
 * createAddress outcomes (T03 routes each):
 *   ok              → addressId (select it as the checkout delivery address)
 *   unauthenticated  → /auth/login
 *   blocked          → /blocked (R-A05)
 *   invalid          → Zod
 */
export type CreateAddressResult =
  | { ok: true; addressId: string }
  | { ok: false; reason: "unauthenticated" | "blocked" | "invalid" | "error" };
