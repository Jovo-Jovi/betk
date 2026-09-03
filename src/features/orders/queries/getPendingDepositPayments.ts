/**
 * getPendingDepositPayments — the ADMIN deposit-verification queue
 * (`/admin/payments`, T05). Phase 07 / T02b (OD-8 §5).
 *
 * Returns every DEPOSIT payment still `pending`, oldest first. Scope is RLS: only
 * an admin's `payments_access.is_admin()` branch returns rows across all orders
 * (the T05 page also gates with requireAdmin — the query stays lean/injectable and
 * relies on RLS, so a non-admin caller sees at most their own pending deposit, not
 * the platform queue).
 *
 * `hasProof` (proof_path IS NOT NULL) is the OD-8 §5 "awaiting BETK verification"
 * discriminator — a row with a proof is actionable; without one the buyer has not
 * uploaded yet. `buyerName` is null (REG-44 FLAGGED — admin CAN read buyer_profiles
 * via `bp_self`, but no buyer-name join is wired in T02b; owed with REG-44).
 */

import { createClient } from "@/lib/supabase/server";
import type { PendingDepositPayment, OrderStoreRef } from "../types";
import { asSingle } from "./_mappers";
import { resolveCallerUserId, type OrdersClient } from "./_shared";

const PENDING_SELECT = `
  id, amount, proof_path, transfer_reference, created_at, order_id,
  orders ( betk_ref, stores ( id, name_ar, name_en, slug ) )
`;

interface RawStore {
  id: string;
  name_ar: string;
  name_en: string | null;
  slug: string;
}
interface RawOrder {
  betk_ref: string;
  stores: RawStore | RawStore[] | null;
}
interface RawPendingRow {
  id: string;
  amount: number;
  proof_path: string | null;
  transfer_reference: string | null;
  created_at: string;
  order_id: string;
  orders: RawOrder | RawOrder[] | null;
}

function storeRef(order: RawOrder | null): OrderStoreRef | null {
  const s = asSingle(order?.stores ?? null);
  return s ? { id: s.id, nameAr: s.name_ar, nameEn: s.name_en, slug: s.slug } : null;
}

export async function getPendingDepositPayments(
  client?: OrdersClient,
): Promise<PendingDepositPayment[]> {
  const supabase = client ?? (await createClient());
  const userId = await resolveCallerUserId(supabase);
  if (!userId) return [];

  const { data, error } = await supabase
    .schema("betk")
    .from("payments")
    .select(PENDING_SELECT)
    .eq("payment_type", "deposit")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`[orders] getPendingDepositPayments failed: ${error.message}`);

  const rows = (data ?? []) as unknown as RawPendingRow[];
  return rows.map((r) => {
    const order = asSingle(r.orders);
    return {
      paymentId: r.id,
      orderId: r.order_id,
      betkRef: order?.betk_ref ?? "",
      amount: r.amount,
      proofPath: r.proof_path,
      transferReference: r.transfer_reference,
      submittedAt: r.created_at,
      hasProof: r.proof_path !== null,
      store: storeRef(order),
      buyerName: null, // REG-44 (FLAGGED)
    } satisfies PendingDepositPayment;
  });
}
