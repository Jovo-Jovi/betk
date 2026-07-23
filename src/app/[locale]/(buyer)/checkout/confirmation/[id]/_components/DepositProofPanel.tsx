"use client";

/**
 * DepositProofPanel — deposit instructions + transfer-screenshot upload + the
 * explicit state machine (OD-8 §5). Phase 07 / T03. Mirrors the ResubmitPanel /
 * OnboardingWizard upload contract exactly: files land in the PRIVATE `docs`
 * bucket under the CALLER'S OWN prefix (own-prefix INSERT RLS,
 * `docs_insert_own_prefix`) via the authenticated browser client, then
 * `attachDepositProof` (imported by FILE PATH, not the feature barrel — the
 * barrel-leak precedent) repoints `payments.proof_path`. A NEW timestamped path
 * per upload (the docs bucket has no UPDATE policy) — re-upload while pending
 * is allowed (R-S08); the prior object is retained, never overwritten.
 *
 * THE VERIFYING ACTOR IS BETK/ADMIN, NEVER THE SELLER (OD-8 — R-O05 amended).
 * No copy on this panel may say "the seller will confirm".
 *
 * STATE MACHINE (rendered explicitly, cited from OD-8 §5 / the T02b awaiting-
 * review convention):
 *   no proof yet                              → "upload your transfer screenshot"
 *   proof_path NOT NULL AND status='pending'  → "awaiting BETK verification"
 *   status='confirmed'                        → "verified, awaiting seller acceptance"
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { routes } from "@/constants/routes";
import { createClient } from "@/lib/supabase/client";
import { attachDepositProof } from "@/features/checkout/actions/attachDepositProof";
import { Alert, ImageUploader } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { OrderPaymentView } from "@/features/orders";

const UPLOAD_PROGRESS = 66; // Supabase JS gives no browser upload progress — nominal (ResubmitPanel precedent).
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

const HANDLE_LABEL_KEY: Record<string, string> = {
  instapay: "instapay",
  vodafone_cash: "vodafone_cash",
  orange_cash: "orange_cash",
};

function extFor(file: File): string {
  return MIME_EXT[file.type] ?? (file.name.split(".").pop() || "img").toLowerCase();
}

interface Props {
  orderId: string;
  uid: string;
  deposit: OrderPaymentView;
  /** BETK's handle for this specific deposit's method (never the store's). */
  depositHandle: string | null;
  docsBucket: string;
}

export function DepositProofPanel({ orderId, uid, deposit, depositHandle, docsBucket }: Props) {
  const t = useTranslations("checkout.confirmation");
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);

  const [uploadStatus, setUploadStatus] = React.useState<"idle" | "uploading" | "uploaded" | "error">("idle");
  const [previewUrl, setPreviewUrl] = React.useState<string | undefined>(undefined);
  const [path, setPath] = React.useState<string | null>(null);
  const [reference, setReference] = React.useState("");
  const [attaching, setAttaching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const hasProof = Boolean(deposit.proofPath);
  const confirmed = deposit.status === "confirmed";
  const pendingReview = !confirmed && hasProof;
  const noProofYet = !confirmed && !hasProof;
  // Re-upload allowed while pending (R-S08) — a fresh selection resets the
  // just-uploaded local state so the "I've uploaded" button re-enables.
  const canUpload = !confirmed;

  const onFiles = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setError(null);
    const preview = URL.createObjectURL(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return preview;
    });
    setUploadStatus("uploading");

    // NEW timestamped path per upload — the docs bucket has no UPDATE policy
    // (R-S08), the prior object is retained under the caller's own prefix.
    const newPath = `${uid}/order-${orderId}-deposit-${Date.now()}.${extFor(file)}`;
    const { error: uploadError } = await supabase.storage
      .from(docsBucket)
      .upload(newPath, file, { contentType: file.type || "image/jpeg", upsert: true });

    if (uploadError) {
      setUploadStatus("error");
      return;
    }
    setPath(newPath);
    setUploadStatus("uploaded");
  };

  const handleAttach = async () => {
    if (!path) return;
    setAttaching(true);
    setError(null);
    try {
      const res = await attachDepositProof({
        orderId,
        storagePath: path,
        transferReference: reference.trim() || undefined,
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      switch (res.reason) {
        case "unauthenticated":
          router.push(routes.auth.login);
          break;
        case "blocked":
          router.push("/blocked");
          break;
        case "not_pending":
          router.refresh();
          break;
        default:
          setError(t("deposit.attachError"));
      }
    } catch {
      setError(t("deposit.attachError"));
    } finally {
      setAttaching(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5 md:p-6">
      <div className="flex flex-col gap-1">
        <p className="font-display text-base font-bold text-foreground">{t("deposit.title")}</p>
        <p className="text-sm text-muted-foreground">
          {t("deposit.amountLabel")}:{" "}
          <span dir="ltr" className="font-mono font-semibold text-foreground">
            {new Intl.NumberFormat("en-EG").format(deposit.amount)} {t("deposit.currency")}
          </span>
        </p>
        {depositHandle && (
          <p className="text-sm text-muted-foreground">
            {t(`deposit.handleLabels.${HANDLE_LABEL_KEY[deposit.method] ?? deposit.method}`)}:{" "}
            <span dir="ltr" className="font-mono font-semibold text-foreground">{depositHandle}</span>
          </p>
        )}
      </div>

      {confirmed && (
        <Alert variant="success" title={t("state.confirmed.title")} message={t("state.confirmed.message")} />
      )}
      {pendingReview && (
        <Alert variant="info" title={t("state.pendingReview.title")} message={t("state.pendingReview.message")} />
      )}
      {noProofYet && (
        <Alert variant="warning" title={t("state.noProof.title")} message={t("state.noProof.message")} />
      )}

      {canUpload && (
        <>
          <ImageUploader
            label={t("deposit.uploadLabel")}
            hint={t("deposit.uploadHint")}
            files={previewUrl ? [previewUrl] : []}
            onFiles={onFiles}
            uploading={uploadStatus === "uploading"}
            progress={UPLOAD_PROGRESS}
            error={uploadStatus === "error" ? t("deposit.uploadError") : undefined}
          />

          <div className="flex flex-col gap-2">
            <label htmlFor="transfer-reference" className="text-sm font-semibold text-foreground">
              {t("deposit.referenceLabel")}
            </label>
            <Input
              id="transfer-reference"
              dir="ltr"
              className="font-mono"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={t("deposit.referencePlaceholder")}
            />
          </div>

          {error && <Alert variant="destructive" message={error} />}

          <Button type="button" onClick={handleAttach} disabled={!path || attaching}>
            {attaching ? t("deposit.submitting") : hasProof ? t("deposit.reupload") : t("deposit.submit")}
          </Button>
        </>
      )}
    </div>
  );
}
