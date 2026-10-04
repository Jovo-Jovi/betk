/**
 * Approved store categories for the caller's store. P31 and P32 pick
 * category_id from this set. An unapproved row is not a choice.
 */

import { createClient } from "@/lib/supabase/server";
import type { ApprovedStoreCategory } from "../types";
import { resolveCallerStoreId, type ListingsClient } from "./_shared";

interface RawCategory {
  id: string;
  name_ar: string;
  name_en: string | null;
  parent_id: string | null;
}

interface RawRow {
  categories: RawCategory | RawCategory[] | null;
}

export async function getOwnApprovedCategories(
  client?: ListingsClient,
): Promise<ApprovedStoreCategory[]> {
  const supabase = client ?? (await createClient());
  const scope = await resolveCallerStoreId(supabase);
  if (!scope) return [];

  const { data, error } = await supabase
    .schema("betk")
    .from("store_categories")
    .select("categories ( id, name_ar, name_en, parent_id )")
    .eq("store_id", scope.storeId)
    .not("approved_at", "is", null);

  if (error) {
    throw new Error(`[listings] getOwnApprovedCategories failed: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as RawRow[];
  const out: ApprovedStoreCategory[] = [];
  for (const row of rows) {
    const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    if (!category) continue;
    out.push({
      id: category.id,
      nameAr: category.name_ar,
      nameEn: category.name_en,
      parentId: category.parent_id,
    });
  }
  return out;
}
