/**
 * GET /api/category-listings — PERF-02.
 *
 * Public, anon, read-only pagination data source for the `/category/[slug]`
 * page's in-place "load more" (the page itself is ISR-cached at revalidate 60
 * and renders page 1 only — it no longer reads `?cursor=`; forward pagination
 * moved here so the page stays statically cacheable). This handler is the ONE
 * dynamic piece of category browse.
 *
 * Contract:
 *  - Method: GET. Query: { category (uuid), cursor? (opaque keyset), locale? }.
 *  - Validates with `categoryListingsRequestSchema` BEFORE any DB call
 *    (CI check-zod-coverage). A malformed cursor → 400 (not a silent page-1
 *    fallback); a missing/invalid category → 400.
 *  - Runs `getActiveListings` through the STATELESS anon client
 *    (`createAnonClient`) — the exact same RLS-bound, R-S07-safe (`stores!inner`)
 *    query the page's own grid uses, so draft / soft-deleted / suspended-store
 *    listings are excluded here identically. NEVER the service-role client.
 *  - Returns the typed `ListingPage` ({ items, nextCursor }) as JSON, same
 *    shape + page size as T04. Rows carry raw bilingual fields; the client
 *    localizes with its own locale.
 *  - Not gated/localized by middleware (its matcher excludes `/api`), so there
 *    is no session dependency — a guest and an authed user get identical public
 *    data. No `cookies()`/`headers()` in this path.
 *
 * The middleware matcher excludes `/api`, so no auth cookies are read here.
 */

import { NextResponse } from "next/server";
import { getActiveListings } from "@/features/discovery";
import { createAnonClient } from "@/lib/supabase/anon";
import { categoryListingsRequestSchema } from "@/validations/discovery";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);

  const parsed = categoryListingsRequestSchema.safeParse({
    category: searchParams.get("category") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
    locale: searchParams.get("locale") ?? undefined,
  });

  if (!parsed.success) {
    // Malformed category or garbage cursor — reject loudly, do NOT degrade to
    // page 1 (that would mask a client bug + loop the first page forever).
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const page = await getActiveListings(
      { category: parsed.data.category, cursor: parsed.data.cursor },
      createAnonClient(),
    );
    return NextResponse.json(page);
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
