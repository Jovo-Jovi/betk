/**
 * Listings actions — shared write helpers. Phase 05 / T02. NOT server-only
 * (imported by the "use server" action files, which re-export only async fns).
 */

import type { ListingsClient } from "../queries/_shared";
import { listingRefusalCode, type ListingRefusalCode } from "../publishRefusal";

/** Shipping and prep columns. Omitted input leaves the stored value alone. */
export function catalogueWrite(p: {
  weightG?: number | null;
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  prepDays?: number | null;
}): {
  weight_g?: number | null;
  length_mm?: number | null;
  width_mm?: number | null;
  height_mm?: number | null;
  prep_days?: number | null;
} {
  const out: {
    weight_g?: number | null;
    length_mm?: number | null;
    width_mm?: number | null;
    height_mm?: number | null;
    prep_days?: number | null;
  } = {};
  if (p.weightG !== undefined) out.weight_g = p.weightG;
  if (p.lengthMm !== undefined) out.length_mm = p.lengthMm;
  if (p.widthMm !== undefined) out.width_mm = p.widthMm;
  if (p.heightMm !== undefined) out.height_mm = p.heightMm;
  if (p.prepDays !== undefined) out.prep_days = p.prepDays;
  return out;
}

/** Database refusal as a code, or a generic error. Never the Postgres sentence. */
export function refusalFromDb(
  message: string | undefined,
): { ok: false; reason: "refused"; code: ListingRefusalCode } | { ok: false; reason: "error" } {
  const code = listingRefusalCode(message);
  if (code) return { ok: false, reason: "refused", code };
  return { ok: false, reason: "error" };
}

/**
 * Full-replaces a listing's tags (delete-all + insert the new set). Used by
 * create (no existing rows) and update (replace). Tag uniqueness per listing is
 * DB-authoritative (uq_listing_tag); the Zod layer already de-dups + caps ≤5.
 * Runs under the caller's auth context — the listing_tags_seller (FOR ALL,
 * parent-store-scoped) RLS policy from T01 authorizes the writes.
 *
 * @returns the DB error message when a write failed, else null.
 */
export async function syncListingTags(
  supabase: ListingsClient,
  listingId: string,
  tags: string[],
): Promise<string | null> {
  const del = await supabase
    .schema("betk")
    .from("listing_tags")
    .delete()
    .eq("listing_id", listingId);
  if (del.error) return del.error.message;

  const unique = Array.from(new Set(tags.map((t) => t.trim()).filter((t) => t.length > 0)));
  if (unique.length === 0) return null;

  const ins = await supabase
    .schema("betk")
    .from("listing_tags")
    .insert(unique.map((tag) => ({ listing_id: listingId, tag })));
  return ins.error ? ins.error.message : null;
}
