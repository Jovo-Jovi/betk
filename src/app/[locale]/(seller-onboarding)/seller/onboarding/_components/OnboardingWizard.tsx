"use client";

/**
 * OnboardingWizard — Phase 04 / T04. The 5-step become-seller wizard that
 * composes the T00 kit (Stepper + Toggle + Alert + Textarea) + ImageUploader +
 * ui primitives. Chromeless (its own `(seller-onboarding)` route group, no
 * console sidebar) per the UI_SPEC "AuthShell → wizard" layout.
 *
 * Flow: Identity → Category → Payment → Delivery → National-ID upload → submit.
 * Per-step Zod (client mirror of the T03 slices) blocks advance on the required
 * fields (steps 3+4 are optional — R-S09 is the Phase-05 publish gate). Final
 * submit calls the T03 `submitSellerApplication` action and routes on its typed
 * outcome. Slug uniqueness: a best-effort availability pre-check (UX only —
 * `stores_public` shows ACTIVE stores only, so it cannot see pending/suspended
 * slugs); the action's 23505 is authoritative and surfaces as a field error.
 *
 * UPLOAD CONTRACT (matches T03): step-5 files upload to the docs bucket under the
 * CURRENT USER'S OWN PREFIX (first path folder = auth.uid()) via the
 * authenticated browser client (T01 storage RLS). The action re-validates prefix
 * ownership server-side. Docs bucket is PRIVATE — no path/filename is ever logged
 * or shown (PII discipline); only a local object-URL preview renders.
 *
 * RESUME: client-state only, within the session (sessionStorage, keyed to the
 * uid). No draft rows are invented — per-step server persistence is NOT pinned by
 * the UI_SPEC ("resume incomplete wizard" is an edge). Cross-session resume is a
 * flagged product decision (see close-out).
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { ZodTypeAny } from "zod";
import { createClient } from "@/lib/supabase/client";
import { routes } from "@/constants/routes";
// Import the action directly (NOT the feature barrel) — the barrel also
// re-exports getOwnSellerApplication, whose @/lib/supabase/server import would
// leak next/headers into this client bundle.
import { submitSellerApplication } from "@/features/seller-onboarding/actions/submitSellerApplication";
import { Stepper } from "@/components/shared";
import { Alert } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  buildSubmitPayload,
  emptyDocState,
  emptyWizardData,
  stepSlices,
  type CategoryOption,
  type DocUploadState,
  type SlugStatus,
  type StepErrors,
  type WizardData,
} from "./wizardShared";
import {
  categoryStepSchema,
  deliveryStepSchema,
  documentsStepSchema,
  identityStepSchema,
  paymentStepSchema,
} from "./wizardSchema";
import { StepIdentity } from "./steps/StepIdentity";
import { StepCategory } from "./steps/StepCategory";
import { StepPayment } from "./steps/StepPayment";
import { StepDelivery } from "./steps/StepDelivery";
import { StepDocuments } from "./steps/StepDocuments";

const SLUG_RE = /^[a-z0-9-]+$/;
const UPLOAD_PROGRESS = 66; // Supabase JS gives no browser upload progress — nominal.
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

interface Props {
  /** Session-verified uid — the storage own-prefix + resume key. */
  uid: string;
  /** Private docs bucket name (from server env; not a secret). */
  docsBucket: string;
  /** Bilingual category options (value = slug, stored as text). */
  categories: CategoryOption[];
  /** True when the account has no verified phone (OD-4) — non-blocking pointer. */
  phoneRequired: boolean;
}

/** Read a value at a Zod issue path from a plain slice object. */
function valueAtPath(slice: unknown, path: PropertyKey[]): unknown {
  let cur: unknown = slice;
  for (const key of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<PropertyKey, unknown>)[key];
  }
  return cur;
}

/** safeParse a slice → per-field error codes (required when empty, else invalid). */
function toErrors(schema: ZodTypeAny, slice: unknown): StepErrors {
  const res = schema.safeParse(slice);
  if (res.success) return {};
  const out: StepErrors = {};
  for (const issue of res.error.issues) {
    if (issue.path.length === 0) continue;
    const key = issue.path.join(".");
    const raw = valueAtPath(slice, issue.path);
    out[key] = raw === undefined || raw === "" ? "required" : "invalid";
  }
  return out;
}

function extFor(file: File): string {
  return MIME_EXT[file.type] ?? (file.name.split(".").pop() || "img").toLowerCase();
}

export function OnboardingWizard({ uid, docsBucket, categories, phoneRequired }: Props) {
  const t = useTranslations("seller.onboarding");
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const resumeKey = `betk:onb:${uid}`;

  const [step, setStep] = React.useState(0);
  const [data, setData] = React.useState<WizardData>(emptyWizardData);
  const [errors, setErrors] = React.useState<StepErrors>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [serverSlugTaken, setServerSlugTaken] = React.useState(false);
  const [slugStatus, setSlugStatus] = React.useState<SlugStatus>("idle");

  const [front, setFront] = React.useState<DocUploadState>(emptyDocState);
  const [back, setBack] = React.useState<DocUploadState>(emptyDocState);
  const frontFile = React.useRef<File | null>(null);
  const backFile = React.useRef<File | null>(null);

  const stepLabels = [
    t("steps.identity"),
    t("steps.category"),
    t("steps.payment"),
    t("steps.delivery"),
    t("steps.documents"),
  ];

  // ── Resume: restore client state within the session (no draft rows) ─────────
  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(resumeKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as { step?: number; data?: WizardData };
      if (saved.data) {
        setData({ ...emptyWizardData, ...saved.data });
        // Restored doc paths → mark uploaded (preview object-URLs don't survive).
        if (saved.data.docFrontPath) setFront({ status: "uploaded", progress: 100 });
        if (saved.data.docBackPath) setBack({ status: "uploaded", progress: 100 });
      }
      if (typeof saved.step === "number") setStep(Math.min(Math.max(saved.step, 0), 4));
    } catch {
      // Corrupt/blocked storage → start fresh, never crash the wizard.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist client state on every change (within-session resume) ────────────
  React.useEffect(() => {
    try {
      sessionStorage.setItem(resumeKey, JSON.stringify({ step, data }));
    } catch {
      // Storage full/blocked → resume simply won't be available; not fatal.
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
      // Clear cleared fields' errors as the user edits.
      const next = { ...prev };
      for (const k of Object.keys(patch)) delete next[k];
      return next;
    });
    if (patch.slug !== undefined) setServerSlugTaken(false);
  }, []);

  // ── Slug availability pre-check (debounced; best-effort; UX only) ────────────
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
          setSlugStatus("idle"); // silent — pre-check is best-effort only
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

  // ── National-ID upload → docs bucket own-prefix (authenticated client) ───────
  const uploadDoc = React.useCallback(
    async (kind: "front" | "back", file: File) => {
      const setState = kind === "front" ? setFront : setBack;
      const preview = URL.createObjectURL(file);
      setState((prev) => {
        if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return { status: "uploading", progress: UPLOAD_PROGRESS, previewUrl: preview };
      });

      const path = `${uid}/national_id_${kind}-${Date.now()}.${extFor(file)}`;
      const { error } = await supabase.storage
        .from(docsBucket)
        .upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });

      if (error) {
        // PII discipline: never log the path/filename. Generic error state only.
        setState((prev) => ({ ...prev, status: "error", progress: 0 }));
        return;
      }
      setState((prev) => ({ ...prev, status: "uploaded", progress: 100 }));
      update(kind === "front" ? { docFrontPath: path } : { docBackPath: path });
    },
    [supabase, docsBucket, uid, update],
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

  // ── Per-step validation (client mirror of the T03 schema slices) ─────────────
  const validateStep = React.useCallback(
    (s: number): StepErrors => {
      switch (s) {
        case 0: {
          const errs = toErrors(identityStepSchema, stepSlices.identity(data));
          if (serverSlugTaken) errs.slug = "taken";
          return errs;
        }
        case 1:
          return toErrors(categoryStepSchema, stepSlices.category(data));
        case 2:
          return toErrors(paymentStepSchema, {
            paymentMethods: buildSubmitPayload(data).paymentMethods,
          });
        case 3:
          return toErrors(deliveryStepSchema, {
            deliveryOptions: buildSubmitPayload(data).deliveryOptions,
          });
        case 4:
          return toErrors(documentsStepSchema, stepSlices.documents(data));
        default:
          return {};
      }
    },
    [data, serverSlugTaken],
  );

  const goNext = () => {
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setStep((s) => Math.min(s + 1, 4));
  };

  const goBack = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = async () => {
    const errs = validateStep(4);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await submitSellerApplication(buildSubmitPayload(data));
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

  const isLast = step === 4;

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Stepper steps={stepLabels} current={step} />

      <div className="rounded-lg border border-border bg-card p-5 md:p-6">
        {step === 0 && (
          <StepIdentity data={data} update={update} errors={errors} slugStatus={slugStatus} />
        )}
        {step === 1 && (
          <StepCategory data={data} update={update} errors={errors} categories={categories} />
        )}
        {step === 2 && <StepPayment data={data} update={update} errors={errors} />}
        {step === 3 && <StepDelivery data={data} update={update} errors={errors} />}
        {step === 4 && (
          <StepDocuments
            front={front}
            back={back}
            onSelectFront={onSelect("front")}
            onSelectBack={onSelect("back")}
            onRetryFront={onRetry("front")}
            onRetryBack={onRetry("back")}
            errors={errors}
          />
        )}
      </div>

      {/* Non-blocking phone-capture pointer (OD-4). The action's
          requireVerifiedPhone() is the HARD gate — this is UX only. */}
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
        {t("stepCounter", { current: step + 1, total: 5 })}
      </p>
    </div>
  );
}
