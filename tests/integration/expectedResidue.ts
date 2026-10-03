/**
 * Guard G (REG-74) expected residue after N27.
 *
 * The pack's "seven ids" wording predates M5. The undeletable set is now:
 * the 7 seller_orders (plan §5), their 7 master_orders, and the 12
 * order_status_history rows (7 original + 5 N27). Master ids were read from
 * staging on 2026-10-03 (each seller order's master_order_id).
 *
 * residueProblems reports anything outside that set. It does not delete.
 * @betk.test auth users are outside the set (REG-74); any of them is residue.
 */

export const EXPECTED_HISTORY_ROWS = 12;

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

export interface ResidueObservation {
  sellerOrders: readonly { id: string; masterOrderId: string | null }[];
  masterIds: readonly string[];
  historyOrderIds: readonly string[];
  betkTestEmails: readonly string[];
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

  for (const email of observed.betkTestEmails) {
    problems.push(`@betk.test auth user outside the expected set: ${email}`);
  }

  return problems;
}
