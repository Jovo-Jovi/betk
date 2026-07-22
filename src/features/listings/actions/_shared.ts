/**
 * Listings actions — shared write helpers. Phase 05 / T02. NOT server-only
 * (imported by the "use server" action files, which re-export only async fns).
 */

import type { ListingsClient } from "../queries/_shared";

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
