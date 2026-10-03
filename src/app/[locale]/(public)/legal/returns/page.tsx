/**
 * P69 Return & refund policy — /legal/returns.
 * Platform policy page. REG-85 stays open.
 * notFound(): no.
 */

import { LegalDocument, legalMetadata } from "../_components/LegalDocument";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return legalMetadata(locale, "agreement_return_policy_version");
}

export default async function ReturnsPolicyPage({ params }: Props) {
  const { locale } = await params;
  return <LegalDocument locale={locale} versionKey="agreement_return_policy_version" />;
}
