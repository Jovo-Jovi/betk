/**
 * getCategoryTree — public category taxonomy. Phase 03 / T01 (FR-PUB-1/3, ERD §3).
 *
 * `categories WHERE is_active` (cat_public RLS), self-referential `parent_id`
 * assembled client-side into top-level nodes + nested `children`. Runs under
 * the cookie/anon server client.
 */

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { CategoryNode } from "../types";
import type { DiscoveryClient } from "./_shared";

type CategoryRow = Database["betk"]["Tables"]["categories"]["Row"];

export async function getCategoryTree(client?: DiscoveryClient): Promise<CategoryNode[]> {
  const supabase = client ?? (await createClient());

  const { data, error } = await supabase
    .schema("betk")
    .from("categories")
    .select("id, slug, name_ar, name_en, icon_url, parent_id, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`[discovery] getCategoryTree failed: ${error.message}`);
  }

  return assembleTree(data ?? []);
}

/** Assembles a flat active-category list into top-level nodes + nested children. */
function assembleTree(
  rows: Pick<
    CategoryRow,
    "id" | "slug" | "name_ar" | "name_en" | "icon_url" | "parent_id" | "sort_order"
  >[],
): CategoryNode[] {
  const nodesById = new Map<string, CategoryNode>();
  for (const row of rows) {
    nodesById.set(row.id, {
      id: row.id,
      slug: row.slug,
      nameAr: row.name_ar,
      nameEn: row.name_en,
      iconUrl: row.icon_url,
      sortOrder: row.sort_order,
      children: [],
    });
  }

  const topLevel: CategoryNode[] = [];
  for (const row of rows) {
    const node = nodesById.get(row.id)!;
    if (row.parent_id) {
      // Parent may be inactive (excluded from `rows`) — orphaned children
      // surface at top level rather than silently disappearing.
      const parent = nodesById.get(row.parent_id);
      if (parent) {
        parent.children.push(node);
        continue;
      }
    }
    topLevel.push(node);
  }

  return topLevel;
}
