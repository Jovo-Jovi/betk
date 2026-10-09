/**
 * Address book schemas (P10, FR-BUY-2).
 *
 * Columns: label VARCHAR(50) nullable, governorate VARCHAR(50), city
 * VARCHAR(100), street_address TEXT, building_notes TEXT nullable,
 * is_default BOOLEAN NOT NULL DEFAULT false
 * (`supabase/migrations/20260622082812_user_seller_store.sql` lines 26–36).
 * There is no unique constraint on is_default. The only address index is
 * `idx_addresses_buyer` (`supabase/migrations/20260622083052_indexes.sql`
 * line 19). The set-default action keeps a single default. This schema does
 * not accept `fullName` or `phone`: `addresses` has no such columns, and
 * `.strict()` rejects them before any database call.
 */

import { z } from "zod";
import { GOVERNORATE_VALUES } from "@/constants/governorates";

const addressFields = {
  label: z.string().trim().max(50).optional(),
  governorate: z.enum(GOVERNORATE_VALUES),
  city: z.string().trim().min(1).max(100),
  streetAddress: z.string().trim().min(1),
  buildingNotes: z.string().trim().max(1000).optional(),
  makeDefault: z.boolean().optional(),
};

export const createAddressSchema = z.object(addressFields).strict();
export type CreateAddressInput = z.input<typeof createAddressSchema>;

export const updateAddressSchema = z
  .object({
    id: z.string().uuid(),
    ...addressFields,
  })
  .strict();
export type UpdateAddressInput = z.input<typeof updateAddressSchema>;

export const addressIdSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();
export type AddressIdInput = z.input<typeof addressIdSchema>;

export type AddressWriteReason =
  | "unauthenticated"
  | "blocked"
  | "invalid"
  | "not_found"
  | "in_use"
  | "error";

export type CreateAddressResult =
  | { ok: true; addressId: string }
  | { ok: false; reason: AddressWriteReason };

export type AddressMutationResult =
  | { ok: true }
  | { ok: false; reason: AddressWriteReason };
