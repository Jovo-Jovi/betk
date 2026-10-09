/**
 * P11 T02 — local-stack smoke (D-TEST, REG-119).
 *
 * Commits one order_status_history row on the throwaway stack and checks
 * a second request still sees it. no_delete_order_history stays enabled.
 * This test does not DELETE: PostgREST sends DELETE RETURNING, which
 * Postgres rejects on that INSTEAD NOTHING rule
 * (supabase/migrations/20260622082857_messaging_orders.sql).
 *
 * This file is not under tests/integration. Integration (staging) runs
 * `vitest run tests/integration` (.github/workflows/ci.yml) and does not
 * include it. The default Vitest include is *.test.ts / *.spec.ts, so the
 * unit job does not include it either.
 */

import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/types";
import {
  CI_TEST_VALUE,
  EXPECTED_HISTORY_ROWS,
  REHEARSAL_BUYER_ID,
  REHEARSAL_SELLER_ORDER_IDS,
} from "./expectedResidue";

const STAGING_REF = "sojmjvohiziapiwkzsjg";

function assertLocal(): { url: string; serviceKey: string } {
  if (process.env.BETK_LOCAL_STACK !== "1") {
    throw new Error("BETK_LOCAL_STACK is not 1");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    throw new Error("local API URL or service key is missing");
  }
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`refusing host ${host}`);
  }
  if (url.includes(STAGING_REF)) {
    throw new Error("refusing the staging project");
  }
  return { url, serviceKey };
}

describe("P11 T02 local stack order history", () => {
  it("commits one order_status_history row", async () => {
    const { url, serviceKey } = assertLocal();
    const orderId = REHEARSAL_SELLER_ORDER_IDS[0];
    if (!orderId) throw new Error("rehearsal seller order id is missing");

    const db = createClient<Database>(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }).schema("betk");

    const before = await db.from("order_status_history").select("id").limit(1000);
    if (before.error) throw new Error(before.error.message);
    expect(before.data?.length).toBe(EXPECTED_HISTORY_ROWS);

    const inserted = await db
      .from("order_status_history")
      .insert({
        order_id: orderId,
        from_status: "cancelled",
        to_status: "cancelled",
        changed_by: REHEARSAL_BUYER_ID,
        changed_by_type: "buyer",
        notes: CI_TEST_VALUE,
      })
      .select("id, notes")
      .single();
    if (inserted.error || !inserted.data) {
      throw new Error(inserted.error?.message ?? "insert returned no row");
    }
    const historyId = inserted.data.id;
    expect(inserted.data.notes).toBe(CI_TEST_VALUE);
    console.log(
      `order_status_history committed id=${historyId} order_id=${orderId} notes=${CI_TEST_VALUE}`,
    );

    const still = await db
      .from("order_status_history")
      .select("id, notes, order_id")
      .eq("id", historyId)
      .single();
    if (still.error || !still.data) {
      throw new Error(still.error?.message ?? "committed row was not readable");
    }
    expect(still.data).toEqual({
      id: historyId,
      notes: CI_TEST_VALUE,
      order_id: orderId,
    });

    const after = await db.from("order_status_history").select("id").limit(1000);
    if (after.error) throw new Error(after.error.message);
    expect(after.data?.length).toBe(EXPECTED_HISTORY_ROWS + 1);
  });
});
