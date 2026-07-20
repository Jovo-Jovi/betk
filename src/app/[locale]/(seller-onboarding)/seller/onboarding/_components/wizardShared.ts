/**
 * Wizard shared types + payload mapping — Phase 04 / T04.
 *
 * `WizardData` is the flat client form state (all numbers held as strings while
 * editing); `buildSubmitPayload` maps it into the exact `SubmitSellerApplication
 * Input` the T03 action re-validates. Delivery is the 3-mode REG-14 shape
 * ({delivery, pickup, remote}) consumed from the typed `StoreDeliveryOptions`
 * interface — NOT reshaped. Empty optionals collapse to `undefined` so the
 * server schema's `.optional()` slots stay clean (no empty strings persisted).
 */

import type { SubmitSellerApplicationInput } from "@/validations/sellerOnboarding";
import type { StoreDeliveryOptions } from "@/types/jsonb";

/** The 3 live `betk.delivery_preference` modes (REG-14). */
export type DeliveryMode = NonNullable<StoreDeliveryOptions["modes"]>[number];
export const DELIVERY_MODES: readonly DeliveryMode[] = ["delivery", "pickup", "remote"];

/** Per-field validation outcome shown under a control. */
export type ErrCode = "required" | "invalid" | "taken";
export type StepErrors = Record<string, ErrCode>;

/** Slug availability pre-check state (UX-only; 23505 at submit is authoritative). */
export type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid";

/** Per-file upload state for a national-ID document (own-prefix docs bucket). */
export interface DocUploadState {
  status: "idle" | "uploading" | "uploaded" | "error";
  /** 0–100 while uploading (indeterminate → held at a nominal value). */
  progress: number;
  /** Object-URL preview of the chosen file (revoked on replace/unmount). */
  previewUrl?: string;
}

export const emptyDocState: DocUploadState = { status: "idle", progress: 0 };

/** A bilingual category option for the step-2 pickers (value stored as text). */
export interface CategoryOption {
  /** Stable value persisted to `stores.category_primary/secondary` (the slug). */
  value: string;
  labelAr: string;
  labelEn: string;
}

export interface WizardData {
  // Step 1 — Identity
  nameAr: string;
  nameEn: string;
  bioAr: string;
  slug: string;
  // Step 2 — Category & location
  categoryPrimary: string;
  categorySecondary: string;
  governorate: string;
  city: string;
  // Step 3 — Payment config
  payment: {
    instapay_handle: string;
    vodafone_cash: string;
    orange_cash: string;
    cod_enabled: boolean;
  };
  // Step 4 — Delivery config (typed StoreDeliveryOptions shape; numbers as strings)
  delivery: {
    modes: DeliveryMode[];
    min_delivery_days: string;
    max_delivery_days: string;
    delivery_fee_egp: string;
    free_delivery_threshold_egp: string;
    pickup_governorate: string;
    ships_nationwide: boolean;
  };
  // Step 5 — National-ID document storage paths (own-prefix; set after upload)
  docFrontPath: string;
  docBackPath: string;
}

export const emptyWizardData: WizardData = {
  nameAr: "",
  nameEn: "",
  bioAr: "",
  slug: "",
  categoryPrimary: "",
  categorySecondary: "",
  governorate: "",
  city: "",
  payment: {
    instapay_handle: "",
    vodafone_cash: "",
    orange_cash: "",
    cod_enabled: false,
  },
  delivery: {
    modes: [],
    min_delivery_days: "",
    max_delivery_days: "",
    delivery_fee_egp: "",
    free_delivery_threshold_egp: "",
    pickup_governorate: "",
    ships_nationwide: false,
  },
  docFrontPath: "",
  docBackPath: "",
};

/** Trim; empty → undefined (so an optional field is truly absent, not ""). */
function str(v: string): string | undefined {
  const t = v.trim();
  return t === "" ? undefined : t;
}

/** Trim; empty → undefined; else a finite number (or undefined if unparseable). */
function num(v: string): number | undefined {
  const t = v.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Map the flat wizard state → the T03 action payload (server re-validates). */
export function buildSubmitPayload(d: WizardData): SubmitSellerApplicationInput {
  return {
    nameAr: d.nameAr.trim(),
    nameEn: str(d.nameEn),
    bioAr: str(d.bioAr),
    slug: d.slug.trim(),
    categoryPrimary: d.categoryPrimary,
    categorySecondary: str(d.categorySecondary),
    governorate: d.governorate,
    city: str(d.city),
    paymentMethods: {
      instapay_handle: str(d.payment.instapay_handle),
      vodafone_cash: str(d.payment.vodafone_cash),
      orange_cash: str(d.payment.orange_cash),
      cod_enabled: d.payment.cod_enabled || undefined,
    },
    deliveryOptions: {
      modes: d.delivery.modes.length > 0 ? d.delivery.modes : undefined,
      min_delivery_days: num(d.delivery.min_delivery_days),
      max_delivery_days: num(d.delivery.max_delivery_days),
      delivery_fee_egp: num(d.delivery.delivery_fee_egp),
      free_delivery_threshold_egp: num(d.delivery.free_delivery_threshold_egp),
      pickup_governorate: str(d.delivery.pickup_governorate),
      ships_nationwide: d.delivery.ships_nationwide || undefined,
    },
    docFrontPath: d.docFrontPath,
    docBackPath: d.docBackPath,
  };
}

/** Normalised slices fed to the per-step Zod schemas (empties → undefined). */
export const stepSlices = {
  identity: (d: WizardData) => ({
    nameAr: d.nameAr.trim(),
    nameEn: str(d.nameEn),
    bioAr: str(d.bioAr),
    slug: d.slug.trim(),
  }),
  category: (d: WizardData) => ({
    categoryPrimary: d.categoryPrimary,
    categorySecondary: str(d.categorySecondary),
    governorate: d.governorate,
    city: str(d.city),
  }),
  documents: (d: WizardData) => ({
    docFrontPath: d.docFrontPath,
    docBackPath: d.docBackPath,
  }),
};
