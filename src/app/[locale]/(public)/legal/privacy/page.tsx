/**
 * P70 Privacy — /legal/privacy.
 * Public. Readable without an account (AC-AGR-4).
 * notFound(): no.
 */

import { LegalDocument, legalMetadata } from "../_components/LegalDocument";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return legalMetadata(locale, "agreement_privacy_version");
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  return <LegalDocument locale={locale} versionKey="agreement_privacy_version" />;
}
