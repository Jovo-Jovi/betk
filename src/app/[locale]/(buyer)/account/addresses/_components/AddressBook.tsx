"use client";

/**
 * P10 address book. Composes AddressForm, EmptyState, and ConfirmDialog.
 * The kit form still shows a name and a phone. Those values are not written.
 */

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AddressForm, type AddressValue } from "@/components/shared/AddressForm";
import { Alert } from "@/components/shared/Alert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorRetryCard } from "@/components/shared/ErrorRetryCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GOVERNORATES } from "@/constants/governorates";
import { createAddress } from "@/features/buyer-account/actions/createAddress";
import { deleteAddress } from "@/features/buyer-account/actions/deleteAddress";
import { setDefaultAddress } from "@/features/buyer-account/actions/setDefaultAddress";
import { updateAddress } from "@/features/buyer-account/actions/updateAddress";
import type { AddressListItem } from "@/features/buyer-account/queries/getOwnAddresses";
import type { AddressWriteReason } from "@/validations/address";
import { createAddressSchema } from "@/validations/address";
import { useRouter } from "@/i18n/navigation";
import { addressWriteInput } from "./addressWriteInput";

type Mode = { kind: "closed" } | { kind: "add" } | { kind: "edit"; id: string };

export function AddressPageError() {
  const t = useTranslations("addresses");
  const common = useTranslations("common");
  const router = useRouter();
  return (
    <ErrorRetryCard message={t("loadError")} retryLabel={common("retry")} onRetry={() => router.refresh()} />
  );
}

export function AddressBook({ addresses }: { addresses: AddressListItem[] }) {
  const t = useTranslations("addresses");
  const form = useTranslations("addresses.form");
  const locale = useLocale();
  const router = useRouter();
  const [rows, setRows] = useState(addresses);
  const [mode, setMode] = useState<Mode>({ kind: "closed" });
  const [label, setLabel] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);
  const [value, setValue] = useState<AddressValue>({});
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof AddressValue, string>>>({});
  const [labelError, setLabelError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setRows(addresses);
  }, [addresses]);

  const governorates = GOVERNORATES.map((item) => ({
    value: item.value,
    labelAr: locale === "ar" ? item.labelAr : item.labelEn,
  }));
  const governorateLabel = (valueKey: string) =>
    governorates.find((item) => item.value === valueKey)?.labelAr ?? valueKey;

  const noDefault = rows.length > 0 && rows.every((row) => !row.isDefault);
  const editing = mode.kind === "edit" ? rows.find((row) => row.id === mode.id) : undefined;
  const showMakeDefault =
    (mode.kind === "add" && rows.length > 0) || (mode.kind === "edit" && editing != null && !editing.isDefault);

  function openAdd() {
    setMode({ kind: "add" });
    setLabel("");
    setMakeDefault(false);
    setValue({ governorate: "cairo" });
    setFieldErrors({});
    setLabelError(null);
    setError(null);
  }

  function openEdit(address: AddressListItem) {
    setMode({ kind: "edit", id: address.id });
    setLabel(address.label ?? "");
    setMakeDefault(false);
    setValue({
      governorate: address.governorate,
      city: address.city,
      addressLine: address.streetAddress,
      notes: address.buildingNotes ?? "",
    });
    setFieldErrors({});
    setLabelError(null);
    setError(null);
  }

  function closeForm() {
    setMode({ kind: "closed" });
    setFieldErrors({});
    setLabelError(null);
  }

  function reasonMessage(reason: AddressWriteReason, kind: "save" | "delete"): string {
    if (reason === "invalid") return t("invalid");
    if (reason === "in_use") return t("inUse");
    return kind === "delete" ? t("deleteError") : t("saveError");
  }

  async function onSubmit(next: AddressValue) {
    if (mode.kind === "closed" || pending) return;
    const input = addressWriteInput(next, label, showMakeDefault && makeDefault);
    const parsed = createAddressSchema.safeParse(input);
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof AddressValue, string>> = {};
      let nextLabel: string | null = null;
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "governorate") nextErrors.governorate = t("invalid");
        else if (key === "city") nextErrors.city = t("invalid");
        else if (key === "streetAddress") nextErrors.addressLine = t("invalid");
        else if (key === "buildingNotes") nextErrors.notes = t("invalid");
        else if (key === "label") nextLabel = t("invalid");
      }
      setFieldErrors(nextErrors);
      setLabelError(nextLabel);
      return;
    }

    setPending(true);
    setError(null);
    const result =
      mode.kind === "add"
        ? await createAddress(parsed.data)
        : await updateAddress({ ...parsed.data, id: mode.id });
    setPending(false);
    if (!result.ok) {
      setError(reasonMessage(result.reason, "save"));
      return;
    }
    closeForm();
    router.refresh();
  }

  async function onSetDefault(id: string) {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await setDefaultAddress({ id });
    setPending(false);
    if (!result.ok) {
      setError(reasonMessage(result.reason, "save"));
      return;
    }
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteId || pending) return;
    setPending(true);
    setError(null);
    const result = await deleteAddress({ id: deleteId });
    setPending(false);
    setDeleteId(null);
    if (!result.ok) {
      setError(reasonMessage(result.reason, "delete"));
      return;
    }
    router.refresh();
  }

  return (
    <div data-slot="address-book" className="flex flex-col gap-6" aria-busy={pending}>
      {error ? (
        <div role="alert">
          <Alert variant="destructive" message={error} />
        </div>
      ) : null}

      {noDefault ? (
        <p data-slot="no-default" role="status" className="text-sm font-medium text-muted-foreground">
          {t("noDefault")}
        </p>
      ) : null}

      {rows.length === 0 && mode.kind === "closed" ? (
        <EmptyState message={t("empty")} hint={t("emptyHint")} action={{ label: t("add"), onClick: openAdd }} />
      ) : (
        <div className="flex flex-col gap-3">
          {mode.kind === "closed" ? (
            <Button type="button" className="w-fit" onClick={openAdd}>
              {t("add")}
            </Button>
          ) : null}
          {rows.map((address) => (
            <Card key={address.id} data-slot="address-card">
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-display text-base font-bold text-foreground">
                    {address.label?.trim() ? address.label : address.city}
                  </p>
                  {address.isDefault ? (
                    <span className="text-sm font-semibold text-primary">{t("defaultBadge")}</span>
                  ) : null}
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {address.streetAddress}
                  {" · "}
                  {address.city}
                  {" · "}
                  {governorateLabel(address.governorate)}
                </p>
                {address.buildingNotes ? (
                  <p className="text-sm text-muted-foreground">{address.buildingNotes}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {address.isDefault ? null : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => void onSetDefault(address.id)}
                    >
                      {t("setDefault")}
                    </Button>
                  )}
                  <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => openEdit(address)}>
                    {t("edit")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => setDeleteId(address.id)}
                  >
                    {t("delete")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {mode.kind === "closed" ? null : (
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <h2 className="font-display text-lg font-bold text-foreground">
              {mode.kind === "add" ? t("formAdd") : t("formEdit")}
            </h2>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="address-label" className="text-sm font-medium text-foreground">
                {t("label")}
              </label>
              <Input
                id="address-label"
                value={label}
                maxLength={50}
                disabled={pending}
                onChange={(event) => setLabel(event.target.value)}
              />
              {labelError ? <p className="text-xs text-destructive">{labelError}</p> : null}
            </div>
            {showMakeDefault ? (
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={makeDefault}
                  disabled={pending}
                  onChange={(event) => setMakeDefault(event.target.checked)}
                />
                {t("makeDefault")}
              </label>
            ) : null}
            <AddressForm
              value={value}
              onChange={setValue}
              onSubmit={(next) => void onSubmit(next)}
              governorates={governorates}
              errors={fieldErrors}
              submitting={pending}
              labels={{
                fullName: form("fullName"),
                phone: form("phone"),
                governorate: form("governorate"),
                city: form("city"),
                addressLine: form("addressLine"),
                notes: form("notes"),
                save: form("save"),
              }}
            />
            <Button type="button" variant="outline" disabled={pending} onClick={closeForm}>
              {t("cancel")}
            </Button>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title={t("deleteTitle")}
        message={t("deleteBody")}
        confirmLabel={t("confirmDelete")}
        cancelLabel={t("cancel")}
        destructive
        loading={pending}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
