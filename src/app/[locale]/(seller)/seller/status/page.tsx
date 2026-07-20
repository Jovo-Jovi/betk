import type { Metadata } from "next";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnSellerApplication } from "@/features/seller-onboarding/queries/getOwnSellerApplication";
import { Alert, EmptyState, SLABadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { routes } from "@/constants/routes";
import { ResubmitPanel } from "./_components/ResubmitPanel";

/**
 * Seller Application Status (/seller/status) — Phase 04 / T05 (FR-SEL-2).
 *
 * CLOSES the T02 carry: middleware routes every non-active seller (pending /
 * suspended / banned, plus the compound "rejected" state below) to this
 * route; before this task it 404'd. This page is that destination.
 *
 * STATE MODEL (confirmed with citations — see the `resubmit_seller_application`
 * rpc header, BETK_DATABASE_SCHEMA.sql, and the T05 close-out): the live
 * `seller_status` enum is EXACTLY {pending, active, suspended, banned} — there
 * is NO 'rejected' member. "Rejected" is the COMPOUND state
 * `status === 'pending' && rejected_reason !== null` (BETK_UI_SPEC.md groups
 * "pending/rejected" into the same routing branch, distinct from
 * "suspended/banned"'s separate restricted-view branch — corroborating this
 * independently of the DB). `banned` is not named in the task's literal
 * banner enumeration (pending/rejected/suspended/approved) but middleware
 * routes ANY non-active seller_profiles.status here, including `banned` — so
 * it renders a restricted view too (same treatment as `suspended`), rather
 * than an undefined fallback for a real, reachable enum value.
 *
 * Approved sellers normally never land here (middleware routes active →
 * /seller) — the approved CTA below is rendered DEFENSIVELY for the
 * transition window only (per the task), not a separate flow.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seller.status");
  return { title: `${t("metaTitle")} — BETK` };
}

const DOCS_BUCKET = process.env.SUPABASE_DOCS_BUCKET ?? "docs";
const SLA_HOURS = 24;

type DisplayStatus = "approved" | "pending" | "rejected" | "suspended" | "banned";

function resolveDisplayStatus(
  status: "pending" | "active" | "suspended" | "banned",
  rejectedReason: string | null,
): DisplayStatus {
  if (status === "active") return "approved";
  if (status === "pending") return rejectedReason !== null ? "rejected" : "pending";
  return status; // "suspended" | "banned"
}

/** R-M01 24h SLA note — display-only derived severity (enforcement is admin-side). */
function slaLevel(hoursElapsed: number): "safe" | "warning" | "danger" {
  if (hoursElapsed >= SLA_HOURS) return "danger";
  if (hoursElapsed >= SLA_HOURS * 0.75) return "warning";
  return "safe";
}

export default async function SellerStatusPage() {
  const t = await getTranslations("seller.status");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defensive: middleware already gates this route to authenticated sellers.
  if (!user) {
    redirect(routes.auth.login as Route);
  }

  const app = await getOwnSellerApplication(supabase);

  if (!app) {
    // Defensive: role='seller' with no seller_profiles row should not happen
    // (the T03 rpc writes the profile before the role flip, ADR-012) — but
    // never render an undefined state if it somehow does.
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 md:px-6">
        <EmptyState message={t("empty.message")} hint={t("empty.hint")} />
      </div>
    );
  }

  const { profile } = app;
  const displayStatus = resolveDisplayStatus(profile.status, profile.rejected_reason);

  const submittedAtText = profile.submitted_at
    ? t("submittedAtLabel", {
        date: new Date(profile.submitted_at).toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      })
    : null;

  const hoursElapsed = profile.submitted_at
    ? (Date.now() - new Date(profile.submitted_at).getTime()) / 3_600_000
    : 0;
  const level = slaLevel(hoursElapsed);
  const slaCountdown =
    level === "danger"
      ? t("pending.slaBreached")
      : t("pending.slaRemaining", { hours: Math.max(0, Math.ceil(SLA_HOURS - hoursElapsed)) });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <h1 className="font-display text-lg font-bold text-foreground">{t("title")}</h1>

      {displayStatus === "approved" && (
        <div className="flex flex-col gap-3">
          <Alert variant="success" title={t("approved.title")} message={t("approved.message")} />
          <div>
            <Button asChild size="sm">
              <Link href={routes.seller.dashboard}>{t("approved.cta")}</Link>
            </Button>
          </div>
        </div>
      )}

      {displayStatus === "pending" && (
        <div className="flex flex-col gap-3">
          <Alert variant="info" title={t("pending.title")} message={t("pending.message")} />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t("pending.slaNote")}</span>
            <SLABadge level={level}>{slaCountdown}</SLABadge>
          </div>
        </div>
      )}

      {displayStatus === "rejected" && (
        <div className="flex flex-col gap-4">
          <Alert variant="destructive" title={t("rejected.title")} message={t("rejected.message")} />
          {profile.rejected_reason && (
            <div className="rounded-md border border-border bg-card p-4 text-sm">
              <p className="font-semibold text-foreground">{t("rejected.reasonLabel")}</p>
              <p className="mt-1 text-muted-foreground">{profile.rejected_reason}</p>
            </div>
          )}
          <ResubmitPanel uid={user.id} docsBucket={DOCS_BUCKET} />
        </div>
      )}

      {displayStatus === "suspended" && (
        <Alert variant="warning" title={t("suspended.title")} message={t("suspended.message")} />
      )}

      {displayStatus === "banned" && (
        <Alert variant="destructive" title={t("banned.title")} message={t("banned.message")} />
      )}

      {submittedAtText && <p className="text-xs text-muted-foreground">{submittedAtText}</p>}
    </div>
  );
}
