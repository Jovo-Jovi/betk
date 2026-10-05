/**
 * Seller approval queue (P49, `/admin/sellers/approvals`).
 *
 * An authenticated non-admin reaches this page (middleware) and gets
 * notFound(), not a 200. Guests still go to login. A missing application
 * inside the detail is an error on this same route, not a new page.
 *
 * Signed document URLs are minted here for an admin session only, from the
 * private docs bucket, expiring in 60 seconds. png / jpeg / webp. No upload.
 * food_social_url is a link or plain text and is never fetched and never
 * passed to ProofViewer.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { routes, withLocale } from "@/constants/routes";
import type { AppLocale } from "@/i18n/routing";
import { ProofViewer } from "@/components/shared";
import type { DataTableColumn } from "@/components/shared";
import { loadApprovalDetail, loadApprovalQueue } from "@/features/seller-approval/queries/approvalQueue";
import { ApprovalQueue } from "./_components/ApprovalQueue";
import { ApproveActions } from "./_components/ApproveActions";
import { FoodSocialLink } from "./_components/FoodSocialLink";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.approvals");
  return { title: `${t("metaTitle")} — BETK` };
}

export default async function SellerApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ seller?: string }>;
}) {
  const t = await getTranslations("admin.approvals");
  const locale = (await getLocale()) as AppLocale;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const role = await supabase.schema("betk").from("users").select("role").eq("id", user.id).maybeSingle();
  if (role.error || (role.data?.role !== "admin" && role.data?.role !== "superadmin")) {
    notFound();
  }

  const queue = await loadApprovalQueue(supabase);
  const params = await searchParams;
  const sellerId = typeof params.seller === "string" ? params.seller : undefined;
  const detail = sellerId ? await loadApprovalDetail(supabase, user.id, sellerId) : null;

  const columns: DataTableColumn[] = [
    { id: "store", header: t("columnStore") },
    { id: "status", header: t("columnStatus") },
  ];
  const rows = (queue ?? []).map((row) => ({
    id: row.sellerId,
    store: row.storeName,
    status: t(`status.${row.status}`),
    href: withLocale(`${routes.admin.sellerApprovals}?seller=${row.sellerId}`, locale),
  }));

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="font-display text-xl font-extrabold">{t("title")}</h1>
      {queue === null ? (
        <p role="alert">{t("loadError")}</p>
      ) : (
        <ApprovalQueue
          columns={columns}
          rows={rows}
          caption={t("caption")}
          emptyLabel={t("empty")}
          errorLabel={t("loadError")}
          retryLabel={t("retry")}
          previousLabel={t("previous")}
          nextLabel={t("next")}
        />
      )}
      {sellerId && detail === "missing" ? <p role="alert">{t("missingApplication")}</p> : null}
      {sellerId && detail === null ? <p role="alert">{t("loadError")}</p> : null}
      {detail && detail !== "missing" ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-bold">{detail.storeName}</h2>
          <ul className="flex flex-col gap-4">
            {detail.documents.map((doc) => (
              <li key={doc.documentType} className="flex flex-col gap-2">
                <p className="text-sm font-medium">{t(`documents.${doc.documentType}`)}</p>
                {doc.socialUrl !== null ? (
                  <FoodSocialLink value={doc.socialUrl} label={t("foodSocial")} />
                ) : doc.signError ? (
                  <p role="alert">{t("signedUrlError")}</p>
                ) : doc.signedUrl ? (
                  <ProofViewer
                    sourceUrl={doc.signedUrl}
                    imageName={t(`documents.${doc.documentType}`)}
                    loadingLabel={t("proofLoading")}
                    emptyLabel={t("proofEmpty")}
                    errorLabel={t("proofError")}
                    unsupportedLabel={t("proofUnsupported")}
                  />
                ) : (
                  <p>{t("proofUnsupported")}</p>
                )}
              </li>
            ))}
          </ul>
          <ApproveActions
            sellerId={detail.sellerId}
            approveLabel={t("approve")}
            rejectLabel={t("reject")}
            reasonLabel={t("reason")}
            incompleteLabel={t("incomplete")}
            forbiddenLabel={t("forbidden")}
            refusedLabel={t("refused")}
          />
        </section>
      ) : null}
    </div>
  );
}
