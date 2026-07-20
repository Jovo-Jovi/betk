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
 * The RSC resolves the session uid (storage own-prefix + resume key), the
 * verified-phone status (OD-4 non-blocking pointer), the bilingual category
 * pickers, and the private docs bucket name, then hands them to the client
 * wizard. The phone gate itself is enforced in the T03 submit action
 * (requireVerifiedPhone) + RLS — this page only surfaces the capture pointer.
 */

import type { Metadata } from "next";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRowById } from "@/services/authUsers";
import { getCategoryTree } from "@/features/discovery";
import { OnboardingWizard } from "./_components/OnboardingWizard";
import type { CategoryOption } from "./_components/wizardShared";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seller.onboarding");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

const DOCS_BUCKET = process.env.SUPABASE_DOCS_BUCKET ?? "docs";

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

  // Bilingual category pickers — flatten the active taxonomy (parents + children)
  // into value(slug)/labelAr/labelEn options (stored as text per the schema).
  const tree = await getCategoryTree(supabase);
  const categories: CategoryOption[] = [];
  for (const node of tree) {
    categories.push({ value: node.slug, labelAr: node.nameAr, labelEn: node.nameEn ?? node.nameAr });
    for (const child of node.children) {
      categories.push({
        value: child.slug,
        labelAr: child.nameAr,
        labelEn: child.nameEn ?? child.nameAr,
      });
    }
  }

  return (
    <main
      data-slot="onboarding-wizard"
      className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-4 py-10"
    >
      <OnboardingWizard
        uid={user.id}
        docsBucket={DOCS_BUCKET}
        categories={categories}
        phoneRequired={phoneRequired}
      />
    </main>
  );
}
