"use client";

import { useTranslations } from "next-intl";
import { ImageUploader } from "@/components/shared";
import { Alert } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { routes } from "@/constants/routes";
import { Field } from "../Field";
import type { DocUploadState, StepErrors } from "../wizardShared";

/**
 * National ID, the seller-agreement e-sign (link to P68), and the four food
 * artefacts when a food category is chosen. Copy for those artefacts is the
 * `food-v1` message block when that is the settings label.
 */
interface FoodCopy {
  intro: string;
  packagingLabel: string;
  packagingHint: string;
  labelLabel: string;
  labelHint: string;
  expiryLabel: string;
  expiryHint: string;
  socialLabel: string;
  socialHint: string;
  socialPlaceholder: string;
}

interface Props {
  front: DocUploadState;
  back: DocUploadState;
  foodUploads: Record<"packaging" | "label" | "expiry", DocUploadState>;
  onSelectFront: (files: File[]) => void;
  onSelectBack: (files: File[]) => void;
  onRetryFront: () => void;
  onRetryBack: () => void;
  onSelectFood: (kind: "packaging" | "label" | "expiry", files: File[]) => void;
  onRetryFood: (kind: "packaging" | "label" | "expiry") => void;
  foodChosen: boolean;
  foodCopy: FoodCopy | null;
  socialUrl: string;
  onSocialUrl: (value: string) => void;
  agreementAccepted: boolean;
  onAgreement: (accepted: boolean) => void;
  errors: StepErrors;
}

function UploadField({
  id,
  label,
  hint,
  state,
  onSelect,
  onRetry,
  uploadLabel,
  uploadedLabel,
  errorLabel,
  retryLabel,
}: {
  id: string;
  label: string;
  hint: string;
  state: DocUploadState;
  onSelect: (files: File[]) => void;
  onRetry: () => void;
  uploadLabel: string;
  uploadedLabel: string;
  errorLabel: string;
  retryLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2" data-slot={id}>
      <ImageUploader
        label={label}
        hint={state.status === "uploaded" ? uploadedLabel : hint}
        files={state.previewUrl ? [state.previewUrl] : []}
        onFiles={onSelect}
        uploading={state.status === "uploading"}
        progress={state.progress}
        error={state.status === "error" ? errorLabel : undefined}
      />
      {state.status === "error" && (
        <Button type="button" variant="outline" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

export function StepDocuments(props: Props) {
  const t = useTranslations("seller.onboarding");
  const food = props.foodCopy;

  return (
    <div className="flex flex-col gap-6" data-slot="onboarding-documents">
      <p className="text-sm text-muted-foreground">{t("documents.intro")}</p>
      <UploadField
        id="national-id-front"
        label={t("documents.frontLabel")}
        hint={t("documents.frontHint")}
        state={props.front}
        onSelect={props.onSelectFront}
        onRetry={props.onRetryFront}
        uploadLabel={t("documents.uploadLabel")}
        uploadedLabel={t("documents.uploaded")}
        errorLabel={t("documents.uploadError")}
        retryLabel={t("documents.retry")}
      />
      <UploadField
        id="national-id-back"
        label={t("documents.backLabel")}
        hint={t("documents.backHint")}
        state={props.back}
        onSelect={props.onSelectBack}
        onRetry={props.onRetryBack}
        uploadLabel={t("documents.uploadLabel")}
        uploadedLabel={t("documents.uploaded")}
        errorLabel={t("documents.uploadError")}
        retryLabel={t("documents.retry")}
      />
      {(props.errors.docFrontPath || props.errors.docBackPath) && (
        <Alert variant="destructive" message={t("documents.bothRequired")} />
      )}

      {props.foodChosen && food && (
        <div className="flex flex-col gap-4" data-slot="food-artefacts">
          <p className="text-sm text-muted-foreground">{food.intro}</p>
          <UploadField
            id="food-packaging"
            label={food.packagingLabel}
            hint={food.packagingHint}
            state={props.foodUploads.packaging}
            onSelect={(files) => props.onSelectFood("packaging", files)}
            onRetry={() => props.onRetryFood("packaging")}
            uploadLabel={t("documents.uploadLabel")}
            uploadedLabel={t("documents.uploaded")}
            errorLabel={t("documents.uploadError")}
            retryLabel={t("documents.retry")}
          />
          <UploadField
            id="food-label"
            label={food.labelLabel}
            hint={food.labelHint}
            state={props.foodUploads.label}
            onSelect={(files) => props.onSelectFood("label", files)}
            onRetry={() => props.onRetryFood("label")}
            uploadLabel={t("documents.uploadLabel")}
            uploadedLabel={t("documents.uploaded")}
            errorLabel={t("documents.uploadError")}
            retryLabel={t("documents.retry")}
          />
          <UploadField
            id="food-expiry"
            label={food.expiryLabel}
            hint={food.expiryHint}
            state={props.foodUploads.expiry}
            onSelect={(files) => props.onSelectFood("expiry", files)}
            onRetry={() => props.onRetryFood("expiry")}
            uploadLabel={t("documents.uploadLabel")}
            uploadedLabel={t("documents.uploaded")}
            errorLabel={t("documents.uploadError")}
            retryLabel={t("documents.retry")}
          />
          <Field
            htmlFor="foodSocialUrl"
            label={food.socialLabel}
            hint={food.socialHint}
            error={props.errors.foodSocialUrl ? t(`errors.${props.errors.foodSocialUrl}`) : undefined}
            required
          >
            <Input
              id="foodSocialUrl"
              dir="ltr"
              inputMode="url"
              value={props.socialUrl}
              onChange={(e) => props.onSocialUrl(e.target.value)}
              placeholder={food.socialPlaceholder}
              maxLength={500}
            />
          </Field>
        </div>
      )}

      <div className="flex items-start gap-3">
        <input
          id="acceptSellerAgreement"
          name="sellerAgreement"
          type="checkbox"
          className="mt-1 size-4 shrink-0"
          checked={props.agreementAccepted}
          onChange={(e) => props.onAgreement(e.target.checked)}
        />
        <label htmlFor="acceptSellerAgreement" className="text-sm">
          {t("agreement.label")}{" "}
          <Link href={routes.legal.sellerAgreement} className="text-primary underline underline-offset-2">
            {t("agreement.link")}
          </Link>
        </label>
      </div>
      {props.errors.sellerAgreementAccepted && (
        <Alert variant="warning" message={t("agreement.required")} />
      )}
    </div>
  );
}
