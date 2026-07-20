"use client";

/**
 * StoreProfileForm — Phase 04 / T06 (FR-SEL-4). Composes the kit + ui primitives
 * for the /seller/store profile settings form. No new styled DS components — a
 * genuinely new component/state → STOP-and-flag to Claude Design.
 *
 * MEDIA UPLOAD CONTRACT: avatar (≥200×200) + cover (≥1200×400) are validated
 * CLIENT-SIDE (undersized → rejected before upload), then uploaded to the MEDIA
 * bucket under the caller's OWN PREFIX (${uid}/…) via the authenticated browser
 * client (T01 media RLS: INSERT/UPDATE own-prefix). The resulting PUBLIC URL is
 * stored on stores.avatar_url / cover_url by the action. The public URL embeds
 * the seller's uid in its path — the accepted id-not-PII posture, not a leak.
 *
 * SLUG (R-S03 change-once): editable ONLY while slugLocked is false. The lock is
 * COSMETIC — the `updateStoreProfile` action re-checks slug_changed_at
 * server-side and rejects a spent change even if the client sends one. When
 * locked, the field renders disabled with a lock indicator. Availability
 * pre-check is UX-only (stores_public shows ACTIVE stores only); the action's
 * 23505 is authoritative (field-level "taken").
 */

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { GOVERNORATES } from "@/constants/governorates";
import { routes } from "@/constants/routes";
// Import the action directly (NOT the feature barrel) — the barrel also
// re-exports getOwnStore, whose @/lib/supabase/server import would leak
// next/headers into this client bundle (T04/T05 precedent).
import { updateStoreProfile } from "@/features/store-management/actions/updateStoreProfile";
import {
  AVATAR_MIN_DIMENSIONS,
  COVER_MIN_DIMENSIONS,
  meetsMinDimensions,
  type ImageDimensions,
} from "@/validations/storeProfile";
import { Alert, ImageUploader } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field, SELECT_CLASS } from "./Field";

const SLUG_RE = /^[a-z0-9-]+$/;
const UPLOAD_PROGRESS = 66; // Supabase JS gives no browser upload progress — nominal.
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

/** A bilingual category option (value = slug, stored as text per the schema). */
export interface CategoryOption {
  value: string;
  labelAr: string;
  labelEn: string;
}

export interface StoreFormValues {
  nameAr: string;
  nameEn: string;
  bioAr: string;
  slug: string;
  slugLocked: boolean;
  categoryPrimary: string;
  categorySecondary: string;
  governorate: string;
  city: string;
  minOrderEgp: string;
  avatarUrl: string;
  coverUrl: string;
}

type ErrCode = "required" | "invalid" | "taken" | "tooSmall" | "uploadFailed";
type FieldErrors = Partial<Record<keyof StoreFormValues, ErrCode>>;
type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid";
type ImgStatus = "idle" | "uploading" | "uploaded" | "error";

interface ImgState {
  status: ImgStatus;
  progress: number;
  previewUrl?: string;
  error?: ErrCode;
}

interface Props {
  /** Session-verified uid — the media own-prefix. */
  uid: string;
  /** Public media bucket name (from server env; not a secret). */
  mediaBucket: string;
  /** Bilingual category options (value = slug, stored as text). */
  categories: CategoryOption[];
  store: StoreFormValues;
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

function extFor(file: File): string {
  return MIME_EXT[file.type] ?? (file.name.split(".").pop() || "img").toLowerCase();
}

/** Decode the chosen image to read its natural dimensions (client-side gate). */
function readImageDimensions(file: File): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode"));
    };
    img.src = url;
  });
}

export function StoreProfileForm({ uid, mediaBucket, categories, store }: Props) {
  const t = useTranslations("seller.store");
  const locale = useLocale();
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);

  const [data, setData] = React.useState<StoreFormValues>(store);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [serverSlugTaken, setServerSlugTaken] = React.useState(false);
  const [slugStatus, setSlugStatus] = React.useState<SlugStatus>("idle");

  const [avatar, setAvatar] = React.useState<ImgState>({
    status: store.avatarUrl ? "uploaded" : "idle",
    progress: store.avatarUrl ? 100 : 0,
    previewUrl: store.avatarUrl || undefined,
  });
  const [cover, setCover] = React.useState<ImgState>({
    status: store.coverUrl ? "uploaded" : "idle",
    progress: store.coverUrl ? 100 : 0,
    previewUrl: store.coverUrl || undefined,
  });

  const catLabel = (c: CategoryOption) => (locale === "en" ? c.labelEn : c.labelAr);
  const govLabel = (g: (typeof GOVERNORATES)[number]) => (locale === "en" ? g.labelEn : g.labelAr);

  // Ensure the stored category value is always selectable, even if its category
  // was later deactivated (never silently drop the seller's saved choice).
  const primaryOptions = React.useMemo(() => {
    if (!data.categoryPrimary || categories.some((c) => c.value === data.categoryPrimary)) {
      return categories;
    }
    return [{ value: data.categoryPrimary, labelAr: data.categoryPrimary, labelEn: data.categoryPrimary }, ...categories];
  }, [categories, data.categoryPrimary]);

  const update = React.useCallback((patch: Partial<StoreFormValues>) => {
    setData((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(patch)) delete next[k as keyof StoreFormValues];
      return next;
    });
    if (patch.slug !== undefined) setServerSlugTaken(false);
  }, []);

  // ── Slug availability pre-check (debounced; best-effort; UX only) ────────────
  React.useEffect(() => {
    if (data.slugLocked) return;
    const slug = data.slug.trim();
    // Only check a REAL change (an unchanged slug is trivially "yours").
    if (slug === store.slug) {
      setSlugStatus("idle");
      return;
    }
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
  }, [data.slug, data.slugLocked, store.slug, supabase]);

  // ── Media upload → media bucket own-prefix (authenticated client) ────────────
  const uploadImage = React.useCallback(
    async (kind: "avatar" | "cover", file: File) => {
      const setState = kind === "avatar" ? setAvatar : setCover;
      const min = kind === "avatar" ? AVATAR_MIN_DIMENSIONS : COVER_MIN_DIMENSIONS;

      // 1) Client-side dimension gate — undersized is rejected before any upload.
      let dims: ImageDimensions;
      try {
        dims = await readImageDimensions(file);
      } catch {
        setState({ status: "error", progress: 0, error: "invalid" });
        return;
      }
      if (!meetsMinDimensions(dims, min)) {
        setState({ status: "error", progress: 0, error: "tooSmall" });
        return;
      }

      // 2) Upload to the caller's OWN prefix; store the resulting PUBLIC URL.
      const preview = URL.createObjectURL(file);
      setState((prev) => {
        if (prev.previewUrl && prev.previewUrl.startsWith("blob:")) URL.revokeObjectURL(prev.previewUrl);
        return { status: "uploading", progress: UPLOAD_PROGRESS, previewUrl: preview };
      });

      const path = `${uid}/${kind}-${Date.now()}.${extFor(file)}`;
      const { error: uploadError } = await supabase.storage
        .from(mediaBucket)
        .upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });

      if (uploadError) {
        setState((prev) => ({ ...prev, status: "error", progress: 0, error: "uploadFailed" }));
        return;
      }

      const { data: pub } = supabase.storage.from(mediaBucket).getPublicUrl(path);
      setState({ status: "uploaded", progress: 100, previewUrl: preview });
      update(kind === "avatar" ? { avatarUrl: pub.publicUrl } : { coverUrl: pub.publicUrl });
    },
    [supabase, mediaBucket, uid, update],
  );

  const onSelect = (kind: "avatar" | "cover") => (files: File[]) => {
    const file = files[0];
    if (!file) return;
    void uploadImage(kind, file);
  };

  // ── Client validation mirror of the Zod schema (server re-validates) ─────────
  const validate = React.useCallback((): FieldErrors => {
    const e: FieldErrors = {};
    if (data.nameAr.trim().length < 2) e.nameAr = "required";
    if (str(data.nameEn) !== undefined && data.nameEn.trim().length < 2) e.nameEn = "invalid";
    const slug = data.slug.trim();
    if (slug.length < 3 || slug.length > 50 || !SLUG_RE.test(slug)) e.slug = "invalid";
    if (serverSlugTaken) e.slug = "taken";
    if (!data.categoryPrimary) e.categoryPrimary = "required";
    if (!data.governorate) e.governorate = "required";
    const min = num(data.minOrderEgp);
    if (data.minOrderEgp.trim() !== "" && (min === undefined || min < 0)) e.minOrderEgp = "invalid";
    return e;
  }, [data, serverSlugTaken]);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    setErrors({});
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await updateStoreProfile({
        nameAr: data.nameAr.trim(),
        nameEn: str(data.nameEn),
        bioAr: str(data.bioAr),
        slug: data.slug.trim(),
        categoryPrimary: data.categoryPrimary,
        categorySecondary: str(data.categorySecondary),
        governorate: data.governorate,
        city: str(data.city),
        minOrderEgp: num(data.minOrderEgp),
        avatarUrl: str(data.avatarUrl),
        coverUrl: str(data.coverUrl),
      });

      if (res.ok) {
        toast.success(t("saved"));
        // Refresh so a spent slug now renders locked (server is authoritative).
        router.refresh();
        return;
      }
      switch (res.reason) {
        case "slug_taken":
          setServerSlugTaken(true);
          setErrors({ slug: "taken" });
          break;
        case "slug_locked":
          // The server rejected a change-once slug edit; lock the field to match.
          setData((prev) => ({ ...prev, slug: store.slug, slugLocked: true }));
          setFormError(t("slug.lockedError"));
          break;
        case "unauthenticated":
          router.push(routes.auth.login);
          break;
        case "blocked":
          router.push("/blocked");
          break;
        default:
          setFormError(t("saveFailed"));
      }
    } catch {
      setFormError(t("saveFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const slugFieldError = errors.slug ? t(`errors.${errors.slug}`) : undefined;

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
      {/* ── Identity ─────────────────────────────────────────────────────── */}
      <Field
        htmlFor="nameAr"
        label={t("nameArLabel")}
        error={errors.nameAr ? t(`errors.${errors.nameAr}`) : undefined}
        required
      >
        <Input
          id="nameAr"
          value={data.nameAr}
          onChange={(e) => update({ nameAr: e.target.value })}
          maxLength={100}
          placeholder={t("nameArPlaceholder")}
          dir="rtl"
        />
      </Field>

      <Field
        htmlFor="nameEn"
        label={t("nameEnLabel")}
        hint={t("nameEnHint")}
        error={errors.nameEn ? t(`errors.${errors.nameEn}`) : undefined}
      >
        <Input
          id="nameEn"
          value={data.nameEn}
          onChange={(e) => update({ nameEn: e.target.value })}
          maxLength={100}
          placeholder={t("nameEnPlaceholder")}
          dir="ltr"
        />
      </Field>

      <Field htmlFor="bioAr" label={t("bioLabel")} hint={t("bioHint")}>
        <Textarea
          id="bioAr"
          value={data.bioAr}
          onChange={(e) => update({ bioAr: e.target.value })}
          maxLength={200}
          rows={3}
          placeholder={t("bioPlaceholder")}
        />
      </Field>

      {/* ── Slug (change-once) ───────────────────────────────────────────── */}
      <Field
        htmlFor="slug"
        label={t("slug.label")}
        hint={slugFieldError ? undefined : data.slugLocked ? undefined : t("slug.hint")}
        error={slugFieldError}
        required
      >
        <Input
          id="slug"
          value={data.slug}
          onChange={(e) => update({ slug: e.target.value.toLowerCase() })}
          maxLength={50}
          placeholder={t("slug.placeholder")}
          dir="ltr"
          autoCapitalize="none"
          spellCheck={false}
          disabled={data.slugLocked}
        />
        {data.slugLocked ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" aria-hidden />
            {t("slug.locked")}
          </p>
        ) : (
          <>
            {!slugFieldError && slugStatus === "checking" && (
              <p className="text-xs text-muted-foreground">{t("slug.checking")}</p>
            )}
            {!slugFieldError && slugStatus === "available" && (
              <p className="text-xs text-success">{t("slug.available")}</p>
            )}
            {!slugFieldError && slugStatus === "taken" && (
              <p className="text-xs text-destructive">{t("slug.taken")}</p>
            )}
          </>
        )}
      </Field>

      {/* ── Category & location ──────────────────────────────────────────── */}
      <Field
        htmlFor="categoryPrimary"
        label={t("primaryLabel")}
        error={errors.categoryPrimary ? t(`errors.${errors.categoryPrimary}`) : undefined}
        required
      >
        <select
          id="categoryPrimary"
          className={SELECT_CLASS}
          value={data.categoryPrimary}
          onChange={(e) => update({ categoryPrimary: e.target.value })}
        >
          <option value="">{t("primaryPlaceholder")}</option>
          {primaryOptions.map((c) => (
            <option key={c.value} value={c.value}>
              {catLabel(c)}
            </option>
          ))}
        </select>
      </Field>

      <Field htmlFor="categorySecondary" label={t("secondaryLabel")} hint={t("secondaryHint")}>
        <select
          id="categorySecondary"
          className={SELECT_CLASS}
          value={data.categorySecondary}
          onChange={(e) => update({ categorySecondary: e.target.value })}
        >
          <option value="">{t("secondaryPlaceholder")}</option>
          {categories
            .filter((c) => c.value !== data.categoryPrimary)
            .map((c) => (
              <option key={c.value} value={c.value}>
                {catLabel(c)}
              </option>
            ))}
        </select>
      </Field>

      <Field
        htmlFor="governorate"
        label={t("governorateLabel")}
        error={errors.governorate ? t(`errors.${errors.governorate}`) : undefined}
        required
      >
        <select
          id="governorate"
          className={SELECT_CLASS}
          value={data.governorate}
          onChange={(e) => update({ governorate: e.target.value })}
        >
          <option value="">{t("governoratePlaceholder")}</option>
          {GOVERNORATES.map((g) => (
            <option key={g.value} value={g.value}>
              {govLabel(g)}
            </option>
          ))}
        </select>
      </Field>

      <Field htmlFor="city" label={t("cityLabel")}>
        <Input
          id="city"
          value={data.city}
          onChange={(e) => update({ city: e.target.value })}
          maxLength={100}
          placeholder={t("cityPlaceholder")}
        />
      </Field>

      <Field
        htmlFor="minOrderEgp"
        label={t("minOrderLabel")}
        hint={t("minOrderHint")}
        error={errors.minOrderEgp ? t(`errors.${errors.minOrderEgp}`) : undefined}
      >
        <Input
          id="minOrderEgp"
          type="number"
          inputMode="numeric"
          min={0}
          value={data.minOrderEgp}
          onChange={(e) => update({ minOrderEgp: e.target.value })}
          placeholder={t("minOrderPlaceholder")}
          dir="ltr"
        />
      </Field>

      {/* ── Media (avatar + cover) ───────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-foreground">{t("avatarLabel")}</p>
        <ImageUploader
          label={t("avatarUploadLabel")}
          hint={t("avatarHint")}
          files={avatar.previewUrl ? [avatar.previewUrl] : []}
          onFiles={onSelect("avatar")}
          uploading={avatar.status === "uploading"}
          progress={avatar.progress}
          error={avatar.error ? t(`errors.${avatar.error}`) : undefined}
        />
        {avatar.status === "uploaded" && <p className="text-xs text-success">{t("uploaded")}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-foreground">{t("coverLabel")}</p>
        <ImageUploader
          label={t("coverUploadLabel")}
          hint={t("coverHint")}
          files={cover.previewUrl ? [cover.previewUrl] : []}
          onFiles={onSelect("cover")}
          uploading={cover.status === "uploading"}
          progress={cover.progress}
          error={cover.error ? t(`errors.${cover.error}`) : undefined}
        />
        {cover.status === "uploaded" && <p className="text-xs text-success">{t("uploaded")}</p>}
      </div>

      {formError && <Alert variant="destructive" message={formError} />}

      <div className="flex items-center justify-between gap-3">
        <Button
          type="submit"
          disabled={submitting || avatar.status === "uploading" || cover.status === "uploading"}
        >
          {submitting ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
