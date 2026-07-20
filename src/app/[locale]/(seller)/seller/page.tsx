import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/shared";

/**
 * Seller Dashboard landing (/seller) — BETK_UI_SPEC §3 "Seller Dashboard".
 *
 * Phase 04 scope ships the EMPTY-STATE landing ONLY ("No activity yet — add
 * your first listing" guidance). FR-SEL-3 KPI widgets (profile/listing views,
 * inquiries, orders, revenue, level progress, recent lists, payout balance) are
 * Phase 13 — add NOTHING else here.
 *
 * No CTA link: the UI_SPEC's "add your first listing" CTA targets
 * /seller/listings/new, which is a Phase-05 route that does not exist yet. Per
 * the no-dead-routes principle applied to the console nav, the empty-state ships
 * as GUIDANCE ONLY (message + hint) rather than shipping a 404 link. Phase 05
 * wires the CTA when the new-listing route lands.
 *
 * RSC — the seller shell (ConsoleSidebar) is provided by (seller)/layout.tsx;
 * middleware already gated this route to active sellers (role=seller + active
 * seller_profiles status).
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("console");
  return { title: `${t("landing.title")} — BETK` };
}

export default async function SellerDashboardPage() {
  const t = await getTranslations("console");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <h1 className="font-display text-lg font-bold text-foreground">{t("landing.title")}</h1>

      <EmptyState
        variant="default"
        message={t("landing.emptyMessage")}
        hint={t("landing.emptyHint")}
        className="rounded-lg border border-border bg-card"
      />
    </div>
  );
}
