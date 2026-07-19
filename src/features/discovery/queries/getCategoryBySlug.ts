/**
 * getCategoryBySlug — category resolution for /category/[slug]. Phase 03 / T04
 * (FR-PUB-3, BETK_UI_SPEC.md §3 Category Browse).
 *
 * `categories WHERE slug AND is_active` (`cat_public` RLS). An inactive
 * category and an unknown slug BOTH resolve to `null` — the page 404s on
 * either, no existence leak (same convention as `getStoreBySlug`'s R-S07
 * handling for suspended vs. unknown stores).
 *
 * Also resolves:
 *  - up to one level of ACTIVE children (`parent_id = category.id`), ordered
 *    by `sort_order`, for the subcategory chips.
 *  - the category's ACTIVE parent (if `parent_id` is set), for the
 *    empty-state "back to parent" link. An inactive parent is treated as
 *    absent (never link to a category that would itself 404).
 *
 * Runs under the cookie/anon server client.
 */

import { createClient } from "@/lib/supabase/server";
import { categorySlugSchema } from "@/validations/discovery";
import type { CategoryDetail, CategorySummary } from "../types";
import type { DiscoveryClient } from "./_shared";

const CATEGORY_SELECT = "id, slug, name_ar, name_en, icon_url, parent_id";

interface RawCategoryRow {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
  icon_url: string | null;
  parent_id: string | null;
}

function mapCategoryRow(row: RawCategoryRow): CategorySummary {
  return {
    id: row.id,
    slug: row.slug,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    iconUrl: row.icon_url,
  };
}

/**
 * @param slug    category slug (from the `/category/[slug]` route param).
 * @param client  Supabase client override (integration tests inject a plain
 *                anon client; RSC callers omit this and get the cookie client).
 */
export async function getCategoryBySlug(
  slug: string,
  client?: DiscoveryClient,
): Promise<CategoryDetail | null> {
  const parsedSlug = categorySlugSchema.parse(slug);
  const supabase = client ?? (await createClient());
  const betk = supabase.schema("betk");

  const { data, error } = await betk
    .from("categories")
    .select(CATEGORY_SELECT)
    .eq("slug", parsedSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`[discovery] getCategoryBySlug failed: ${error.message}`);
  }
  if (!data) return null;

  const row = data as unknown as RawCategoryRow;

  const [childrenResult, parentResult] = await Promise.all([
    betk
      .from("categories")
      .select(CATEGORY_SELECT)
      .eq("parent_id", row.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    row.parent_id
      ? betk.from("categories").select(CATEGORY_SELECT).eq("id", row.parent_id).eq("is_active", true).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (childrenResult.error) {
    throw new Error(`[discovery] getCategoryBySlug (children) failed: ${childrenResult.error.message}`);
  }
  if (parentResult.error) {
    throw new Error(`[discovery] getCategoryBySlug (parent) failed: ${parentResult.error.message}`);
  }

  const children = ((childrenResult.data ?? []) as unknown as RawCategoryRow[]).map(mapCategoryRow);
  const parent = parentResult.data ? mapCategoryRow(parentResult.data as unknown as RawCategoryRow) : null;

  return { ...mapCategoryRow(row), parent, children };
}
