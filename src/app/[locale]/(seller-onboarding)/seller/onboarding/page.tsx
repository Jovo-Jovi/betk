/**
 * Seller Onboarding (/seller/onboarding) — the 5-step become-seller wizard.
 * Phase 04 / T04 (FR-SEL-1). Replaces the T02 chromeless placeholder body (same
 * precedent as Phase 03 T02 replacing the BL-01 homepage stub).
 *
 * Route group: `(seller-onboarding)` — deliberately NOT under `(seller)`, so it
 * renders CHROMELESS (no ConsoleSidebar), matching the UI_SPEC "AuthShell →
 * wizard" layout. The URL `/seller/onboarding` is unchanged (route groups are
 * URL-invisible). Middleware gates it to authenticated users only and bounces
 * existing sellers away per status (T02).
 *
 * The RSC resolves the session uid, the verified-phone pointer, the category
 * limit, the food-requirements label, and the private docs bucket, then hands
 * them to the client wizard. Delivery modes are not collected.
 */

import type { Metadata } from "next";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRowById } from "@/services/authUsers";
import { readOnboardingSettings } from "@/services/onboardingSettings";
import { getCategoryTree } from "@/features/discovery";
import { ErrorRetryCard } from "@/components/shared";
import { OnboardingWizard } from "./_components/OnboardingWizard";
import type { CategoryOption } from "./_components/wizardShared";
import type { CategoryNode } from "@/features/discovery/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seller.onboarding");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

const DOCS_BUCKET = process.env.SUPABASE_DOCS_BUCKET ?? "docs";
const FOOD_SLUG = "food-beverages";

function flattenCategories(nodes: CategoryNode[], ancestorFood: boolean): CategoryOption[] {
  const out: CategoryOption[] = [];
  for (const node of nodes) {
    const food = ancestorFood || node.slug === FOOD_SLUG;
    out.push({
      id: node.id,
      slug: node.slug,
      labelAr: node.nameAr,
      labelEn: node.nameEn ?? node.nameAr,
      food,
    });
    out.push(...flattenCategories(node.children, food));
  }
  return out;
}

export default async function SellerOnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defensive: middleware already gates this to authenticated users. If the
  // session is somehow absent, route to login rather than rendering a wizard
  // with no uid (uploads/submit would fail the own-prefix gate anyway).
  if (!user) {
    redirect("/auth/login?returnUrl=%2Fseller%2Fonboarding" as Route);
  }

  // Verified-phone status (OD-4) — drives the non-blocking capture pointer only.
  const row = await getUserRowById(user.id);
  const phoneRequired = !row || row.phone_number === null;

  const settings = await readOnboardingSettings();
  const t = await getTranslations("seller.onboarding");
  if (!settings.ok) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-4 py-10">
        <ErrorRetryCard message={t("errors.submitFailed")} />
      </main>
    );
  }

  const tree = await getCategoryTree(supabase);
  const categories = flattenCategories(tree, false);

  return (
    <main
      data-slot="onboarding-wizard"
      className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-4 py-10"
    >
      <OnboardingWizard
        uid={user.id}
        docsBucket={DOCS_BUCKET}
        categories={categories}
        categoryLimit={settings.categoryLimit}
        foodLabel={settings.foodLabel}
        phoneRequired={phoneRequired}
      />
    </main>
  );
}
