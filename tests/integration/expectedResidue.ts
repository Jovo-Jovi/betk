/**
 * Guard G (REG-74) expected residue.
 *
 * The pack's "seven ids" wording predates M5. The undeletable order set is:
 * the 7 seller_orders (plan §5), their 7 master_orders, and the 12
 * order_status_history rows (7 original + 5 N27). Master ids were read from
 * staging on 2026-10-03 (each seller order's master_order_id).
 *
 * Q1 (2026-10-04) adds the permanent fixture accounts and the append-only
 * or evidence rows they own. One acceptance is listed by id because it is
 * a real staging signup, not a fixture. residueProblems names anything
 * outside that set. It does not remove rows.
 */

export const EXPECTED_HISTORY_ROWS = 12;

export const FIXTURE_ADMIN_EMAIL = "fixture-admin@betk.test";
export const FIXTURE_SELLER_EMAIL = "fixture-seller@betk.test";

export const FIXTURE_EMAILS: readonly string[] = [
  FIXTURE_ADMIN_EMAIL,
  FIXTURE_SELLER_EMAIL,
];

/**
 * Known acceptance, classified 2026-10-04. Not fixture-owned.
 * user e825d8d0-38a9-45d2-852e-82962d22178c still exists, role buyer,
 * auth_provider google, not a @betk.test account. accepted_at
 * 2026-10-04 15:29:52.252027+00 (the table has no created_at).
 * Edge log: authenticated POST /rest/v1/agreement_acceptances 201 at
 * 2026-10-04T15:29:52.209Z, after checkout_agreement_version, then
 * buyer_profiles 201. That is completeBuyerSignup. Google authorize on
 * the Vercel preview happened in the same minute. T08 STOP and T08-DB
 * still read acceptances 0. T08-APPLY A5 recorded this row as already
 * present. No rewrite rule. service_role could remove it; this set does not.
 */
export const KNOWN_ACCEPTANCE_RESIDUE: readonly {
  userId: string;
  document: string;
  versionLabel: string;
}[] = [
  {
    userId: "e825d8d0-38a9-45d2-852e-82962d22178c",
    document: "buyer_terms",
    versionLabel: "STAGING-DRAFT-1",
  },
];

export const EXPECTED_SELLER_ORDERS: readonly {
  id: string;
  masterOrderId: string;
}[] = [
  {
    id: "81147596-94ee-4a25-b634-34c043409242",
    masterOrderId: "940b5db5-0baf-4402-b491-f2a73729a3cc",
  },
  {
    id: "b327bfb8-f807-418e-9448-1fb645351f3b",
    masterOrderId: "a69668f8-8f2d-485a-934e-5bfbccf519e1",
  },
  {
    id: "e5d776fc-1402-484e-84c4-d2b441f5868f",
    masterOrderId: "147a7a45-6ca6-45e2-ac59-55dcd7b6a624",
  },
  {
    id: "02482319-a2a7-4b54-aaf1-8c24b5a95150",
    masterOrderId: "9060cdb2-790b-4263-bd81-8d9e9af25e1a",
  },
  {
    id: "41c5b2c2-e5e0-4a60-9d28-3dc467a23a2a",
    masterOrderId: "86dade36-245a-49f7-881f-82a72139ef0b",
  },
  {
    id: "da73deed-0670-4cc7-bccd-064b8d301b6f",
    masterOrderId: "18ed7f36-a768-4fd4-958b-3eebe9bf9b8d",
  },
  {
    id: "c7ba4f04-eefd-489a-b8de-5daa917e998b",
    masterOrderId: "c63a7064-df9d-416c-8bc4-2261bf9cd8bc",
  },
];

export interface AcceptanceResidue {
  userId: string;
  document: string;
  versionLabel: string;
}

export interface ModerationResidue {
  id: string;
  adminId: string;
}

export interface ResidueObservation {
  sellerOrders: readonly { id: string; masterOrderId: string | null }[];
  masterIds: readonly string[];
  historyOrderIds: readonly string[];
  betkTestEmails: readonly string[];
  /** auth ids of the permanent fixture emails that are present. */
  fixtureUserIds: readonly string[];
  moderationLogs: readonly ModerationResidue[];
  acceptances: readonly AcceptanceResidue[];
}

export function residueCounts(observed: ResidueObservation): string {
  const fixtures = observed.betkTestEmails.filter((email) =>
    FIXTURE_EMAILS.includes(email),
  ).length;
  return (
    `seller_orders=${observed.sellerOrders.length} ` +
    `master_orders=${observed.masterIds.length} ` +
    `order_status_history=${observed.historyOrderIds.length} ` +
    `fixture_accounts=${fixtures} ` +
    `moderation_logs=${observed.moderationLogs.length} ` +
    `agreement_acceptances=${observed.acceptances.length}`
  );
}

/** Names leftovers. Never deletes them. */
export function residueProblems(observed: ResidueObservation): string[] {
  const problems: string[] = [];
  const expectedSeller = new Set(EXPECTED_SELLER_ORDERS.map((row) => row.id));
  const expectedMaster = new Set(
    EXPECTED_SELLER_ORDERS.map((row) => row.masterOrderId),
  );
  const masterBySeller = new Map(
    EXPECTED_SELLER_ORDERS.map((row) => [row.id, row.masterOrderId]),
  );

  if (observed.sellerOrders.length !== EXPECTED_SELLER_ORDERS.length) {
    problems.push(
      `seller_orders count ${observed.sellerOrders.length} is not ${EXPECTED_SELLER_ORDERS.length}`,
    );
  }
  const seenSeller = new Set<string>();
  for (const row of observed.sellerOrders) {
    seenSeller.add(row.id);
    if (!expectedSeller.has(row.id)) {
      problems.push(`seller_orders id outside the expected set: ${row.id}`);
      continue;
    }
    const want = masterBySeller.get(row.id);
    if (row.masterOrderId !== want) {
      problems.push(
        `seller_orders ${row.id} master_order_id ${row.masterOrderId ?? "null"} is not ${want}`,
      );
    }
  }
  for (const id of expectedSeller) {
    if (!seenSeller.has(id)) {
      problems.push(`expected seller_orders id missing: ${id}`);
    }
  }

  if (observed.masterIds.length !== expectedMaster.size) {
    problems.push(
      `master_orders count ${observed.masterIds.length} is not ${expectedMaster.size}`,
    );
  }
  const seenMaster = new Set(observed.masterIds);
  for (const id of observed.masterIds) {
    if (!expectedMaster.has(id)) {
      problems.push(`master_orders id outside the expected set: ${id}`);
    }
  }
  for (const id of expectedMaster) {
    if (!seenMaster.has(id)) {
      problems.push(`expected master_orders id missing: ${id}`);
    }
  }

  if (observed.historyOrderIds.length !== EXPECTED_HISTORY_ROWS) {
    problems.push(
      `order_status_history row count ${observed.historyOrderIds.length} is not ${EXPECTED_HISTORY_ROWS} (7 original + 5 N27)`,
    );
  }
  for (const orderId of observed.historyOrderIds) {
    if (!expectedSeller.has(orderId)) {
      problems.push(
        `order_status_history order_id outside the expected set: ${orderId}`,
      );
    }
  }

  const fixtureIds = new Set(observed.fixtureUserIds);
  for (const email of observed.betkTestEmails) {
    if (!FIXTURE_EMAILS.includes(email)) {
      problems.push(`@betk.test auth user outside the expected set: ${email}`);
    }
  }

  for (const log of observed.moderationLogs) {
    if (!fixtureIds.has(log.adminId)) {
      problems.push(
        `moderation_logs row outside the expected set: ${log.id} admin_id ${log.adminId}`,
      );
    }
  }

  for (const row of observed.acceptances) {
    if (fixtureIds.has(row.userId)) continue;
    const known = KNOWN_ACCEPTANCE_RESIDUE.some(
      (item) =>
        item.userId === row.userId &&
        item.document === row.document &&
        item.versionLabel === row.versionLabel,
    );
    if (!known) {
      problems.push(
        `agreement_acceptances row outside the expected set: user ${row.userId} document ${row.document} version ${row.versionLabel}`,
      );
    }
  }

  return problems;
}
