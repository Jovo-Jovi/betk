"use client";

/**
 * ResubmitPanel — Phase 04 / T05 (MW2, rejected-only). Re-upload UI for a
 * rejected seller application. Mirrors the T04 wizard's step-5 upload
 * contract exactly: files land in the docs bucket under the CALLER'S OWN
 * PREFIX (first path folder = auth.uid()) via the authenticated browser
 * client (T01 storage RLS); each upload gets a NEW timestamped object path
 * (the docs bucket has no UPDATE policy — see the resubmit rpc's storage
 * comment), so the prior object is retained, not overwritten. The
 * `resubmitSellerApplication` action re-validates prefix ownership
 * server-side before calling the rpc.
 *
 * The docs bucket is PRIVATE — no path/filename is ever logged or shown
 * (PII discipline); only a local object-URL preview renders.
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { routes } from "@/constants/routes";
// Import the action directly (NOT the feature barrel) — the barrel also
// re-exports getOwnSellerApplication, whose @/lib/supabase/server import
// would leak next/headers into this client bundle (T04 precedent).
import { resubmitSellerApplication } from "@/features/seller-onboarding/actions/resubmitSellerApplication";
import { Alert, ImageUploader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

const UPLOAD_PROGRESS = 66; // Supabase JS gives no browser upload progress — nominal.
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

interface DocState {
  status: "idle" | "uploading" | "uploaded" | "error";
  progress: number;
  previewUrl?: string;
  path?: string;
}
const emptyDoc: DocState = { status: "idle", progress: 0 };

function extFor(file: File): string {
  return MIME_EXT[file.type] ?? (file.name.split(".").pop() || "img").toLowerCase();
}

interface Props {
  /** Session-verified uid — the storage own-prefix. */
  uid: string;
  /** Private docs bucket name (from server env; not a secret). */
  docsBucket: string;
}

export function ResubmitPanel({ uid, docsBucket }: Props) {
  const t = useTranslations("seller.status");
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);

  const [front, setFront] = React.useState<DocState>(emptyDoc);
  const [back, setBack] = React.useState<DocState>(emptyDoc);
  const frontFile = React.useRef<File | null>(null);
  const backFile = React.useRef<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [bothRequiredError, setBothRequiredError] = React.useState(false);

  const uploadDoc = React.useCallback(
    async (kind: "front" | "back", file: File) => {
      const setState = kind === "front" ? setFront : setBack;
      const preview = URL.createObjectURL(file);
      setState((prev) => {
        if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return { status: "uploading", progress: UPLOAD_PROGRESS, previewUrl: preview };
      });

      // NEW timestamped path per upload — the docs bucket retains the prior
      // object (R-S08); this rpc only repoints the DB row to the new one.
      const path = `${uid}/national_id_${kind}-resubmit-${Date.now()}.${extFor(file)}`;
      const { error: uploadError } = await supabase.storage
        .from(docsBucket)
        .upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });

      if (uploadError) {
        // PII discipline: never log the path/filename. Generic error state only.
        setState((prev) => ({ ...prev, status: "error", progress: 0 }));
        return;
      }
      setState((prev) => ({ ...prev, status: "uploaded", progress: 100, path }));
      setBothRequiredError(false);
    },
    [supabase, docsBucket, uid],
  );

  const onSelect = (kind: "front" | "back") => (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (kind === "front") frontFile.current = file;
    else backFile.current = file;
    void uploadDoc(kind, file);
  };

  const onRetry = (kind: "front" | "back") => () => {
    const file = kind === "front" ? frontFile.current : backFile.current;
    if (file) void uploadDoc(kind, file);
  };

  const bothUploaded = Boolean(front.path && back.path);

  const handleResubmit = async () => {
    if (!front.path || !back.path) {
      setBothRequiredError(true);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await resubmitSellerApplication({
        docFrontPath: front.path,
        docBackPath: back.path,
      });
      if (res.ok) {
        // Stay on /seller/status — re-render with the fresh 'pending' state.
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
        case "not_rejected":
          // Stale client state (e.g. already resubmitted in another tab).
          router.refresh();
          break;
        default:
          setError(t("resubmit.failed"));
      }
    } catch {
      setError(t("resubmit.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const renderSlot = (
    kind: "front" | "back",
    state: DocState,
    onSelectFn: (files: File[]) => void,
    onRetryFn: () => void,
  ) => (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-foreground">{t(`resubmit.${kind}Label`)}</p>
      <ImageUploader
        label={t("resubmit.uploadLabel")}
        hint={t(`resubmit.${kind}Hint`)}
        files={state.previewUrl ? [state.previewUrl] : []}
        onFiles={onSelectFn}
        uploading={state.status === "uploading"}
        progress={state.progress}
        error={state.status === "error" ? t("resubmit.uploadError") : undefined}
      />
      {state.status === "uploaded" && (
        <p className="text-xs text-success">{t("resubmit.uploaded")}</p>
      )}
      {state.status === "error" && (
        <div>
          <Button type="button" variant="outline" size="sm" onClick={onRetryFn}>
            {t("resubmit.retry")}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5 md:p-6">
      <p className="font-display text-base font-bold text-foreground">{t("resubmit.title")}</p>
      <Alert variant="info" message={t("resubmit.intro")} />

      {renderSlot("front", front, onSelect("front"), onRetry("front"))}
      {renderSlot("back", back, onSelect("back"), onRetry("back"))}

      {bothRequiredError && (
        <p role="alert" className="text-xs text-destructive">
          {t("resubmit.bothRequired")}
        </p>
      )}

      {error && <Alert variant="destructive" message={error} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={routes.seller.store}
          className="text-sm font-medium text-primary underline underline-offset-4"
        >
          {t("resubmit.editStore")}
        </Link>
        <Button type="button" onClick={handleResubmit} disabled={submitting || !bothUploaded}>
          {submitting ? t("resubmit.submitting") : t("resubmit.submit")}
        </Button>
      </div>
    </div>
  );
}
