/**
 * P68 Seller agreement — /legal/seller-agreement.
 * Public. Acceptance is written from P23, not from this page.
 * notFound(): no.
 */

import { LegalDocument, legalMetadata } from "../_components/LegalDocument";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return legalMetadata(locale, "agreement_seller_agreement_version");
}

export default async function SellerAgreementPage({ params }: Props) {
  const { locale } = await params;
  return <LegalDocument locale={locale} versionKey="agreement_seller_agreement_version" />;
}
