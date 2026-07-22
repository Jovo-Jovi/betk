/**
 * THROWAWAY DEV HARNESS — not part of the app, not for CI, do not import from
 * app code. Promotes an EXISTING staging user (already signed in once via
 * Google OAuth, so their auth.users row exists) to a given role, for manual
 * website testing. Service-role, idempotent, STAGING-only.
 *
 * Usage:
 *   pnpm exec tsx scripts/dev/set-test-role.ts <email> <buyer|seller|admin> [--phone 01001124312] [--reset]
 *
 * Examples:
 *   pnpm exec tsx scripts/dev/set-test-role.ts jiovanny.adel@gmail.com seller --phone 01001124312
 *   pnpm exec tsx scripts/dev/set-test-role.ts jiovanny.adel@gmail.com buyer --reset
 *
 * Behaviour (see the inline sections below for the full contract):
 *   1. auth.users lookup by email (admin API — paginated, GoTrue has no
 *      email filter on listUsers in this SDK version). Not found → exit with
 *      a hint to sign in once via Google OAuth on staging first.
 *   2. betk.users mirror row: find-or-create by id (same shape as
 *      `findOrCreateUser` / `insertUserRow`).
 *   3. --phone: normalised via the EXISTING `phoneInputSchema`, written via
 *      the same column-scoped UPDATE + 23505 catch as the EXISTING
 *      `setUserPhoneNumber` service helper, then mirrored onto auth.users via
 *      the admin API so GoTrue and betk.users agree.
 *   4. Always: status='active', deleted_at=NULL.
 *   5. role=seller: users.role='seller' + active seller_profiles + an ACTIVE
 *      stores row (unique slug, ≥1 payment method for the R-S09 publish gate).
 *   6. role=admin: users.role='admin' only.
 *   7. role=buyer / --reset: users.role='buyer'; seller rows are flipped to
 *      'pending' (reversible), never deleted.
 *   8. Prints a summary table of every field actually changed. No keys/tokens
 *      are ever printed.
 *
 * WHY this doesn't import `@/configs/env`, `@/lib/supabase/service`, or
 * `@/services/authUsers`: all three (transitively) `import "server-only"`,
 * which is aliased by Next's own bundler but is NOT an installed npm package
 * in this repo — running under plain `tsx`/node (no bundler) throws
 * `Cannot find module 'server-only'`. This is the same reason
 * `send-otp-test.ts` builds its own client instead of importing those files.
 * Per the task's own fallback clause, this script reuses what IS safely
 * importable (`phoneInputSchema`, `hasPaymentMethod`, `storeSlugInputSchema`,
 * the `Database` type — none of these import "server-only") and re-implements
 * the find-or-create-by-id / setUserPhoneNumber logic inline, byte-for-byte
 * matching the column scoping + 23505 handling of the originals.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { z } from "zod";
import { createClient, type User } from "@supabase/supabase-js";
import { phoneInputSchema } from "@/validations/auth";
import { storeSlugInputSchema } from "@/validations/sellerOnboarding";
import { hasPaymentMethod } from "@/features/listings/listingRules";
import type { Database } from "@/lib/supabase/types";
import type { StorePaymentMethods } from "@/types/jsonb";

type UsersRow = Database["betk"]["Tables"]["users"]["Row"];
type SellerProfilesRow = Database["betk"]["Tables"]["seller_profiles"]["Row"];
type StoresRow = Database["betk"]["Tables"]["stores"]["Row"];
type UserRole = Database["betk"]["Enums"]["user_role"];

const PG_UNIQUE_VIOLATION = "23505";

// ── 1. Load .env.local into process.env ─────────────────────────────────────
// Same parser as send-otp-test.ts / tests/setup/env.ts: never override a var
// already set in the shell; strip optional surrounding quotes.
const repoRoot = resolve(dirname(process.argv[1]!), "..", "..");

try {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    const key = match[1]!;
    let value = match[2]!;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
} catch {
  console.error("[set-test-role] Cannot read .env.local — aborting.");
  process.exit(1);
}

// ── 2. Zod-validate the required env vars (never printed) ──────────────────
// Same var names/shape as `serverEnv`/`clientEnv` (@/configs/env) — that
// module just isn't importable here (see the file header).
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
});

const envResult = envSchema.safeParse(process.env);
if (!envResult.success) {
  const missing = envResult.error.issues.map((i) => i.path.join(".")).join(", ");
  console.error(`[set-test-role] Missing or invalid env vars: ${missing}`);
  process.exit(1);
}
const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY } = envResult.data;

// ── 3. STAGING_GUARD ─────────────────────────────────────────────────────────
// Refuse to run against any project other than the known staging ref.
// Same allow-list pattern as tests/integration/rls.smoke.test.ts.
const STAGING_ALLOWLIST = (
  process.env.SET_TEST_ROLE_ALLOW_PROJECT_REF ?? "sojmjvohiziapiwkzsjg"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const detectedRef = new URL(NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0] ?? "";

if (!STAGING_ALLOWLIST.includes(detectedRef)) {
  console.error(
    `[set-test-role] STAGING_GUARD blocked: detected project "${detectedRef}", ` +
      `only [${STAGING_ALLOWLIST.join(", ")}] permitted. ` +
      `Set SET_TEST_ROLE_ALLOW_PROJECT_REF to override (NEVER point this at production).`,
  );
  process.exit(1);
}

// ── 4. Parse + validate CLI args ────────────────────────────────────────────
function printUsage(): void {
  console.error(
    "Usage:   pnpm exec tsx scripts/dev/set-test-role.ts <email> <buyer|seller|admin> [--phone 01001124312] [--reset]\n" +
      "Example: pnpm exec tsx scripts/dev/set-test-role.ts jiovanny.adel@gmail.com seller --phone 01001124312",
  );
}

const rawArgs = process.argv.slice(2);
const positional = rawArgs.filter((a) => !a.startsWith("--"));
const resetFlag = rawArgs.includes("--reset");
const phoneFlagIdx = rawArgs.indexOf("--phone");
const rawPhone =
  phoneFlagIdx !== -1 ? rawArgs[phoneFlagIdx + 1] : undefined;

const cliSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(["buyer", "seller", "admin"]),
});

const cliResult = cliSchema.safeParse({
  email: positional[0],
  role: positional[1],
});

if (!cliResult.success) {
  console.error("[set-test-role] Invalid arguments.");
  printUsage();
  process.exit(1);
}
const { email, role } = cliResult.data;

let normalizedPhone: string | undefined;
if (rawPhone !== undefined) {
  const phoneResult = phoneInputSchema.safeParse({ phone: rawPhone });
  if (!phoneResult.success) {
    const msg = phoneResult.error.issues.map((i) => i.message).join("; ");
    console.error(`[set-test-role] --phone validation failed: ${msg}`);
    process.exit(1);
  }
  normalizedPhone = phoneResult.data.phone;
} else if (phoneFlagIdx !== -1) {
  console.error("[set-test-role] --phone was given without a value.");
  printUsage();
  process.exit(1);
}

// ── 5. Service-role client (bypasses RLS — matches @/lib/supabase/service's
//       shape; this file just can't literally import that module — see header) ─
const service = createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const db = () => service.schema("betk");

// ── Change tracking (printed as one summary table; never logs keys/tokens) ──
interface ChangeRow {
  table: string;
  field: string;
  from: string;
  to: string;
}
const changes: ChangeRow[] = [];
const notes: string[] = [];

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

function recordChange(table: string, field: string, from: unknown, to: unknown): void {
  const f = fmt(from);
  const t = fmt(to);
  if (f === t) return; // idempotent no-op — nothing to report
  changes.push({ table, field, from: f, to: t });
}

/**
 * auth.users lookup by email — paginated `listUsers` (this SDK's admin API
 * has no email filter; mirrors the paging pattern in
 * tests/integration/rls.smoke.test.ts's `sweepLeftovers`).
 */
async function findAuthUserByEmail(targetEmail: string): Promise<User | null> {
  const wanted = targetEmail.toLowerCase();
  const MAX_PAGES = 50; // 50 * 200 = 10,000 users — generous for staging
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      throw new Error(`[set-test-role] listUsers failed: ${error.message}`);
    }
    const match = data.users.find((u) => u.email?.toLowerCase() === wanted);
    if (match) return match;
    if (data.users.length < 200) break; // last page
  }
  return null;
}

/**
 * betk.users find-or-create-by-id — mirrors `findOrCreateUser` +
 * `insertUserRow` (@/features/auth/queries/findOrCreateUser,
 * @/services/authUsers): select by id; on miss, INSERT {id, phone_number,
 * auth_provider} and let role/status take their DB defaults ('buyer'/'active').
 * An id-race (23505 on a concurrent insert) re-reads the winner.
 */
async function ensureUsersRow(authUser: User): Promise<UsersRow> {
  const { data: existing, error: selErr } = await db()
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();
  if (selErr) {
    throw new Error(`[set-test-role] betk.users select failed: ${selErr.message}`);
  }
  if (existing) return existing;

  const provider: Database["betk"]["Enums"]["auth_provider"] =
    authUser.app_metadata?.provider === "phone" ? "phone" : "google";

  const { data: inserted, error: insErr } = await db()
    .from("users")
    .insert({ id: authUser.id, phone_number: null, auth_provider: provider })
    .select("*")
    .single();

  if (insErr) {
    if (insErr.code === PG_UNIQUE_VIOLATION) {
      const { data: winner } = await db()
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();
      if (winner) return winner;
    }
    throw new Error(`[set-test-role] betk.users insert failed: ${insErr.message}`);
  }
  notes.push("betk.users mirror row created (find-or-create, first sighting).");
  return inserted;
}

/**
 * Phone write — mirrors `setUserPhoneNumber` (@/services/authUsers) exactly:
 * a single-column UPDATE on `phone_number` only, with the `uq_users_phone`
 * 23505 caught and returned as a clean conflict (never thrown).
 */
async function writePhoneNumber(
  userId: string,
  phone: string,
): Promise<{ ok: true } | { conflict: "phone_taken" }> {
  const { error } = await db().from("users").update({ phone_number: phone }).eq("id", userId);
  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) return { conflict: "phone_taken" };
    throw new Error(`[set-test-role] phone_number update failed: ${error.message}`);
  }
  return { ok: true };
}

/** URL-safe slug from the email local-part, validated via storeSlugInputSchema. */
function slugFromEmail(targetEmail: string, fallbackSuffix: string): string {
  const localPart = targetEmail.split("@")[0] ?? "seller";
  let candidate = localPart
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (candidate.length < 3) candidate = `store-${candidate}`;
  candidate = candidate.slice(0, 50);
  const parsed = storeSlugInputSchema.safeParse(candidate);
  return parsed.success ? parsed.data : `seller-${fallbackSuffix}`;
}

async function main(): Promise<void> {
  // ── Step 1: auth.users lookup ──────────────────────────────────────────
  const authUser = await findAuthUserByEmail(email);
  if (!authUser) {
    console.error(
      `[set-test-role] No auth.users row found for "${email}" on staging (${detectedRef}).\n` +
        "Hint: sign in once via Google OAuth on staging first (/auth/login), then re-run this script.",
    );
    process.exit(1);
  }
  const userId = authUser.id;

  // ── Step 2: betk.users mirror (find-or-create-by-id) ───────────────────
  let usersRow = await ensureUsersRow(authUser);

  // ── Step 3: --phone (normalise → write mirror → mirror onto auth.users) ─
  let finalPhoneNumber = usersRow.phone_number;
  if (normalizedPhone !== undefined) {
    const beforePhone = usersRow.phone_number;
    const result = await writePhoneNumber(userId, normalizedPhone);
    if ("conflict" in result) {
      notes.push(
        `phone_taken: "${normalizedPhone}" already belongs to a DIFFERENT account — ` +
          "betk.users.phone_number was NOT changed.",
      );
    } else {
      recordChange("betk.users", "phone_number", beforePhone, normalizedPhone);
      finalPhoneNumber = normalizedPhone;

      // Mirror onto auth.users so GoTrue and betk.users agree (best-effort —
      // the mirror write above already succeeded and is the source of truth
      // this script cares about; warn rather than fail on a GoTrue hiccup).
      const { error: authUpdErr } = await service.auth.admin.updateUserById(userId, {
        phone: normalizedPhone,
        phone_confirm: true,
      });
      if (authUpdErr) {
        notes.push(
          `WARNING: auth.users phone mirror failed (${authUpdErr.name}, status ${authUpdErr.status ?? "?"}` +
            `${authUpdErr.message ? `: ${authUpdErr.message}` : ""}) — ` +
            "betk.users.phone_number is set (mirror + write-path unaffected), but GoTrue's own " +
            "phone field is not. This is a known staging finding (admin.updateUserById with a " +
            "phone field 500s on this project — likely an auth-provider/SMS config gap, not a " +
            "bug in this script); OTP-based phone flows are unaffected.",
        );
      } else {
        recordChange("auth.users", "phone", authUser.phone ?? null, normalizedPhone);
        recordChange("auth.users", "phone_confirmed_at", authUser.phone_confirmed_at ?? null, "now()");
      }
    }
  }

  // ── Step 4: always — status='active', deleted_at=NULL ───────────────────
  {
    const beforeStatus = usersRow.status;
    const beforeDeletedAt = usersRow.deleted_at;
    const { error } = await db()
      .from("users")
      .update({ status: "active", deleted_at: null })
      .eq("id", userId);
    if (error) {
      throw new Error(`[set-test-role] users status/deleted_at update failed: ${error.message}`);
    }
    recordChange("betk.users", "status", beforeStatus, "active");
    recordChange("betk.users", "deleted_at", beforeDeletedAt, null);
  }

  // ── Step 5/6/7: role branch ──────────────────────────────────────────────
  const effectiveRole: "buyer" | "seller" | "admin" =
    resetFlag ? "buyer" : role;

  if (effectiveRole === "admin") {
    const beforeRole = usersRow.role;
    const { error } = await db().from("users").update({ role: "admin" }).eq("id", userId);
    if (error) throw new Error(`[set-test-role] role update failed: ${error.message}`);
    recordChange("betk.users", "role", beforeRole, "admin" satisfies UserRole);
  } else if (effectiveRole === "seller") {
    const beforeRole = usersRow.role;
    const { error: roleErr } = await db().from("users").update({ role: "seller" }).eq("id", userId);
    if (roleErr) throw new Error(`[set-test-role] role update failed: ${roleErr.message}`);
    recordChange("betk.users", "role", beforeRole, "seller" satisfies UserRole);

    // -- seller_profiles: ensure exists + active (idempotent, never duplicated)
    const { data: existingProfile, error: spSelErr } = await db()
      .from("seller_profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (spSelErr) throw new Error(`[set-test-role] seller_profiles select failed: ${spSelErr.message}`);

    let sellerProfile: SellerProfilesRow;
    if (!existingProfile) {
      const { data: created, error: spInsErr } = await db()
        .from("seller_profiles")
        .insert({ id: userId, status: "active" })
        .select("*")
        .single();
      if (spInsErr) throw new Error(`[set-test-role] seller_profiles insert failed: ${spInsErr.message}`);
      sellerProfile = created;
      recordChange("betk.seller_profiles", "status", null, "active");
    } else {
      if (existingProfile.status !== "active") {
        const { error: spUpdErr } = await db()
          .from("seller_profiles")
          .update({ status: "active" })
          .eq("id", userId);
        if (spUpdErr) throw new Error(`[set-test-role] seller_profiles update failed: ${spUpdErr.message}`);
        recordChange("betk.seller_profiles", "status", existingProfile.status, "active");
      }
      sellerProfile = existingProfile;
    }
    void sellerProfile;

    // -- stores: ensure exists + active, ≥1 payment method (R-S09). Note:
    //    stores.status does NOT auto-mirror seller_profiles.status (T08
    //    finding) — set BOTH explicitly.
    const { data: existingStore, error: stSelErr } = await db()
      .from("stores")
      .select("*")
      .eq("seller_id", userId)
      .maybeSingle();
    if (stSelErr) throw new Error(`[set-test-role] stores select failed: ${stSelErr.message}`);

    if (!existingStore) {
      const localPart = email.split("@")[0] ?? "seller";
      let slug = slugFromEmail(email, userId.slice(0, 8));
      // `satisfies` (not `: StorePaymentMethods`) keeps the inferred object-literal
      // type — annotating with the interface directly trips "index signature is
      // missing" against the generated `Json` column type.
      const defaultPaymentMethods = { cod_enabled: true } satisfies StorePaymentMethods;

      let created: StoresRow | null = null;
      for (let attempt = 0; attempt < 3 && !created; attempt++) {
        const { data, error: stInsErr } = await db()
          .from("stores")
          .insert({
            seller_id: userId,
            name_ar: `متجر اختبار (${localPart})`,
            name_en: `Test Store (${localPart})`,
            slug,
            category_primary: "general",
            governorate: "cairo",
            payment_methods: defaultPaymentMethods,
            status: "active",
          })
          .select("*")
          .single();
        if (!stInsErr) {
          created = data;
          break;
        }
        if (stInsErr.code === PG_UNIQUE_VIOLATION) {
          // Slug collision (uq_stores_slug) — retry with a short suffix.
          slug = `${slug.slice(0, 42)}-${userId.slice(0, 6)}`;
          continue;
        }
        throw new Error(`[set-test-role] stores insert failed: ${stInsErr.message}`);
      }
      if (!created) {
        throw new Error("[set-test-role] stores insert failed after slug-collision retries.");
      }
      recordChange("betk.stores", "row", null, `created (slug="${created.slug}")`);
      recordChange("betk.stores", "status", null, "active");
      recordChange("betk.stores", "payment_methods", null, "cod_enabled=true");
    } else {
      if (existingStore.status !== "active") {
        const { error: stUpdErr } = await db()
          .from("stores")
          .update({ status: "active" })
          .eq("id", existingStore.id);
        if (stUpdErr) throw new Error(`[set-test-role] stores update failed: ${stUpdErr.message}`);
        recordChange("betk.stores", "status", existingStore.status, "active");
      }
      const currentPm = existingStore.payment_methods as StorePaymentMethods | null;
      if (!hasPaymentMethod(currentPm)) {
        const mergedPm = { ...(currentPm ?? {}), cod_enabled: true } satisfies StorePaymentMethods;
        const { error: pmUpdErr } = await db()
          .from("stores")
          .update({ payment_methods: mergedPm })
          .eq("id", existingStore.id);
        if (pmUpdErr) throw new Error(`[set-test-role] stores payment_methods update failed: ${pmUpdErr.message}`);
        recordChange("betk.stores", "payment_methods", "(none)", "cod_enabled=true");
      }
    }
  } else {
    // effectiveRole === "buyer" (either role='buyer' was requested, or --reset)
    const beforeRole = usersRow.role;
    const { error: roleErr } = await db().from("users").update({ role: "buyer" }).eq("id", userId);
    if (roleErr) throw new Error(`[set-test-role] role update failed: ${roleErr.message}`);
    recordChange("betk.users", "role", beforeRole, "buyer" satisfies UserRole);

    // Do NOT delete seller rows — flip them to 'pending' (reversible).
    const { data: existingProfile } = await db()
      .from("seller_profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (existingProfile && existingProfile.status !== "pending") {
      const { error } = await db()
        .from("seller_profiles")
        .update({ status: "pending" })
        .eq("id", userId);
      if (error) throw new Error(`[set-test-role] seller_profiles reset failed: ${error.message}`);
      recordChange("betk.seller_profiles", "status", existingProfile.status, "pending");
      notes.push("seller_profiles flipped to 'pending' (reversible) — row NOT deleted.");
    }

    const { data: existingStore } = await db()
      .from("stores")
      .select("*")
      .eq("seller_id", userId)
      .maybeSingle();
    if (existingStore && existingStore.status !== "pending") {
      const { error } = await db()
        .from("stores")
        .update({ status: "pending" })
        .eq("id", existingStore.id);
      if (error) throw new Error(`[set-test-role] stores reset failed: ${error.message}`);
      recordChange("betk.stores", "status", existingStore.status, "pending");
      notes.push(
        "stores flipped to 'pending' (reversible) — row NOT deleted. " +
          "(stores.status does not auto-mirror seller_profiles.status — set explicitly.)",
      );
    }
  }

  // ── OD-4 warning: transacting/selling requires a phone (never fails) ────
  if (effectiveRole !== "admin" && !finalPhoneNumber) {
    console.warn(
      `[set-test-role] WARNING: "${email}" has role='${effectiveRole}' but NO phone set. ` +
        "The OD-4 verified-phone RLS gate will block transacting/selling until a phone is added " +
        "(re-run with --phone 010XXXXXXXX).",
    );
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n[set-test-role] ${email} → role='${effectiveRole}' (staging: ${detectedRef})\n`);
  if (changes.length > 0) {
    console.table(changes);
  } else {
    console.log("(no fields changed — already in the requested state)");
  }
  for (const n of notes) console.log(`  • ${n}`);
  console.log("");
}

main().catch((err: unknown) => {
  console.error("[set-test-role] Unexpected error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
