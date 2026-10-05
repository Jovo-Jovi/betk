/**
 * P67 Buyer terms — /legal/terms.
 * Public. UI spec §5.1. F3: pending-review notice plus the version label.
 * notFound(): no.
 */

import { LegalDocument, legalMetadata } from "../_components/LegalDocument";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return legalMetadata(locale, "agreement_buyer_terms_version");
}

export default async function BuyerTermsPage({ params }: Props) {
  const { locale } = await params;
  return <LegalDocument locale={locale} versionKey="agreement_buyer_terms_version" />;
}
