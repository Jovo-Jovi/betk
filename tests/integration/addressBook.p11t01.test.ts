/**
 * P11 T01 — address book writes on staging (FR-BUY-2, AC-BUY-2).
 *
 * One buyer, one sequence: create, set-default, delete. After every step at
 * most one is_default row exists. Deleting the default does not select
 * another. fullName and phone are rejected before a write.
 *
 * Cookie client is the signed-in buyer, so addr_self is the boundary.
 * Cleanup deletes the fixture. No order history. No DDL.
 */

import { randomUUID } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

const h = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => h.client,
}));
vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

import { createAddress } from "@/features/buyer-account/actions/createAddress";
import { deleteAddress } from "@/features/buyer-account/actions/deleteAddress";
import { setDefaultAddress } from "@/features/buyer-account/actions/setDefaultAddress";
import { updateAddress } from "@/features/buyer-account/actions/updateAddress";
import { getOwnAddresses } from "@/features/buyer-account/queries/getOwnAddresses";

const HAS_CREDS =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !!process.env.SUPABASE_SERVICE_KEY;

const STAGING_ALLOWLIST = (process.env.RLS_ALLOW_PROJECT_REF ?? "sojmjvohiziapiwkzsjg")
  .split(",")
  .map((part) => part.trim())
  .filter(Boolean);

function extractProjectRef(url: string): string {
  return new URL(url).hostname.split(".")[0] ?? "";
}

const RUN_ID = randomUUID().slice(0, 8);
const PASSWORD = `Betk_${RUN_ID}_P11T01!`;
const createdAuthIds: string[] = [];

function emailFor(label: string) {
  return `betk-p11t01-${label}-${RUN_ID}@betk.test`;
}

type Service = ReturnType<typeof createServiceClient>;

async function seedBuyer(service: Service, label: string) {
  const email = emailFor(label);
  const created = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(`createUser(${label}): ${created.error?.message}`);
  }
  const id = created.data.user.id;
  createdAuthIds.push(id);

  const users = await service.schema("betk").from("users").insert({
    id,
    phone_number: null,
    auth_provider: "google",
    role: "buyer",
    status: "active",
  });
  if (users.error) throw new Error(`users(${label}): ${users.error.message}`);

  const version = await service
    .schema("betk")
    .from("admin_settings")
    .select("value")
    .eq("key", "agreement_buyer_terms_version")
    .single();
  if (version.error || !version.data?.value) {
    throw new Error(`buyer terms version: ${version.error?.message}`);
  }
  const acceptance = await service.schema("betk").from("agreement_acceptances").insert({
    user_id: id,
    document: "buyer_terms",
    version_label: version.data.value,
  });
  if (acceptance.error) throw new Error(`acceptance(${label}): ${acceptance.error.message}`);

  const client = createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const signed = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signed.error) throw new Error(`signIn(${label}): ${signed.error.message}`);
  return { id, client };
}

async function defaultCount(service: Service, buyerId: string): Promise<number> {
  const rows = await service
    .schema("betk")
    .from("addresses")
    .select("is_default")
    .eq("buyer_id", buyerId);
  if (rows.error) throw new Error(rows.error.message);
  return (rows.data ?? []).filter((row) => row.is_default).length;
}

const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("P11 T01 address book", () => {
  let service: Service;
  let buyerId = "";
  let otherId = "";

  beforeAll(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ref = extractProjectRef(url);
    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `[STAGING_GUARD] Refusing to run address tests against project '${ref}'.`,
      );
    }
    service = createServiceClient();
    const buyer = await seedBuyer(service, "buyer");
    const other = await seedBuyer(service, "other");
    buyerId = buyer.id;
    otherId = other.id;
    h.client = buyer.client;
  });

  afterAll(async () => {
    if (!service) return;
    for (const id of createdAuthIds) {
      const addresses = await service.schema("betk").from("addresses").delete().eq("buyer_id", id);
      if (addresses.error) throw new Error(`cleanup addresses ${id}: ${addresses.error.message}`);
      const acceptances = await service
        .schema("betk")
        .from("agreement_acceptances")
        .delete()
        .eq("user_id", id);
      if (acceptances.error) throw new Error(`cleanup acceptances ${id}: ${acceptances.error.message}`);
      await service.schema("betk").from("buyer_profiles").delete().eq("id", id);
      const users = await service.schema("betk").from("users").delete().eq("id", id);
      if (users.error) throw new Error(`cleanup users ${id}: ${users.error.message}`);
      const auth = await service.auth.admin.deleteUser(id);
      if (auth.error) throw new Error(`cleanup auth ${id}: ${auth.error.message}`);
    }
  });

  async function expectAtMostOne() {
    expect(await defaultCount(service, buyerId)).toBeLessThanOrEqual(1);
    expect(await defaultCount(service, otherId)).toBeLessThanOrEqual(1);
  }

  it("keeps at most one default across create, set-default, and delete", async () => {
    const rejected = await createAddress({
      governorate: "cairo",
      city: "Maadi",
      streetAddress: "1 Nile",
      fullName: "Nour",
      phone: "+201000000000",
    } as never);
    expect(rejected).toEqual({ ok: false, reason: "invalid" });
    expect(await defaultCount(service, buyerId)).toBe(0);

    const signedBuyer = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const back = await signedBuyer.auth.signInWithPassword({
      email: emailFor("buyer"),
      password: PASSWORD,
    });
    if (back.error) throw new Error(back.error.message);
    h.client = signedBuyer;

    const first = await createAddress({
      label: "Home",
      governorate: "cairo",
      city: "Maadi",
      streetAddress: "12 Nile",
      buildingNotes: "floor 1",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(await defaultCount(service, buyerId)).toBe(1);
    await expectAtMostOne();

    const second = await createAddress({
      label: "Work",
      governorate: "giza",
      city: "Dokki",
      streetAddress: "4 Tahrir",
      makeDefault: false,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(await defaultCount(service, buyerId)).toBe(1);

    const listed = await getOwnAddresses(signedBuyer);
    expect(listed.map((row) => row.id)[0]).toBe(first.addressId);
    expect(listed.find((row) => row.id === first.addressId)?.isDefault).toBe(true);
    expect(listed.find((row) => row.id === second.addressId)?.isDefault).toBe(false);

    const flipped = await setDefaultAddress({ id: second.addressId });
    expect(flipped).toEqual({ ok: true });
    expect(await defaultCount(service, buyerId)).toBe(1);
    const afterFlip = await getOwnAddresses(signedBuyer);
    expect(afterFlip[0]?.id).toBe(second.addressId);
    expect(afterFlip.find((row) => row.id === first.addressId)?.isDefault).toBe(false);

    const edited = await updateAddress({
      id: first.addressId,
      governorate: "cairo",
      city: "Maadi",
      streetAddress: "12 Nile updated",
      makeDefault: false,
    });
    expect(edited).toEqual({ ok: true });
    expect(await defaultCount(service, buyerId)).toBe(1);

    const removedDefault = await deleteAddress({ id: second.addressId });
    expect(removedDefault).toEqual({ ok: true });
    expect(await defaultCount(service, buyerId)).toBe(0);
    const afterDelete = await getOwnAddresses(signedBuyer);
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0]?.isDefault).toBe(false);
    expect(afterDelete[0]?.streetAddress).toBe("12 Nile updated");

    const otherClient = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const otherSign = await otherClient.auth.signInWithPassword({
      email: emailFor("other"),
      password: PASSWORD,
    });
    if (otherSign.error) throw new Error(otherSign.error.message);
    h.client = otherClient;
    expect(await setDefaultAddress({ id: first.addressId })).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await defaultCount(service, buyerId)).toBe(0);

    h.client = signedBuyer;
    expect(await setDefaultAddress({ id: first.addressId })).toEqual({ ok: true });
    expect(await defaultCount(service, buyerId)).toBe(1);

    expect(await deleteAddress({ id: first.addressId })).toEqual({ ok: true });
    expect(await defaultCount(service, buyerId)).toBe(0);
    expect(await getOwnAddresses(signedBuyer)).toEqual([]);
  });
});
