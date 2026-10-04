/** Parent slug the publish trigger treats as food, including descendants (R-S10). */
export const FOOD_PARENT_SLUG = "food-beverages";

export interface CategoryRef {
  id: string;
  parent_id: string | null;
  slug: string;
}

/** True when any selected id is `food-beverages` or sits under it. */
export function selectionIncludesFood(rows: CategoryRef[], selectedIds: readonly string[]): boolean {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return selectedIds.some((id) => inFoodBranch(byId, id));
}

function inFoodBranch(byId: Map<string, CategoryRef>, id: string): boolean {
  const seen = new Set<string>();
  let current = byId.get(id);
  while (current && !seen.has(current.id)) {
    if (current.slug === FOOD_PARENT_SLUG) return true;
    seen.add(current.id);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return false;
}
