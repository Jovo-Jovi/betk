/**
 * Guard G for Integration (local stack).
 *
 * Suite start only. Expects the empty fresh stack plus the rows this job
 * records: the rehearsal seller orders from the M5 step, and the CI settings
 * seed. Does not use tests/integration/expectedResidue.ts and does not
 * delete anything.
 *
 * Does not read .env.local. The workflow passes local keys from
 * `supabase status`. A staging URL is refused.
 */

import { createClient } from "@supabase/supabase-js";
import {
  CI_SETTING_KEYS,
  localResidueCounts,
  localResidueProblems,
  type LocalResidueObservation,
} from "./expectedResidue";

const STAGING_REF = "sojmjvohiziapiwkzsjg";

function localRefused(url: string): string | null {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    return `API URL is not a URL: ${url}`;
  }
  if (host !== "127.0.0.1" && host !== "localhost") {
    return `host ${host} is not the local stack`;
  }
  if (url.includes(STAGING_REF)) {
    return "staging project ref is not used by this job";
  }
  return null;
}

async function readObservation(
  url: string,
  serviceKey: string,
): Promise<LocalResidueObservation> {
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
  const logs = await db.from("moderation_logs").select("id").limit(1000);
  if (logs.error) {
    throw new Error(`Guard G moderation_logs: ${logs.error.message}`);
  }
  const acceptances = await db
    .from("agreement_acceptances")
    .select("id")
    .limit(1000);
  if (acceptances.error) {
    throw new Error(`Guard G agreement_acceptances: ${acceptances.error.message}`);
  }
  const settings = await db
    .from("admin_settings")
    .select("key, value")
    .in("key", [...CI_SETTING_KEYS])
    .limit(1000);
  if (settings.error) {
    throw new Error(`Guard G admin_settings: ${settings.error.message}`);
  }

  const sellerRows = (sellers.data ?? []) as {
    id: string;
    master_order_id: string | null;
  }[];
  const masterRows = (masters.data ?? []) as { id: string }[];
  const historyRows = (history.data ?? []) as { order_id: string }[];
  const logRows = (logs.data ?? []) as { id: string }[];
  const acceptanceRows = (acceptances.data ?? []) as { id: string }[];
  const settingRows = (settings.data ?? []) as { key: string; value: string }[];

  const emails: string[] = [];
  for (let page = 1; page <= 10; page++) {
    const listed = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (listed.error) throw new Error(`Guard G listUsers: ${listed.error.message}`);
    const users = listed.data?.users ?? [];
    for (const user of users) {
      if (user.email?.endsWith("@betk.test")) emails.push(user.email);
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
    moderationLogIds: logRows.map((row) => row.id),
    acceptanceIds: acceptanceRows.map((row) => row.id),
    settings: settingRows.map((row) => ({ key: row.key, value: row.value })),
  };
}

export async function setup(): Promise<void> {
  if (process.env.BETK_LOCAL_STACK !== "1") {
    throw new Error(
      "Guard G (local stack) refused: BETK_LOCAL_STACK is not 1. This config does not run against staging.",
    );
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Guard G (local stack) refused: local API URL or service key is missing.");
  }
  const refused = localRefused(url);
  if (refused) {
    throw new Error(`Guard G (local stack) refused: ${refused}.`);
  }

  const observed = await readObservation(url, serviceKey);
  const counts = localResidueCounts(observed);
  const problems = localResidueProblems(observed);
  if (problems.length > 0) {
    throw new Error(
      `Guard G (local stack): residue outside the fresh-stack baseline (${counts}). ` +
        `Nothing was removed.\n${problems.map((line) => `  - ${line}`).join("\n")}`,
    );
  }
  console.log(
    `Guard G (local stack): fresh-stack baseline holds (${counts}).`,
  );
}
