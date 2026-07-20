"use client";

import { useTranslations } from "next-intl";
import { ImageUploader } from "@/components/shared";
import { Alert } from "@/components/shared";
import { Button } from "@/components/ui/button";
import type { DocUploadState, StepErrors } from "../wizardShared";

/**
 * Step 5 — National ID front + back via ImageUploader → docs bucket own-prefix
 * (the wizard owns the authenticated-client upload). Per-file retry on failure;
 * R-S05 both required to submit. The docs bucket is PRIVATE — no path/filename is
 * ever shown or logged (PII discipline); only the local object-URL preview is
 * rendered client-side.
 */
interface Props {
  front: DocUploadState;
  back: DocUploadState;
  onSelectFront: (files: File[]) => void;
  onSelectBack: (files: File[]) => void;
  onRetryFront: () => void;
  onRetryBack: () => void;
  errors: StepErrors;
}

export function StepDocuments({
  front,
  back,
  onSelectFront,
  onSelectBack,
  onRetryFront,
  onRetryBack,
  errors,
}: Props) {
  const t = useTranslations("seller.onboarding");

  const renderSlot = (
    key: "front" | "back",
    state: DocUploadState,
    onSelect: (files: File[]) => void,
    onRetry: () => void,
    fieldError?: string,
  ) => (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-foreground">
        {t(`documents.${key}Label`)}
        <span className="text-destructive"> *</span>
      </p>
      <ImageUploader
        label={t("documents.uploadLabel")}
        hint={t(`documents.${key}Hint`)}
        files={state.previewUrl ? [state.previewUrl] : []}
        onFiles={onSelect}
        uploading={state.status === "uploading"}
        progress={state.progress}
        error={
          state.status === "error"
            ? t("documents.uploadError")
            : fieldError
              ? t("errors.required")
              : undefined
        }
      />
      {state.status === "uploaded" && (
        <p className="text-xs text-success">{t("documents.uploaded")}</p>
      )}
      {state.status === "error" && (
        <div>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {t("documents.retry")}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <Alert variant="info" message={t("documents.intro")} />

      {renderSlot("front", front, onSelectFront, onRetryFront, errors.docFrontPath)}
      {renderSlot("back", back, onSelectBack, onRetryBack, errors.docBackPath)}

      {(errors.docFrontPath || errors.docBackPath) && (
        <p role="alert" className="text-xs text-destructive">
          {t("documents.bothRequired")}
        </p>
      )}
    </div>
  );
}
