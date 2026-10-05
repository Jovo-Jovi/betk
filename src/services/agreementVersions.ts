/**
 * Buyer-terms gate (Phase 09 T05).
 *
 * Lives under src/services because the public version read uses the service
 * client: anon cannot EXECUTE checkout_agreement_version. The allow-list is
 * the four agreement version keys and nothing else.
 *
 * One check for signup and the next sign-in (REG-75 B). A row counts only when
 * document is buyer_terms, status is accepted, and version_label equals the
 * current agreement_buyer_terms_version string (REG-96). An empty version
 * fails closed. This module never inserts a row unless the caller passes
 * accepted: true.
 *
 * ip and user_agent are optional on the ERD row and hold personal data.
 * R-G03 does not require them. They are left unwritten.
 */

import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * The cookie client and the test anon client do not share one schema generic.
 * Naming `SupabaseClient<Database>` here makes `tsc` report an infinitely
 * deep instantiation, so the schema handle is unknown and narrowed below.
 */
type Client = {
  schema(name: "betk"): unknown;
};

type BetkHandle = {
  rpc: (
    fn: "checkout_agreement_version",
    args: { p_key: string },
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  from: (relation: string) => {
    select: (columns: string) => Query;
    insert: (values: Record<string, unknown>) => PromiseLike<{
      error: { code?: string; message: string } | null;
    }>;
    upsert: (
      values: Record<string, unknown>,
      options: { onConflict: string },
    ) => PromiseLike<{ error: { message: string } | null }>;
  };
};

type Query = {
  eq: (column: string, value: string) => Query;
  maybeSingle: () => PromiseLike<{
    data: { id: string } | null;
    error: { message: string } | null;
  }>;
};

function betk(client: Client): BetkHandle {
  return client.schema("betk") as BetkHandle;
}

export const AGREEMENT_VERSION_KEYS = [
  "agreement_buyer_terms_version",
  "agreement_seller_agreement_version",
  "agreement_return_policy_version",
  "agreement_privacy_version",
] as const;

export type AgreementVersionKey = (typeof AGREEMENT_VERSION_KEYS)[number];

export const BUYER_TERMS_VERSION_KEY =
  "agreement_buyer_terms_version" as const satisfies AgreementVersionKey;

export const BUYER_TERMS_DOCUMENT = "buyer_terms" as const;

const PG_UNIQUE_VIOLATION = "23505";

/** A version label is usable only when it has a non-blank value. Compared later by equality. */
export function isConfiguredVersionLabel(
  value: string | null | undefined,
): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assertVersionKey(key: string): asserts key is AgreementVersionKey {
  if (!(AGREEMENT_VERSION_KEYS as readonly string[]).includes(key)) {
    throw new Error("[agreementVersions] version key is not on the allow-list");
  }
}

export type VersionRead = { ok: true; label: string } | { ok: false };

/**
 * Read one allow-listed agreement version. Guests cannot EXECUTE
 * checkout_agreement_version (revoked from anon), so the public pages and the
 * sign-in redirect use the service client for this key only.
 */
export async function readAgreementVersion(key: AgreementVersionKey): Promise<VersionRead> {
  assertVersionKey(key);
  const service = createServiceClient();
  const { data, error } = await service
    .schema("betk")
    .from("admin_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) return { ok: false };
  return { ok: true, label: data?.value ?? "" };
}

/** Same label, read through the authenticated RPC (the grant the buyer holds). */
export async function readAgreementVersionAsUser(
  client: Client,
  key: AgreementVersionKey,
): Promise<VersionRead> {
  assertVersionKey(key);
  const { data, error } = await betk(client).rpc("checkout_agreement_version", { p_key: key });

  if (error) return { ok: false };
  return { ok: true, label: typeof data === "string" ? data : "" };
}

export interface BuyerTermsStatus {
  configured: boolean;
  /** Raw label. Empty when the setting is blank or the read failed. */
  version: string;
  accepted: boolean;
}

/**
 * Whether userId has an accepted buyer_terms row for the current version.
 * A failed read is not accepted (fail closed).
 */
export async function readCurrentBuyerTerms(userId: string): Promise<BuyerTermsStatus> {
  const version = await readAgreementVersion(BUYER_TERMS_VERSION_KEY);
  if (!version.ok || !isConfiguredVersionLabel(version.label)) {
    return {
      configured: false,
      version: version.ok ? version.label : "",
      accepted: false,
    };
  }

  const service = createServiceClient();
  const { data, error } = await service
    .schema("betk")
    .from("agreement_acceptances")
    .select("id")
    .eq("user_id", userId)
    .eq("document", BUYER_TERMS_DOCUMENT)
    .eq("version_label", version.label)
    .eq("status", "accepted")
    .maybeSingle();

  if (error || !data) {
    return { configured: true, version: version.label, accepted: false };
  }
  return { configured: true, version: version.label, accepted: true };
}

/**
 * Buyer-action refusal. null means the current buyer_terms row is present.
 * Callers must return before any write when this is not null.
 */
export async function buyerTermsBlock(
  client: Client,
  userId: string,
): Promise<"unconfigured" | "required" | null> {
  const version = await readAgreementVersionAsUser(client, BUYER_TERMS_VERSION_KEY);
  if (!version.ok || !isConfiguredVersionLabel(version.label)) return "unconfigured";

  const { data, error } = await betk(client)
    .from("agreement_acceptances")
    .select("id")
    .eq("user_id", userId)
    .eq("document", BUYER_TERMS_DOCUMENT)
    .eq("version_label", version.label)
    .eq("status", "accepted")
    .maybeSingle();

  if (error || !data) return "required";
  return null;
}

export interface BuyerSignupInput {
  /** True only when this request's form said the user accepts. */
  accepted: boolean;
  fullName: string;
  governorate: string;
  city: string | null;
}

export type BuyerSignupResult =
  | { ok: true }
  | {
      ok: false;
      code: "not_accepted" | "unconfigured" | "acceptance_failed" | "profile_failed";
    };

/**
 * Finish signup. Inserts the buyer_terms row for the current version and then
 * the buyer profile. If accepted is false, or the version is blank, it writes
 * neither.
 */
export async function completeBuyerSignup(
  client: Client,
  userId: string,
  input: BuyerSignupInput,
): Promise<BuyerSignupResult> {
  if (!input.accepted) return { ok: false, code: "not_accepted" };

  const version = await readAgreementVersionAsUser(client, BUYER_TERMS_VERSION_KEY);
  if (!version.ok || !isConfiguredVersionLabel(version.label)) {
    return { ok: false, code: "unconfigured" };
  }

  const { error: acceptError } = await betk(client).from("agreement_acceptances").insert({
    user_id: userId,
    document: BUYER_TERMS_DOCUMENT,
    version_label: version.label,
  });

  if (acceptError && acceptError.code !== PG_UNIQUE_VIOLATION) {
    return { ok: false, code: "acceptance_failed" };
  }

  const city = input.city && input.city.trim() !== "" ? input.city.trim() : null;
  const { error: profileError } = await betk(client)
    .from("buyer_profiles")
    .upsert(
      {
        id: userId,
        full_name: input.fullName.trim(),
        governorate: input.governorate,
        ...(city !== null ? { city } : {}),
      },
      { onConflict: "id" },
    );

  if (profileError) return { ok: false, code: "profile_failed" };
  return { ok: true };
}
