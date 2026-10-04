/**
 * Guard G (REG-74) — suite-start residue detector.
 *
 * Runs only when this Vitest invocation includes tests/integration.
 * Reads staging. Reports anything outside the Q1 expected set:
 * the N27 orders, the two permanent fixture accounts, the append-only
 * rows those accounts own, and the one known acceptance.
 * Does not remove that set, and does not remove anything else.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  FIXTURE_EMAILS,
  residueCounts,
  residueProblems,
  type ResidueObservation,
} from "../integration/expectedResidue";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function loadEnvLocal(): void {
  try {
    const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      const key = match[1];
      if (!key || process.env[key] !== undefined) continue;
      let value = match[2] ?? "";
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch {
    // .env.local is optional. CI injects the keys.
  }
}

const VITEST_COMMANDS = new Set(["run", "watch", "dev", "related", "bench"]);

/** True when this process will execute integration tests. */
export function integrationRunRequested(argv: readonly string[]): boolean {
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    if (arg === "--exclude") {
      i++;
      continue;
    }
    if (arg.startsWith("--exclude=")) continue;
    if (arg.startsWith("-")) continue;
    if (VITEST_COMMANDS.has(arg)) continue;
    positionals.push(arg.replace(/\\/g, "/"));
  }
  if (positionals.some((path) => path.includes("tests/integration"))) return true;
  if (positionals.length > 0) return false;
  const excluded = argv.some((arg, index) => {
    if (arg === "--exclude") {
      return (argv[index + 1] ?? "").replace(/\\/g, "/").includes("tests/integration");
    }
    return arg.startsWith("--exclude=") && arg.includes("tests/integration");
  });
  return !excluded;
}

async function readObservation(
  url: string,
  serviceKey: string,
): Promise<ResidueObservation> {
  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const db = client.schema("betk");

  const sellers = await db
    .from("seller_orders")
    .select("id, master_order_id")
    .limit(1000);
  if (sellers.error) {
    throw new Error(`Guard G seller_orders: ${sellers.error.message}`);
  }
  const masters = await db.from("master_orders").select("id").limit(1000);
  if (masters.error) {
    throw new Error(`Guard G master_orders: ${masters.error.message}`);
  }
  const history = await db
    .from("order_status_history")
    .select("order_id")
    .limit(1000);
  if (history.error) {
    throw new Error(`Guard G order_status_history: ${history.error.message}`);
  }

  const sellerRows = (sellers.data ?? []) as {
    id: string;
    master_order_id: string | null;
  }[];
  const masterRows = (masters.data ?? []) as { id: string }[];
  const historyRows = (history.data ?? []) as { order_id: string }[];

  const logs = await db.from("moderation_logs").select("id, admin_id").limit(1000);
  if (logs.error) {
    throw new Error(`Guard G moderation_logs: ${logs.error.message}`);
  }
  const acceptances = await db
    .from("agreement_acceptances")
    .select("user_id, document, version_label")
    .limit(1000);
  if (acceptances.error) {
    throw new Error(`Guard G agreement_acceptances: ${acceptances.error.message}`);
  }
  const logRows = (logs.data ?? []) as { id: string; admin_id: string }[];
  const acceptanceRows = (acceptances.data ?? []) as {
    user_id: string;
    document: string;
    version_label: string;
  }[];

  const emails: string[] = [];
  const fixtureUserIds: string[] = [];
  for (let page = 1; page <= 10; page++) {
    const listed = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (listed.error) throw new Error(`Guard G listUsers: ${listed.error.message}`);
    const users = listed.data?.users ?? [];
    for (const user of users) {
      if (!user.email?.endsWith("@betk.test")) continue;
      emails.push(user.email);
      if (FIXTURE_EMAILS.includes(user.email)) fixtureUserIds.push(user.id);
    }
    if (users.length < 200) break;
  }

  return {
    sellerOrders: sellerRows.map((row) => ({
      id: row.id,
      masterOrderId: row.master_order_id,
    })),
    masterIds: masterRows.map((row) => row.id),
    historyOrderIds: historyRows.map((row) => row.order_id),
    betkTestEmails: emails,
    fixtureUserIds,
    moderationLogs: logRows.map((row) => ({ id: row.id, adminId: row.admin_id })),
    acceptances: acceptanceRows.map((row) => ({
      userId: row.user_id,
      document: row.document,
      versionLabel: row.version_label,
    })),
  };
}

export async function setup(): Promise<void> {
  if (!integrationRunRequested(process.argv.slice(2))) return;
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    console.log(
      "Guard G (REG-74): no staging credentials — residue preflight skipped.",
    );
    return;
  }
  const ref = new URL(url).host.split(".")[0] ?? "";
  const allow = (process.env.RLS_ALLOW_PROJECT_REF ?? "sojmjvohiziapiwkzsjg")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!allow.includes(ref)) {
    throw new Error(
      `Guard G refused: project ref "${ref}" is not in the staging allow-list. ` +
        `The detector does not run against any other project.`,
    );
  }

  const observed = await readObservation(url, serviceKey);
  const counts = residueCounts(observed);
  const problems = residueProblems(observed);
  if (problems.length > 0) {
    throw new Error(
      `Guard G (REG-74): staging residue outside the expected set (${counts}). ` +
        `Nothing was removed.\n${problems.map((line) => `  - ${line}`).join("\n")}`,
    );
  }
  console.log(
    `Guard G (REG-74): staging residue is inside the expected set (${counts}).`,
  );
}
