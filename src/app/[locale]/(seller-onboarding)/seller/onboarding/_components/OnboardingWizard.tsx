"use client";

/**
 * P23 onboarding. Identity, categories (up to the settings limit), the seller's
 * pickup street, then national ID, the seller agreement, and food artefacts.
 * Delivery-mode toggles are not rendered (OD-10).
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { ZodTypeAny } from "zod";
import { createClient } from "@/lib/supabase/client";
import { routes } from "@/constants/routes";
import { submitSellerApplication } from "@/features/seller-onboarding/actions/submitSellerApplication";
import { Stepper } from "@/components/shared";
import { Alert } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  buildSubmitPayload,
  chosenCategoryIds,
  emptyDocState,
  emptyWizardData,
  type CategoryOption,
  type DocUploadState,
  type SlugStatus,
  type StepErrors,
  type WizardData,
} from "./wizardShared";
import {
  categoryStepSchema,
  documentsStepSchema,
  foodStepSchema,
  identityStepSchema,
  pickupStepSchema,
} from "./wizardSchema";
import { StepIdentity } from "./steps/StepIdentity";
import { StepCategory } from "./steps/StepCategory";
import { StepPickup } from "./steps/StepPickup";
import { StepDocuments } from "./steps/StepDocuments";

const SLUG_RE = /^[a-z0-9-]+$/;
const UPLOAD_PROGRESS = 66;
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};
const STEP_COUNT = 4;

interface Props {
  uid: string;
  docsBucket: string;
  categories: CategoryOption[];
  categoryLimit: number;
  foodLabel: string;
  phoneRequired: boolean;
}

function valueAtPath(slice: unknown, path: PropertyKey[]): unknown {
  let cur: unknown = slice;
  for (const key of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<PropertyKey, unknown>)[key];
  }
  return cur;
}

function toErrors(schema: ZodTypeAny, slice: unknown): StepErrors {
  const res = schema.safeParse(slice);
  if (res.success) return {};
  const out: StepErrors = {};
  for (const issue of res.error.issues) {
    if (issue.path.length === 0) continue;
    const key = String(issue.path[0]);
    const raw = valueAtPath(slice, issue.path);
    out[key] = raw === undefined || raw === "" || raw === false ? "required" : "invalid";
  }
  return out;
}

function extFor(file: File): string {
  return MIME_EXT[file.type] ?? (file.name.split(".").pop() || "img").toLowerCase();
}

type FoodKind = "packaging" | "label" | "expiry";

export function OnboardingWizard({
  uid,
  docsBucket,
  categories,
  categoryLimit,
  foodLabel,
  phoneRequired,
}: Props) {
  const t = useTranslations("seller.onboarding");
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const resumeKey = `betk:onb:${uid}`;

  const [step, setStep] = React.useState(0);
  const [data, setData] = React.useState<WizardData>(() => emptyWizardData(categoryLimit));
  const [errors, setErrors] = React.useState<StepErrors>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [serverSlugTaken, setServerSlugTaken] = React.useState(false);
  const [slugStatus, setSlugStatus] = React.useState<SlugStatus>("idle");
  const [front, setFront] = React.useState<DocUploadState>(emptyDocState);
  const [back, setBack] = React.useState<DocUploadState>(emptyDocState);
  const [foodUploads, setFoodUploads] = React.useState<Record<FoodKind, DocUploadState>>({
    packaging: emptyDocState,
    label: emptyDocState,
    expiry: emptyDocState,
  });
  const files = React.useRef<Record<string, File | null>>({});

  const foodChosen = chosenCategoryIds(data).some((id) => categories.find((c) => c.id === id)?.food);
  const foodCopy =
    foodLabel === "food-v1"
      ? {
          intro: t("food.food-v1.intro"),
          packagingLabel: t("food.food-v1.packagingLabel"),
          packagingHint: t("food.food-v1.packagingHint"),
          labelLabel: t("food.food-v1.labelLabel"),
          labelHint: t("food.food-v1.labelHint"),
          expiryLabel: t("food.food-v1.expiryLabel"),
          expiryHint: t("food.food-v1.expiryHint"),
          socialLabel: t("food.food-v1.socialLabel"),
          socialHint: t("food.food-v1.socialHint"),
          socialPlaceholder: t("food.food-v1.socialPlaceholder"),
        }
      : {
          intro: t("food.fallback.intro"),
          packagingLabel: t("food.fallback.packagingLabel"),
          packagingHint: t("food.fallback.packagingHint"),
          labelLabel: t("food.fallback.labelLabel"),
          labelHint: t("food.fallback.labelHint"),
          expiryLabel: t("food.fallback.expiryLabel"),
          expiryHint: t("food.fallback.expiryHint"),
          socialLabel: t("food.fallback.socialLabel"),
          socialHint: t("food.fallback.socialHint"),
          socialPlaceholder: t("food.fallback.socialPlaceholder"),
        };

  const stepLabels = [
    t("steps.identity"),
    t("steps.category"),
    t("steps.pickup"),
    t("steps.documents"),
  ];

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(resumeKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as { step?: number; data?: Partial<WizardData> };
      if (saved.data) {
        const base = emptyWizardData(categoryLimit);
        const ids = Array.isArray(saved.data.categoryIds) ? saved.data.categoryIds.slice(0, categoryLimit) : [];
        while (ids.length < categoryLimit) ids.push("");
        setData({ ...base, ...saved.data, categoryIds: ids });
        if (saved.data.docFrontPath) setFront({ status: "uploaded", progress: 100 });
        if (saved.data.docBackPath) setBack({ status: "uploaded", progress: 100 });
      }
      if (typeof saved.step === "number") setStep(Math.min(Math.max(saved.step, 0), STEP_COUNT - 1));
    } catch {
      // Corrupt storage starts the wizard empty.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    try {
      sessionStorage.setItem(resumeKey, JSON.stringify({ step, data }));
    } catch {
      // Resume is best-effort.
    }
  }, [step, data, resumeKey]);

  const clearResume = React.useCallback(() => {
    try {
      sessionStorage.removeItem(resumeKey);
    } catch {
      /* no-op */
    }
  }, [resumeKey]);

  const update = React.useCallback((patch: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
    if (patch.slug !== undefined) setServerSlugTaken(false);
  }, []);

  React.useEffect(() => {
    const slug = data.slug.trim();
    if (slug.length < 3 || slug.length > 50 || !SLUG_RE.test(slug)) {
      setSlugStatus(slug.length === 0 ? "idle" : "invalid");
      return;
    }
    setSlugStatus("checking");
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const { data: row, error } = await supabase
          .schema("betk")
          .from("stores")
          .select("slug")
          .eq("slug", slug)
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          setSlugStatus("idle");
          return;
        }
        setSlugStatus(row ? "taken" : "available");
      } catch {
        if (!cancelled) setSlugStatus("idle");
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [data.slug, supabase]);

  const uploadToDocs = React.useCallback(
    async (key: string, file: File, onPath: (path: string) => void, setState: (next: DocUploadState) => void) => {
      const preview = URL.createObjectURL(file);
      setState({ status: "uploading", progress: UPLOAD_PROGRESS, previewUrl: preview });
      const path = `${uid}/${key}-${Date.now()}.${extFor(file)}`;
      const { error } = await supabase.storage
        .from(docsBucket)
        .upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });
      if (error) {
        setState({ status: "error", progress: 0, previewUrl: preview });
        return;
      }
      setState({ status: "uploaded", progress: 100, previewUrl: preview });
      onPath(path);
    },
    [supabase, docsBucket, uid],
  );

  const validateStep = React.useCallback(
    (current: number): StepErrors => {
      if (current === 0) {
        const errs = toErrors(identityStepSchema, {
          nameAr: data.nameAr.trim(),
          nameEn: data.nameEn.trim() || undefined,
          bioAr: data.bioAr.trim() || undefined,
          slug: data.slug.trim(),
        });
        if (serverSlugTaken) errs.slug = "taken";
        return errs;
      }
      if (current === 1) {
        return toErrors(categoryStepSchema, {
          categoryIds: chosenCategoryIds(data),
          governorate: data.governorate,
          city: data.city.trim() || undefined,
        });
      }
      if (current === 2) {
        return toErrors(pickupStepSchema, {
          pickupCity: data.pickupCity,
          streetAddress: data.streetAddress,
          buildingNotes: data.buildingNotes.trim() || undefined,
        });
      }
      const errs = toErrors(documentsStepSchema, {
        docFrontPath: data.docFrontPath,
        docBackPath: data.docBackPath,
        sellerAgreementAccepted: data.sellerAgreementAccepted,
      });
      if (foodChosen) {
        Object.assign(
          errs,
          toErrors(foodStepSchema, {
            foodPackagingPath: data.foodPackagingPath,
            foodLabelPath: data.foodLabelPath,
            foodExpiryPath: data.foodExpiryPath,
            foodSocialUrl: data.foodSocialUrl.trim(),
          }),
        );
      }
      return errs;
    },
    [data, serverSlugTaken, foodChosen],
  );

  const goNext = () => {
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setStep((s) => Math.min(s + 1, STEP_COUNT - 1));
  };

  const goBack = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = async () => {
    const errs = validateStep(STEP_COUNT - 1);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await submitSellerApplication(buildSubmitPayload(data, foodChosen));
      if (res.ok) {
        clearResume();
        router.push(routes.seller.status);
        return;
      }
      switch (res.reason) {
        case "slug_taken":
          setServerSlugTaken(true);
          setErrors({ slug: "taken" });
          setStep(0);
          break;
        case "application_exists":
          clearResume();
          router.push(routes.seller.status);
          break;
        case "agreement_required":
          setErrors({ sellerAgreementAccepted: "required" });
          setStep(STEP_COUNT - 1);
          break;
        case "phone_required":
          router.push("/auth/phone");
          break;
        case "unauthenticated":
          router.push(routes.auth.login);
          break;
        case "blocked":
          router.push("/blocked");
          break;
        default:
          setSubmitError(t("errors.submitFailed"));
      }
    } catch {
      setSubmitError(t("errors.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const onSelect = (kind: "front" | "back") => (selected: File[]) => {
    const file = selected[0];
    if (!file) return;
    files.current[kind] = file;
    const setState = kind === "front" ? setFront : setBack;
    void uploadToDocs(kind === "front" ? "national_id_front" : "national_id_back", file, (path) => {
      update(kind === "front" ? { docFrontPath: path } : { docBackPath: path });
    }, (next) => setState(next));
  };

  const onSelectFood = (kind: FoodKind, selected: File[]) => {
    const file = selected[0];
    if (!file) return;
    files.current[kind] = file;
    const field =
      kind === "packaging" ? "foodPackagingPath" : kind === "label" ? "foodLabelPath" : "foodExpiryPath";
    void uploadToDocs(`food_${kind}`, file, (path) => update({ [field]: path }), (next) => {
      setFoodUploads((prev) => ({ ...prev, [kind]: next }));
    });
  };

  const isLast = step === STEP_COUNT - 1;

  return (
    <div className="flex w-full flex-col gap-8" data-slot="onboarding-steps">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Stepper steps={stepLabels} current={step} />

      <div className="rounded-lg border border-border bg-card p-5 md:p-6">
        {step === 0 && (
          <StepIdentity data={data} update={update} errors={errors} slugStatus={slugStatus} />
        )}
        {step === 1 && (
          <StepCategory
            data={data}
            update={update}
            errors={errors}
            categories={categories}
            categoryLimit={categoryLimit}
          />
        )}
        {step === 2 && <StepPickup data={data} update={update} errors={errors} />}
        {step === 3 && (
          <StepDocuments
            front={front}
            back={back}
            foodUploads={foodUploads}
            onSelectFront={onSelect("front")}
            onSelectBack={onSelect("back")}
            onRetryFront={() => {
              const file = files.current.front;
              if (file) onSelect("front")([file]);
            }}
            onRetryBack={() => {
              const file = files.current.back;
              if (file) onSelect("back")([file]);
            }}
            onSelectFood={onSelectFood}
            onRetryFood={(kind) => {
              const file = files.current[kind];
              if (file) onSelectFood(kind, [file]);
            }}
            foodChosen={foodChosen}
            foodCopy={foodCopy}
            socialUrl={data.foodSocialUrl}
            onSocialUrl={(value) => update({ foodSocialUrl: value })}
            agreementAccepted={data.sellerAgreementAccepted}
            onAgreement={(accepted) => update({ sellerAgreementAccepted: accepted })}
            errors={errors}
          />
        )}
      </div>

      {isLast && phoneRequired && (
        <Alert variant="warning" title={t("phonePointer.title")}>
          {t("phonePointer.message")}{" "}
          <Link href="/auth/phone" className="font-semibold underline underline-offset-4">
            {t("phonePointer.link")}
          </Link>
        </Alert>
      )}

      {submitError && <Alert variant="destructive" message={submitError} />}

      <div className="flex items-center justify-between gap-3">
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={goBack} disabled={submitting}>
            {t("nav.back")}
          </Button>
        ) : (
          <span />
        )}
        {isLast ? (
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? t("nav.submitting") : t("nav.submit")}
          </Button>
        ) : (
          <Button type="button" onClick={goNext}>
            {t("nav.next")}
          </Button>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground" aria-live="polite">
        {t("stepCounter", { current: step + 1, total: STEP_COUNT })}
      </p>
    </div>
  );
}
