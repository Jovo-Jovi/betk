/**
 * Guard G baseline for Integration (local stack).
 *
 * This is not the staging set in tests/integration/expectedResidue.ts.
 * A fresh stack does not have those seven seller ids, their history, or
 * the fixture accounts. The counts below are what this job records:
 * the rehearsal rows the M5 step applies, then the CI settings seed.
 *
 * Seller ids: docs/03-database/rehearsal/run/04_seed_shape.sql lines 164–218.
 * Buyer of the first order: that file line 36.
 * History: that file inserts 7 rows (lines 244–295). 06_M5.sql then inserts
 * 5 (the check `v_history + 5` at line 197, with the bound history count 7
 * at line 60). 7 + 5 = 12.
 */

export const REHEARSAL_BUYER_ID = "10000000-0000-4000-8000-000000000001";

export const REHEARSAL_SELLER_ORDER_IDS: readonly string[] = [
  "60000000-0000-4000-8000-000000000001",
  "60000000-0000-4000-8000-000000000002",
  "60000000-0000-4000-8000-000000000003",
  "60000000-0000-4000-8000-000000000004",
  "60000000-0000-4000-8000-000000000005",
  "60000000-0000-4000-8000-000000000006",
  "60000000-0000-4000-8000-000000000007",
];

export const EXPECTED_HISTORY_ROWS = 12;

/** Runner-only label. Not a staging value. */
export const CI_TEST_VALUE = "CI TEST VALUE";

/**
 * Empty keys this job fills so a local test can read a version, and so the
 * checkout fail-closed keys are visibly a CI label. commission_rate_pct and
 * the other non-empty defaults are left as the migrations wrote them.
 */
export const CI_SETTING_KEYS: readonly string[] = [
  "payment_window_minutes",
  "agreement_buyer_terms_version",
  "agreement_seller_agreement_version",
  "agreement_return_policy_version",
  "agreement_privacy_version",
];

export interface LocalResidueObservation {
  sellerOrders: readonly { id: string; masterOrderId: string | null }[];
  masterIds: readonly string[];
  historyOrderIds: readonly string[];
  betkTestEmails: readonly string[];
  moderationLogIds: readonly string[];
  acceptanceIds: readonly string[];
  settings: readonly { key: string; value: string }[];
}

export function localResidueCounts(observed: LocalResidueObservation): string {
  return (
    `seller_orders=${observed.sellerOrders.length} ` +
    `master_orders=${observed.masterIds.length} ` +
    `order_status_history=${observed.historyOrderIds.length} ` +
    `betk_test_users=${observed.betkTestEmails.length} ` +
    `moderation_logs=${observed.moderationLogIds.length} ` +
    `agreement_acceptances=${observed.acceptanceIds.length}`
  );
}

/** Names leftovers. Never deletes them. */
export function localResidueProblems(observed: LocalResidueObservation): string[] {
  const problems: string[] = [];
  const expectedSeller = new Set(REHEARSAL_SELLER_ORDER_IDS);

  if (observed.sellerOrders.length !== REHEARSAL_SELLER_ORDER_IDS.length) {
    problems.push(
      `seller_orders count ${observed.sellerOrders.length} is not ${REHEARSAL_SELLER_ORDER_IDS.length}`,
    );
  }
  const seenSeller = new Set<string>();
  const masterFromSellers = new Set<string>();
  for (const row of observed.sellerOrders) {
    seenSeller.add(row.id);
    if (!expectedSeller.has(row.id)) {
      problems.push(`seller_orders id outside the rehearsal seed: ${row.id}`);
      continue;
    }
    if (!row.masterOrderId) {
      problems.push(`rehearsal seller_orders ${row.id} has no master_order_id`);
      continue;
    }
    masterFromSellers.add(row.masterOrderId);
  }
  for (const id of expectedSeller) {
    if (!seenSeller.has(id)) {
      problems.push(`rehearsal seller_orders id missing: ${id}`);
    }
  }

  if (observed.masterIds.length !== masterFromSellers.size) {
    problems.push(
      `master_orders count ${observed.masterIds.length} is not the ${masterFromSellers.size} masters of the rehearsal seller orders`,
    );
  }
  for (const id of observed.masterIds) {
    if (!masterFromSellers.has(id)) {
      problems.push(`master_orders id outside the rehearsal seller orders: ${id}`);
    }
  }

  if (observed.historyOrderIds.length !== EXPECTED_HISTORY_ROWS) {
    problems.push(
      `order_status_history row count ${observed.historyOrderIds.length} is not ${EXPECTED_HISTORY_ROWS} (7 rehearsal + 5 M5)`,
    );
  }
  for (const orderId of observed.historyOrderIds) {
    if (!expectedSeller.has(orderId)) {
      problems.push(
        `order_status_history order_id outside the rehearsal seed: ${orderId}`,
      );
    }
  }

  for (const email of observed.betkTestEmails) {
    problems.push(`@betk.test auth user on the fresh stack: ${email}`);
  }
  for (const id of observed.moderationLogIds) {
    problems.push(`moderation_logs row on the fresh stack: ${id}`);
  }
  for (const id of observed.acceptanceIds) {
    problems.push(`agreement_acceptances row on the fresh stack: ${id}`);
  }

  const settingByKey = new Map(observed.settings.map((row) => [row.key, row.value]));
  for (const key of CI_SETTING_KEYS) {
    const value = settingByKey.get(key);
    if (value !== CI_TEST_VALUE) {
      problems.push(
        `admin_settings ${key} is ${value === undefined ? "missing" : JSON.stringify(value)}, not ${JSON.stringify(CI_TEST_VALUE)}`,
      );
    }
  }

  return problems;
}
