/**
 * P09 T09. A guest add leaves zero cart_items (R-C01, AC-CART-1).
 * The call is the anon insert. Residue is the Q1 expected set before and after.
 * Active service listings are reported and not updated.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";
import { attemptGuestCartInsert } from "@/features/discovery/guestCart";
import {
  FIXTURE_EMAILS,
  residueCounts,
  residueProblems,
  type ResidueObservation,
} from "./expectedResidue";

const HAS_CREDS =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !!process.env.SUPABASE_SERVICE_KEY;

const STAGING_ALLOWLIST = (process.env.RLS_ALLOW_PROJECT_REF ?? "sojmjvohiziapiwkzsjg")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

function projectRef(url: string): string {
  return new URL(url).hostname.split(".")[0] ?? "";
}

type Service = SupabaseClient<Database>;

async function cartCount(service: Service): Promise<number> {
  const { count, error } = await service
    .schema("betk")
    .from("cart_items")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function observe(service: Service): Promise<ResidueObservation> {
  const db = service.schema("betk");
  const sellers = await db.from("seller_orders").select("id, master_order_id").limit(1000);
  if (sellers.error) throw new Error(sellers.error.message);
  const masters = await db.from("master_orders").select("id").limit(1000);
  if (masters.error) throw new Error(masters.error.message);
  const history = await db.from("order_status_history").select("order_id").limit(1000);
  if (history.error) throw new Error(history.error.message);
  const logs = await db.from("moderation_logs").select("id, admin_id").limit(1000);
  if (logs.error) throw new Error(logs.error.message);
  const acceptances = await db
    .from("agreement_acceptances")
    .select("user_id, document, version_label")
    .limit(1000);
  if (acceptances.error) throw new Error(acceptances.error.message);

  const emails: string[] = [];
  const fixtureUserIds: string[] = [];
  for (let page = 1; page <= 10; page++) {
    const listed = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (listed.error) throw new Error(listed.error.message);
    const users = listed.data?.users ?? [];
    for (const user of users) {
      if (!user.email?.endsWith("@betk.test")) continue;
      emails.push(user.email);
      if (FIXTURE_EMAILS.includes(user.email)) fixtureUserIds.push(user.id);
    }
    if (users.length < 200) break;
  }

  return {
    sellerOrders: (sellers.data ?? []).map((row) => ({
      id: row.id,
      masterOrderId: row.master_order_id,
    })),
    masterIds: (masters.data ?? []).map((row) => row.id),
    historyOrderIds: (history.data ?? []).map((row) => row.order_id),
    betkTestEmails: emails,
    fixtureUserIds,
    moderationLogs: (logs.data ?? []).map((row) => ({ id: row.id, adminId: row.admin_id })),
    acceptances: (acceptances.data ?? []).map((row) => ({
      userId: row.user_id,
      document: row.document,
      versionLabel: row.version_label,
    })),
  };
}

function assertQ1(observed: ResidueObservation, label: string): void {
  const problems = residueProblems(observed);
  console.log(`[t09 residue ${label}]`, residueCounts(observed));
  expect(problems, problems.join("\n")).toEqual([]);
}

const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("P09 T09 guest cart", () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const ref = url ? projectRef(url) : "";
  const allowed = STAGING_ALLOWLIST.includes(ref);

  let service: Service;
  let beforeCart = 0;

  beforeAll(() => {
    if (!allowed) return;
    service = createServiceClient();
  });

  afterAll(() => {
    // No fixture rows. Nothing to delete.
  });

  it("a guest insert leaves cart_items unchanged and reports active service listings", async () => {
    expect(allowed, `project ref ${ref} is not the staging allow-list`).toBe(true);

    const before = await observe(service);
    assertQ1(before, "before");
    beforeCart = await cartCount(service);
    console.log("[t09 cart_items before]", beforeCart);

    const services = await service
      .schema("betk")
      .from("listings")
      .select("id")
      .eq("type", "service")
      .eq("status", "active")
      .is("deleted_at", null);
    if (services.error) throw new Error(services.error.message);
    console.log(
      "[t09 active service listings]",
      (services.data ?? []).length,
      (services.data ?? []).map((row) => row.id).join(","),
    );

    const listing = await service
      .schema("betk")
      .from("listings")
      .select("id")
      .eq("status", "active")
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (listing.error) throw new Error(listing.error.message);
    expect(listing.data?.id).toBeTruthy();

    const anon = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const attempt = await attemptGuestCartInsert(anon, listing.data!.id);
    console.log("[t09 guest add]", JSON.stringify({ errorCode: attempt.errorCode, rowId: attempt.rowId }));
    expect(attempt.rowId).toBeNull();
    expect(attempt.errorCode).toBeTruthy();

    const afterCart = await cartCount(service);
    console.log("[t09 cart_items after]", afterCart);
    expect(afterCart).toBe(beforeCart);

    const after = await observe(service);
    assertQ1(after, "after");
  });
});
