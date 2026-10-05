import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  readAgreementVersion,
  type AgreementVersionKey,
} from "@/services/agreementVersions";
import { LegalNotice } from "./LegalNotice";

type LegalNamespace = "legal.terms" | "legal.sellerAgreement" | "legal.returns" | "legal.privacy";

const NAMESPACE_FOR: Record<AgreementVersionKey, LegalNamespace> = {
  agreement_buyer_terms_version: "legal.terms",
  agreement_seller_agreement_version: "legal.sellerAgreement",
  agreement_return_policy_version: "legal.returns",
  agreement_privacy_version: "legal.privacy",
};

export async function legalMetadata(
  locale: string,
  versionKey: AgreementVersionKey,
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: NAMESPACE_FOR[versionKey] });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

/** Shared body for P67–P70. Each route keeps its own page.tsx. */
export async function LegalDocument({
  locale,
  versionKey,
}: {
  locale: string;
  versionKey: AgreementVersionKey;
}) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: NAMESPACE_FOR[versionKey] });
  const common = await getTranslations({ locale, namespace: "legal.common" });
  const version = await readAgreementVersion(versionKey);

  return (
    <LegalNotice
      title={t("title")}
      pendingTitle={common("pendingTitle")}
      pendingBody={common("pendingBody")}
      versionCaption={common("versionCaption")}
      versionLabel={version.ok ? version.label : ""}
      readFailed={!version.ok}
      errorMessage={common("error")}
      retryLabel={common("retry")}
    />
  );
}
