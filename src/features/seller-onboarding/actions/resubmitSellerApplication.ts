"use server";

/**
 * resubmitSellerApplication — Phase 04 / T05 (R-S08, MW2). Re-upload path for
 * a REJECTED seller application (see the status page for the confirmed
 * "rejected" reading: `status='pending' AND rejected_reason IS NOT NULL` —
 * there is no distinct 'rejected' enum value in `seller_status`).
 *
 * ORDER:
 *   1. requireActiveUser() — R-A05 ONLY (deactivated/not-active). The
 *      verified-phone gate is deliberately NOT re-required: the caller is
 *      already a seller from a prior verified-phone submit (T03); the task
 *      explicitly calls for R-A05 status checks only here.
 *   2. Server-side prefix-ownership check on the two doc storage PATHS the
 *      client uploaded (same defense-in-depth as submitSellerApplication) —
 *      never accept a path outside auth.uid()'s prefix.
 *   3. betk.resubmit_seller_application(...) rpc — ONE transaction: clears
 *      `seller_profiles.rejected_reason` + refreshes `submitted_at`, then
 *      overwrites the two `seller_documents` rows' storage_path (reset
 *      review_status='pending', reviewed_at=NULL, uploaded_at=now()). The
 *      rejected-only guard runs INSIDE the rpc (never trust the client) —
 *      any non-rejected status (never-reviewed pending / active / suspended
 *      / banned) raises BETK_NOT_REJECTED and updates zero rows. There is no
 *      client-supplied id anywhere — the rpc only ever touches auth.uid()'s
 *      own rows, so cross-user access has no code path to attempt.
 *
 * PII DISCIPLINE (national IDs): the docs bucket is PRIVATE. No document
 * path, filename, or content is ever put in a log, Sentry event, PostHog
 * property, or error message. Sentry stays id-only.
 */

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import {
  requireActiveUser,
  NotAuthenticatedError,
  UserDeactivatedError,
  UserNotActiveError,
} from "@/features/auth";
import {
  resubmitSellerApplicationSchema,
  type ResubmitSellerApplicationInput,
  type ResubmitSellerApplicationResult,
} from "@/validations/sellerOnboarding";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";

/** The rpc raises this opaque token (never containing PII) when the guard bites. */
const RPC_NOT_REJECTED = "BETK_NOT_REJECTED";

/** First path segment (the storage prefix) — must equal the caller's uid. */
function ownsPrefix(path: string, uid: string): boolean {
  return path.split("/")[0] === uid;
}

export async function resubmitSellerApplication(
  input: ResubmitSellerApplicationInput,
): Promise<ResubmitSellerApplicationResult> {
  setFeatureContext("seller-onboarding");

  // ── Zod validation (before any DB call / gate) ──────────────────────────────
  const parsed = resubmitSellerApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }
  const app = parsed.data;

  // ── 1) R-A05 ONLY — phone gate deliberately NOT re-required ─────────────────
  let userId: string;
  try {
    const user = await requireActiveUser();
    userId = user.id;
  } catch (err) {
    if (err instanceof NotAuthenticatedError) {
      return { ok: false, reason: "unauthenticated" };
    }
    if (err instanceof UserDeactivatedError || err instanceof UserNotActiveError) {
      return { ok: false, reason: "blocked" };
    }
    captureTaggedError(err, "seller-onboarding", { extra: { step: "requireActiveUser" } });
    return { ok: false, reason: "error" };
  }

  Sentry.setUser({ id: userId });

  // ── 2) Prefix-ownership on the re-uploaded doc paths ────────────────────────
  if (!ownsPrefix(app.docFrontPath, userId) || !ownsPrefix(app.docBackPath, userId)) {
    // Do NOT include the paths in the event (docs bucket is private).
    captureTaggedError(
      new Error("seller-onboarding: resubmit doc path outside caller prefix"),
      "seller-onboarding",
      { extra: { step: "prefixOwnership" } },
    );
    return { ok: false, reason: "invalid" };
  }

  // ── 3) Atomic status-flip + doc overwrite via the SECURITY INVOKER rpc ──────
  const supabase = await createClient();
  const { error: rpcError } = await supabase.schema("betk").rpc("resubmit_seller_application", {
    p_doc_front_path: app.docFrontPath,
    p_doc_back_path: app.docBackPath,
  });

  if (rpcError) {
    const message = rpcError.message ?? "";

    // Non-rejected status (server-side guard bit) — the UI's rejected-only
    // gate should have prevented this call; treat as a stale-state refresh.
    if (message.includes(RPC_NOT_REJECTED)) {
      return { ok: false, reason: "not_rejected" };
    }

    captureTaggedError(rpcError, "seller-onboarding", { extra: { step: "resubmitRpc" } });
    return { ok: false, reason: "error" };
  }

  // ── Analytics (id-only; NO document paths/filenames — PII discipline) ───────
  captureServerEvent(userId, "seller_application_resubmitted");

  return { ok: true };
}
