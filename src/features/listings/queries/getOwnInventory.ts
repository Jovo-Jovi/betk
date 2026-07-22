/**
 * getOwnInventory — the Stock & Inventory table (`/seller/inventory`, T05).
 * Phase 05 / T02 (FR-SEL-10).
 *
 * Own-store scope (session-pinned store id). Returns the caller's non-removed
 * listings with the stock fields the inventory page needs; low-stock is DERIVED
 * at render (`stock_qty <= low_stock_threshold`, OD-1 — no inventory_alerts
 * table). Soft-deleted / removed listings are excluded (they aren't inventory).
 * Services carry NULL stock (R-L09); made-to-order rows render "unlimited" — the
 * page decides the display, this query just returns the raw fields.
 */

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { OwnInventoryItem } from "../types";
import { resolveCallerStoreId, type ListingsClient } from "./_shared";

const INVENTORY_SELECT = `
  id, type, title_ar, title_en, status, stock_qty, low_stock_threshold,
  is_made_to_order,
  listing_images ( url, sort_order )
`;

interface RawInventoryRow {
  id: string;
  type: Database["betk"]["Enums"]["listing_type"];
  title_ar: string;
  title_en: string | null;
  status: Database["betk"]["Enums"]["listing_status"];
  stock_qty: number | null;
  low_stock_threshold: number;
  is_made_to_order: boolean;
  listing_images: { url: string; sort_order: number }[] | null;
}

function pickHero(images: { url: string; sort_order: number }[] | null): string | null {
  const list = images ?? [];
  if (list.length === 0) return null;
  const zero = list.find((i) => i.sort_order === 0);
  if (zero) return zero.url;
  return [...list].sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? null;
}

export async function getOwnInventory(client?: ListingsClient): Promise<OwnInventoryItem[]> {
  const supabase = client ?? (await createClient());

  const scope = await resolveCallerStoreId(supabase);
  if (!scope) return [];

  const { data, error } = await supabase
    .schema("betk")
    .from("listings")
    .select(INVENTORY_SELECT)
    .eq("store_id", scope.storeId)
    .neq("status", "removed")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`[listings] getOwnInventory failed: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as RawInventoryRow[];
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    titleAr: row.title_ar,
    titleEn: row.title_en,
    status: row.status,
    stockQty: row.stock_qty,
    lowStockThreshold: row.low_stock_threshold,
    isMadeToOrder: row.is_made_to_order,
    heroImageUrl: pickHero(row.listing_images),
  }));
}
