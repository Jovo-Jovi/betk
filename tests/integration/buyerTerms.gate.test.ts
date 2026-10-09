/**
 * AC-AGR-1 and REG-75 B — executed against staging.
 *
 * The Next.js action is not invoked here (no request context). The functions
 * the action and the sign-in redirect call are. Signup without `accepted`
 * writes no profile and no acceptance. A profile without a row for the
 * current buyer_terms version is sent to /auth/register, and buyerTermsBlock
 * refuses. Equality is the whole version string.
 */

import { randomUUID } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";
import { resolvePostAuthRedirect } from "@/services/authUsers";
import {
  BUYER_TERMS_DOCUMENT,
  buyerTermsBlock,
  completeBuyerSignup,
  readAgreementVersion,
  readAgreementVersionAsUser,
  readCurrentBuyerTerms,
} from "@/services/agreementVersions";

const HAS_CREDS =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !!process.env.SUPABASE_SERVICE_KEY;

const STAGING_ALLOWLIST = (process.env.RLS_ALLOW_PROJECT_REF ?? "sojmjvohiziapiwkzsjg")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function extractProjectRef(url: string): string {
  return new URL(url).hostname.split(".")[0] ?? "";
}

const RUN_ID = randomUUID().slice(0, 8);
const TEST_PASSWORD = `Betk_${RUN_ID}_T05!`;
const createdAuthIds: string[] = [];

function makeEmail(label: string) {
  return `betk-t05-${label}-${RUN_ID}@betk.test`;
}

type Service = ReturnType<typeof createServiceClient>;

async function createBuyerUser(service: Service, label: string) {
  const email = makeEmail(label);
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`[buyerTerms.gate] createUser failed (${label}): ${error?.message}`);
  }
  const uid = data.user.id;
  createdAuthIds.push(uid);
  const { error: insertErr } = await service.schema("betk").from("users").insert({
    id: uid,
    phone_number: null,
    auth_provider: "google" as const,
  });
  if (insertErr) {
    throw new Error(`[buyerTerms.gate] users seed failed (${label}): ${insertErr.message}`);
  }
  return { uid, email };
}

async function signInAsUser(email: string) {
  const client = createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { error } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (error) throw new Error(`[buyerTerms.gate] signIn failed: ${error.message}`);
  return client;
}

async function acceptanceRows(service: Service, userId: string) {
  const { data, error } = await service
    .schema("betk")
    .from("agreement_acceptances")
    .select("document, version_label, status, ip, user_agent")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function profileCount(service: Service, userId: string) {
  const { count, error } = await service
    .schema("betk")
    .from("buyer_profiles")
    .select("id", { count: "exact", head: true })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("P09 T05 — buyer terms gate (staging)", () => {
  let service: Service;

  beforeAll(() => {
    const ref = extractProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `[STAGING_GUARD] Refusing to run against project '${ref}'. ` +
          `Allowed: ${STAGING_ALLOWLIST.join(", ")}.`,
      );
    }
    service = createServiceClient();
  });

  afterAll(async () => {
    for (const id of createdAuthIds) {
      await service.schema("betk").from("agreement_acceptances").delete().eq("user_id", id);
      await service.schema("betk").from("buyer_profiles").delete().eq("id", id);
      await service.schema("betk").from("users").delete().eq("id", id);
      await service.auth.admin.deleteUser(id);
    }
  });

  it("reads the staging version labels and not a drafted body", async () => {
    const buyer = await readAgreementVersion("agreement_buyer_terms_version");
    const seller = await readAgreementVersion("agreement_seller_agreement_version");
    const returns = await readAgreementVersion("agreement_return_policy_version");
    const privacy = await readAgreementVersion("agreement_privacy_version");

    expect(buyer).toEqual({ ok: true, label: "STAGING-DRAFT-1" });
    expect(seller).toEqual({ ok: true, label: "STAGING-DRAFT-1" });
    // D-98-99 (2026-10-09): staging return_policy and privacy labels.
    expect(returns).toEqual({ ok: true, label: "STAGING-DRAFT-1" });
    expect(privacy).toEqual({ ok: true, label: "STAGING-DRAFT-1" });
  });

  it("AC-AGR-1: signup without acceptance writes no profile and no acceptance", async () => {
    const { uid, email } = await createBuyerUser(service, "refuse");
    const user = await signInAsUser(email);

    const result = await completeBuyerSignup(user, uid, {
      accepted: false,
      fullName: "T05 Refuse",
      governorate: "cairo",
      city: null,
    });

    expect(result).toEqual({ ok: false, code: "not_accepted" });
    expect(await profileCount(service, uid)).toBe(0);
    expect(await acceptanceRows(service, uid)).toEqual([]);
    expect(await buyerTermsBlock(user, uid)).toBe("required");
  });

  it("REG-75 B: a profile without the current version is sent to accept, then a matching row clears the gate", async () => {
    const { uid, email } = await createBuyerUser(service, "reaccept");
    const user = await signInAsUser(email);

    const { error: profileError } = await service.schema("betk").from("buyer_profiles").insert({
      id: uid,
      full_name: "T05 Existing",
      governorate: "cairo",
    });
    expect(profileError).toBeNull();

    const viaRpc = await readAgreementVersionAsUser(user, "agreement_buyer_terms_version");
    expect(viaRpc).toEqual({ ok: true, label: "STAGING-DRAFT-1" });

    expect(await readCurrentBuyerTerms(uid)).toMatchObject({
      configured: true,
      version: "STAGING-DRAFT-1",
      accepted: false,
    });
    expect(await resolvePostAuthRedirect(uid, "buyer", "/account")).toBe(
      "/auth/register?returnUrl=%2Faccount",
    );
    expect(await resolvePostAuthRedirect(uid, "admin", "/")).toBe(
      "/auth/register?returnUrl=%2Fadmin",
    );
    expect(await buyerTermsBlock(user, uid)).toBe("required");

    const untouched = await completeBuyerSignup(user, uid, {
      accepted: false,
      fullName: "T05 Existing",
      governorate: "cairo",
      city: null,
    });
    expect(untouched).toEqual({ ok: false, code: "not_accepted" });
    expect(await acceptanceRows(service, uid)).toEqual([]);
    expect(await profileCount(service, uid)).toBe(1);

    const { error: otherError } = await user.schema("betk").from("agreement_acceptances").insert({
      user_id: uid,
      document: BUYER_TERMS_DOCUMENT,
      version_label: "OTHER-VERSION",
    });
    expect(otherError).toBeNull();
    expect(await buyerTermsBlock(user, uid)).toBe("required");
    expect((await readCurrentBuyerTerms(uid)).accepted).toBe(false);

    const accepted = await completeBuyerSignup(user, uid, {
      accepted: true,
      fullName: "T05 Existing",
      governorate: "cairo",
      city: null,
    });
    expect(accepted).toEqual({ ok: true });

    const rows = await acceptanceRows(service, uid);
    const current = rows.find((row) => row.version_label === "STAGING-DRAFT-1");
    expect(current).toMatchObject({
      document: "buyer_terms",
      version_label: "STAGING-DRAFT-1",
      status: "accepted",
      ip: null,
      user_agent: null,
    });
    expect(rows.some((row) => row.version_label === "OTHER-VERSION")).toBe(true);
    expect(await buyerTermsBlock(user, uid)).toBeNull();
    expect((await readCurrentBuyerTerms(uid)).accepted).toBe(true);
    expect(await resolvePostAuthRedirect(uid, "buyer", "/account")).toBe("/account");
    expect(await resolvePostAuthRedirect(uid, "admin", "/")).toBe("/admin");
    expect(await profileCount(service, uid)).toBe(1);
  });
});
