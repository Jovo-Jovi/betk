"use client";

/**
 * ListingForm — the ONE form component behind both `/seller/listings/new`
 * and `/seller/listings/[id]/edit` (Phase 05 / T04, FR-SEL-9). Composes the
 * kit (`Alert`/`Toggle`) + `ui/*` primitives + the feature-local `Field`
 * wrapper + `ListingImagesField`. No new styled DS components — a genuinely
 * new component/state → STOP-and-flag to Claude Design.
 *
 * TWO MODES, ONE COMPONENT:
 *   • create — empty defaults, no images section (a listing needs a row to
 *     attach `listing_images` to — R-L02 can't be satisfied before that
 *     exists). "Save draft" calls `createListing`, then `router.replace`s to
 *     the edit route for the new id (locale-preserving) so the very next
 *     screen the seller sees IS the edit form with images enabled — "fill →
 *     upload images → publish" from the UI_SPEC maps onto exactly these two
 *     screens, not one hybrid state.
 *   • edit — prefilled from `getOwnListingById` (T02); "Save changes"
 *     updates content fields (title/category/price/stock/shipping/prep/tags); the
 *     dedicated `ListingImagesField` manages images independently (its own
 *     Server Actions, no bearing on this form's save).
 *
 * REG-15 (closed here, form half): titleAr AND titleEn are BOTH required —
 * mirrors the T02 `createListingSchema`/`updateListingSchema` shape 1:1 (the
 * single source of truth stays the Zod schema; this is a hand-mirrored client
 * validate(), same pattern as every other feature form in this repo — there
 * is no shared client-schema-from-server-schema helper in this codebase to
 * `.pick()` from on the client bundle, so the mirror is manual like
 * StoreProfileForm/OnboardingWizard already do for their own schemas).
 *
 * Catalogue (Phase 09 / T07): the form sends type product and price_type
 * fixed, the four shipping attributes, prep_days, and a category id from the
 * store's approved categories. A draft save does not set status active.
 * A database refusal is shown from its i18n key, never as raw Postgres text.
 *
 * PUBLISH (edit mode only, and only while `status==='draft'` — publishing an
 * already-active/paused listing is a no-op the T02 action itself guards):
 * persists the current field edits first (`updateListing` — publish reads
 * live DB state, not this form's client state), then calls `publishListing`
 * and routes EVERY discriminated outcome: `unmet_requirements` renders the
 * inline checklist (image/title_ar/category/payment_method), with the
 * `payment_method` line linking to `/seller/store/payments` (locale-
 * preserving via `@/i18n/navigation`'s `Link` — R-S09 is enforced HERE, that
 * settings page is config+banner only); `unauthenticated`/`blocked` redirect;
 * anything else is a generic inline error. Draft save and publish stay two
 * separate buttons/affordances (ADR-013 draft-first) — saving NEVER requires
 * publish-completeness.
 *
 * CATEGORY/SUBCATEGORY: real FK pickers (`category_id`/`subcategory_id`)
 * sourced from the store's approved categories (bilingual via `localizedName`) —
 * UNLIKE the store-profile form's free-text category slugs. Selecting a
 * category whose children no longer include the current subcategory choice
 * resets the subcategory (defensive against a stale selection).
 */

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter, Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { localizedName } from "@/i18n/localizedName";
import { routes } from "@/constants/routes";
// Import actions DIRECTLY (NOT the feature barrel) — the barrel also
// re-exports @/lib/supabase/server-backed queries, which would leak
// next/headers into this client bundle (ListingsList / T03 precedent).
import { createListing } from "@/features/listings/actions/createListing";
import { updateListing } from "@/features/listings/actions/updateListing";
import { publishListing } from "@/features/listings/actions/publishListing";
import type { PublishRequirement } from "@/features/listings/listingRules";
import type { ApprovedStoreCategory, OwnListingDetail } from "@/features/listings/types";
import type { ListingRefusalCode } from "@/features/listings/publishRefusal";
import { Alert, Toggle } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Field, SELECT_CLASS } from "./Field";
import { ListingImagesField } from "./ListingImagesField";

const MAX_TAGS = 5;

interface FormValues {
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  categoryId: string;
  subcategoryId: string;
  price: string;
  stockQty: string;
  isMadeToOrder: boolean;
  lowStockThreshold: string;
  acceptsCustomOrders: boolean;
  customOrderNotes: string;
  tags: string[];
  weightG: string;
  lengthMm: string;
  widthMm: string;
  heightMm: string;
  prepDays: string;
}

function defaultValues(): FormValues {
  return {
    titleAr: "",
    titleEn: "",
    descriptionAr: "",
    categoryId: "",
    subcategoryId: "",
    price: "",
    stockQty: "",
    isMadeToOrder: false,
    lowStockThreshold: "3",
    acceptsCustomOrders: false,
    customOrderNotes: "",
    tags: [],
    weightG: "",
    lengthMm: "",
    widthMm: "",
    heightMm: "",
    prepDays: "",
  };
}

function valuesFromDetail(d: OwnListingDetail): FormValues {
  return {
    titleAr: d.titleAr,
    titleEn: d.titleEn ?? "",
    descriptionAr: d.descriptionAr ?? "",
    categoryId: d.categoryId,
    subcategoryId: d.subcategoryId ?? "",
    price: d.price !== null ? String(d.price) : "",
    stockQty: d.stockQty !== null ? String(d.stockQty) : "",
    isMadeToOrder: d.isMadeToOrder,
    lowStockThreshold: String(d.lowStockThreshold),
    acceptsCustomOrders: d.acceptsCustomOrders,
    customOrderNotes: d.customOrderNotes ?? "",
    tags: d.tags,
    weightG: d.weightG !== null ? String(d.weightG) : "",
    lengthMm: d.lengthMm !== null ? String(d.lengthMm) : "",
    widthMm: d.widthMm !== null ? String(d.widthMm) : "",
    heightMm: d.heightMm !== null ? String(d.heightMm) : "",
    prepDays: d.prepDays !== null ? String(d.prepDays) : "",
  };
}

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

type ErrCode = "required" | "invalid" | "priceRequired" | "tagsMax" | "tagsDuplicate";
type FieldKey = keyof FormValues | "tags";
type FieldErrors = Partial<Record<FieldKey, ErrCode>>;

function validate(v: FormValues): FieldErrors {
  const e: FieldErrors = {};
  if (v.titleAr.trim().length === 0) e.titleAr = "required";
  if (v.titleEn.trim().length === 0) e.titleEn = "required";
  if (!v.categoryId) e.categoryId = "required";
  const price = num(v.price);
  if (price === undefined || price <= 0) e.price = "priceRequired";
  if (v.tags.length > MAX_TAGS) e.tags = "tagsMax";
  const norm = v.tags.map((tag) => tag.trim().toLowerCase());
  if (new Set(norm).size !== norm.length) e.tags = "tagsDuplicate";
  return e;
}

function buildContentPayload(v: FormValues) {
  return {
    type: "product" as const,
    titleAr: v.titleAr.trim(),
    titleEn: v.titleEn.trim(),
    descriptionAr: str(v.descriptionAr),
    categoryId: v.categoryId,
    subcategoryId: v.subcategoryId || undefined,
    priceType: "fixed" as const,
    price: num(v.price),
    stockQty: num(v.stockQty),
    isMadeToOrder: v.isMadeToOrder,
    lowStockThreshold: num(v.lowStockThreshold) ?? 3,
    acceptsCustomOrders: v.acceptsCustomOrders,
    customOrderNotes: str(v.customOrderNotes),
    tags: v.tags.length > 0 ? v.tags : undefined,
    weightG: num(v.weightG) ?? null,
    lengthMm: num(v.lengthMm) ?? null,
    widthMm: num(v.widthMm) ?? null,
    heightMm: num(v.heightMm) ?? null,
    prepDays: num(v.prepDays) ?? null,
  };
}

/** Every write action's failure reason set that this form needs to route. */
type WriteFailReason =
  | "unauthenticated"
  | "blocked"
  | "no_store"
  | "not_found"
  | "invalid"
  | "error"
  | "refused";

export type ListingFormProps =
  | { mode: "create"; uid: string; mediaBucket: string; categories: ApprovedStoreCategory[] }
  | { mode: "edit"; uid: string; mediaBucket: string; categories: ApprovedStoreCategory[]; initial: OwnListingDetail };

export function ListingForm(props: ListingFormProps) {
  const { mode, uid, mediaBucket, categories } = props;
  const initial = mode === "edit" ? props.initial : undefined;

  const t = useTranslations("seller.listings.form");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [data, setData] = React.useState<FormValues>(() => (initial ? valuesFromDetail(initial) : defaultValues()));
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [tagDraft, setTagDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [unmet, setUnmet] = React.useState<PublishRequirement[]>([]);

  const update = React.useCallback((patch: Partial<FormValues>) => {
    setData((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(patch)) delete next[k as FieldKey];
      return next;
    });
  }, []);

  const catLabel = (c: { nameAr: string; nameEn: string | null }) =>
    localizedName({ ar: c.nameAr, en: c.nameEn }, locale);

  const subcategoryOptions = React.useMemo(
    () => categories.filter((c) => c.parentId === data.categoryId),
    [categories, data.categoryId],
  );

  function onCategoryChange(categoryId: string) {
    const children = categories.filter((c) => c.parentId === categoryId);
    const stillValid = children.some((c) => c.id === data.subcategoryId);
    update({ categoryId, subcategoryId: stillValid ? data.subcategoryId : "" });
  }

  function addTag() {
    const value = tagDraft.trim();
    if (!value) return;
    if (data.tags.length >= MAX_TAGS) {
      setErrors((prev) => ({ ...prev, tags: "tagsMax" }));
      return;
    }
    if (data.tags.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
      setErrors((prev) => ({ ...prev, tags: "tagsDuplicate" }));
      return;
    }
    update({ tags: [...data.tags, value] });
    setTagDraft("");
  }

  function removeTag(tag: string) {
    update({ tags: data.tags.filter((existing) => existing !== tag) });
  }

  function routeWriteFailure(reason: WriteFailReason, code?: ListingRefusalCode) {
    if (reason === "refused" && code) {
      setFormError(t(`refusal.${code}`));
      return;
    }
    if (reason === "unauthenticated") {
      router.push(routes.auth.login);
      return;
    }
    if (reason === "blocked") {
      router.push("/blocked");
      return;
    }
    setFormError(t("saveFailed"));
  }

  async function handleSaveDraft() {
    const errs = validate(data);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setFormError(null);
    setUnmet([]);
    setSaving(true);
    try {
      if (mode === "create") {
        const res = await createListing(buildContentPayload(data));
        if (res.ok) {
          toast.success(t("draftSaved"));
          router.replace(routes.seller.listingEdit(res.listingId));
          return;
        }
        routeWriteFailure(res.reason, res.reason === "refused" ? res.code : undefined);
        return;
      }
      const res = await updateListing({ listingId: initial!.id, ...buildContentPayload(data) });
      if (res.ok) {
        toast.success(t("changesSaved"));
        router.refresh();
        return;
      }
      routeWriteFailure(res.reason, res.reason === "refused" ? res.code : undefined);
    } catch {
      setFormError(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (mode !== "edit") return;
    const errs = validate(data);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setFormError(null);
    setUnmet([]);
    setPublishing(true);
    try {
      // Publish reads live DB state, not this form's client state — persist
      // the current edits first (ADR-013: two separate affordances, but
      // publish still needs today's field values on the row).
      const saveRes = await updateListing({ listingId: initial!.id, ...buildContentPayload(data) });
      if (!saveRes.ok) {
        routeWriteFailure(saveRes.reason, saveRes.reason === "refused" ? saveRes.code : undefined);
        return;
      }

      const pubRes = await publishListing({ listingId: initial!.id });
      if (pubRes.ok) {
        toast.success(t("publishSuccess"));
        router.refresh();
        return;
      }
      switch (pubRes.reason) {
        case "unauthenticated":
          router.push(routes.auth.login);
          break;
        case "blocked":
          router.push("/blocked");
          break;
        case "unmet_requirements":
          setUnmet(pubRes.unmet);
          break;
        case "invalid_state":
          toast.error(t("invalidState"));
          router.refresh();
          break;
        case "refused":
          setFormError(t(`refusal.${pubRes.code}`));
          break;
        default:
          setFormError(t("publishFailed"));
      }
    } catch {
      setFormError(t("publishFailed"));
    } finally {
      setPublishing(false);
    }
  }

  const busy = saving || publishing;
  const canPublish = mode === "edit" && initial!.status === "draft";

  return (
    <div className="flex flex-col gap-6">
      {/* ── Titles ────────────────────────────────────────────────────────── */}
      <Field htmlFor="titleAr" label={t("titleArLabel")} error={errors.titleAr ? t(`errors.${errors.titleAr}`) : undefined} required>
        <Input
          id="titleAr"
          value={data.titleAr}
          onChange={(e) => update({ titleAr: e.target.value })}
          maxLength={80}
          placeholder={t("titleArPlaceholder")}
          dir="rtl"
        />
      </Field>

      <Field
        htmlFor="titleEn"
        label={t("titleEnLabel")}
        hint={errors.titleEn ? undefined : t("titleEnHint")}
        error={errors.titleEn ? t(`errors.${errors.titleEn}`) : undefined}
        required
      >
        <Input
          id="titleEn"
          value={data.titleEn}
          onChange={(e) => update({ titleEn: e.target.value })}
          maxLength={80}
          placeholder={t("titleEnPlaceholder")}
          dir="ltr"
        />
      </Field>

      <Field htmlFor="descriptionAr" label={t("descriptionLabel")}>
        <Textarea
          id="descriptionAr"
          value={data.descriptionAr}
          onChange={(e) => update({ descriptionAr: e.target.value })}
          maxLength={5000}
          rows={4}
          placeholder={t("descriptionPlaceholder")}
        />
      </Field>

      {/* ── Category / subcategory ───────────────────────────────────────── */}
      <Field
        htmlFor="categoryId"
        label={t("categoryLabel")}
        error={errors.categoryId ? t(`errors.${errors.categoryId}`) : undefined}
        required
      >
        <select
          id="categoryId"
          className={SELECT_CLASS}
          value={data.categoryId}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          <option value="">{t("categoryPlaceholder")}</option>
          {categories.length === 0 ? (
            <option value="" disabled>
              {t("categoryEmpty")}
            </option>
          ) : (
            categories.map((c) => (
              <option key={c.id} value={c.id}>
                {catLabel(c)}
              </option>
            ))
          )}
        </select>
      </Field>

      {subcategoryOptions.length > 0 && (
        <Field htmlFor="subcategoryId" label={t("subcategoryLabel")}>
          <select
            id="subcategoryId"
            className={SELECT_CLASS}
            value={data.subcategoryId}
            onChange={(e) => update({ subcategoryId: e.target.value })}
          >
            <option value="">{t("subcategoryNone")}</option>
            {subcategoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {catLabel(c)}
              </option>
            ))}
          </select>
        </Field>
      )}

      {/* ── Price (fixed) ────────────────────────────────────────────────── */}
      <Field
        htmlFor="price"
        label={t("priceLabel")}
        error={errors.price ? t(`errors.${errors.price}`) : undefined}
        required
      >
        <Input
          id="price"
          type="number"
          min={0.01}
          step="0.01"
          inputMode="decimal"
          value={data.price}
          onChange={(e) => update({ price: e.target.value })}
          placeholder={t("pricePlaceholder")}
          dir="ltr"
        />
      </Field>

      {/* ── Shipping and prep ─────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="weightG" label={t("weightLabel")} hint={t("shippingHint")}>
          <Input
            id="weightG"
            type="number"
            min={1}
            step="1"
            inputMode="numeric"
            value={data.weightG}
            onChange={(e) => update({ weightG: e.target.value })}
            dir="ltr"
          />
        </Field>
        <Field htmlFor="lengthMm" label={t("lengthLabel")}>
          <Input
            id="lengthMm"
            type="number"
            min={1}
            step="1"
            inputMode="numeric"
            value={data.lengthMm}
            onChange={(e) => update({ lengthMm: e.target.value })}
            dir="ltr"
          />
        </Field>
        <Field htmlFor="widthMm" label={t("widthLabel")}>
          <Input
            id="widthMm"
            type="number"
            min={1}
            step="1"
            inputMode="numeric"
            value={data.widthMm}
            onChange={(e) => update({ widthMm: e.target.value })}
            dir="ltr"
          />
        </Field>
        <Field htmlFor="heightMm" label={t("heightLabel")}>
          <Input
            id="heightMm"
            type="number"
            min={1}
            step="1"
            inputMode="numeric"
            value={data.heightMm}
            onChange={(e) => update({ heightMm: e.target.value })}
            dir="ltr"
          />
        </Field>
        <Field htmlFor="prepDays" label={t("prepLabel")} hint={t("prepHint")}>
          <Input
            id="prepDays"
            type="number"
            min={0}
            step="1"
            inputMode="numeric"
            value={data.prepDays}
            onChange={(e) => update({ prepDays: e.target.value })}
            dir="ltr"
          />
        </Field>
      </div>

      {/* ── Stock ─────────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="stockQty" label={t("stockQtyLabel")} hint={t("stockQtyHint")}>
            <Input
              id="stockQty"
              type="number"
              min={0}
              step="1"
              inputMode="numeric"
              value={data.stockQty}
              onChange={(e) => update({ stockQty: e.target.value })}
              placeholder="0"
              dir="ltr"
            />
          </Field>
          <Field htmlFor="lowStockThreshold" label={t("lowStockThresholdLabel")} hint={t("lowStockThresholdHint")}>
            <Input
              id="lowStockThreshold"
              type="number"
              min={0}
              step="1"
              inputMode="numeric"
              value={data.lowStockThreshold}
              onChange={(e) => update({ lowStockThreshold: e.target.value })}
              placeholder="3"
              dir="ltr"
            />
          </Field>
          <div className="sm:col-span-2">
            <Toggle
              id="isMadeToOrder"
              label={t("isMadeToOrderLabel")}
              checked={data.isMadeToOrder}
              onCheckedChange={(v) => update({ isMadeToOrder: v })}
            />
          </div>
      </div>

      {/* ── Custom orders ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-md border border-border p-4">
        <Toggle
          id="acceptsCustomOrders"
          label={t("customOrderToggleLabel")}
          checked={data.acceptsCustomOrders}
          onCheckedChange={(v) => update({ acceptsCustomOrders: v })}
        />
        {data.acceptsCustomOrders && (
          <Textarea
            value={data.customOrderNotes}
            onChange={(e) => update({ customOrderNotes: e.target.value })}
            maxLength={2000}
            rows={2}
            placeholder={t("customOrderNotesPlaceholder")}
          />
        )}
      </div>

      {/* ── Tags ──────────────────────────────────────────────────────────── */}
      <Field
        htmlFor="tagDraft"
        label={t("tagsLabel")}
        hint={errors.tags ? undefined : t("tagsHint")}
        error={errors.tags ? t(`errors.${errors.tags}`) : undefined}
      >
        <div className="flex gap-2">
          <Input
            id="tagDraft"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            maxLength={30}
            placeholder={t("tagsPlaceholder")}
            disabled={data.tags.length >= MAX_TAGS}
          />
          <Button type="button" variant="outline" onClick={addTag} disabled={data.tags.length >= MAX_TAGS}>
            {t("tagsAdd")}
          </Button>
        </div>
        {data.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 pe-1.5">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  aria-label={t("tagsRemove", { tag })}
                  className="rounded-full p-0.5 hover:bg-background/50"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </Field>

      {/* ── Images (edit mode only — R-L02 needs a persisted listingId) ────── */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-foreground">{t("images.title")}</p>
        <p className="text-xs text-muted-foreground">{t("images.hint")}</p>
        {mode === "edit" ? (
          <ListingImagesField
            listingId={initial!.id}
            uid={uid}
            mediaBucket={mediaBucket}
            initialImages={initial!.images}
          />
        ) : (
          <Alert variant="info" message={t("images.needsDraftHint")} />
        )}
      </div>

      {/* ── Publish checklist ────────────────────────────────────────────── */}
      {unmet.length > 0 && (
        <Alert variant="warning" title={t("publishRequirementsTitle")}>
          <ul className="flex flex-col gap-1">
            {unmet.map((req) => (
              <li key={req}>
                {req === "payment_method" ? (
                  <>
                    {t("publishRequirement.payment_method")}{" "}
                    <Link href={routes.seller.storePayments} className="font-semibold underline underline-offset-4">
                      {t("paymentMethodLink")}
                    </Link>
                  </>
                ) : (
                  t(`publishRequirement.${req}`)
                )}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {formError && <Alert variant="destructive" message={formError} />}

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={busy}>
          {saving ? t("saving") : mode === "create" ? t("saveDraft") : t("saveChanges")}
        </Button>
        {canPublish && (
          <Button type="button" onClick={handlePublish} disabled={busy}>
            {publishing ? t("publishing") : t("publish")}
          </Button>
        )}
      </div>
    </div>
  );
}
