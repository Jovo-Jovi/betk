"use client";

/**
 * CheckoutForm — `/checkout` order-summary + address select-or-create +
 * delivery/deposit pickers + submit. Phase 07 / T03. COMPOSE-ONLY: composes
 * `AddressForm`/`AddressSelect`/`Alert` (components/shared) + `ui/select`/
 * `ui/button`/`ui/input` — zero shared/ui edits.
 *
 * Actions imported by FILE PATH, never the feature barrels (the barrels also
 * re-export `next/headers`-backed queries — the barrel-leak precedent).
 *
 * AMOUNTS are SERVER-COMPUTED (`context.amounts`, from `getCheckoutContext`) —
 * this component only DISPLAYS them, never recomputes money client-side.
 * Commission is absent from `context.amounts` entirely (E2) — there is nothing
 * to hide here because there is nothing to read.
 *
 * DEPOSIT PICKER (E1 — REG-62): only rails with a NON-EMPTY BETK handle are
 * offered. `context.paymentConfigMissing` (ALL 3 empty) disables the whole
 * submit affordance from first render — never a blank/broken panel.
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { routes } from "@/constants/routes";
import { createOrderFromInquiry } from "@/features/checkout/actions/createOrderFromInquiry";
import { createAddress } from "@/features/buyer-account/actions/createAddress";
import { AddressForm, AddressSelect, Alert, type AddressValue } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { GOVERNORATES } from "@/constants/governorates";
import type { CheckoutContext, DeliveryMethodInput, DepositMethodInput } from "@/features/checkout";
import type { AddressListItem } from "@/features/buyer-account";
import type { AppLocale } from "@/i18n/routing";

interface Props {
  context: CheckoutContext;
  initialAddresses: AddressListItem[];
  locale: AppLocale;
}

const DEPOSIT_METHODS: DepositMethodInput[] = ["instapay", "vodafone_cash", "orange_cash"];

const fmt = (n: number) => new Intl.NumberFormat("en-EG").format(n);

export function CheckoutForm({ context, initialAddresses, locale }: Props) {
  const t = useTranslations("checkout");
  const tDelivery = useTranslations("store.about.delivery.modes");
  const router = useRouter();

  // ── Address select-or-create ────────────────────────────────────────────
  const [addresses, setAddresses] = React.useState(initialAddresses);
  const [mode, setMode] = React.useState<"select" | "create">(
    initialAddresses.length > 0 ? "select" : "create",
  );
  const [selectedAddressId, setSelectedAddressId] = React.useState<string | undefined>(
    initialAddresses[0]?.id,
  );
  const [newAddress, setNewAddress] = React.useState<AddressValue>({});
  const [addressError, setAddressError] = React.useState<string | null>(null);
  const [savingAddress, setSavingAddress] = React.useState(false);

  const govOptions = React.useMemo(
    () => GOVERNORATES.map((g) => ({ value: g.value, labelAr: locale === "en" ? g.labelEn : g.labelAr })),
    [locale],
  );

  async function handleSaveAddress() {
    setAddressError(null);
    if (!newAddress.governorate || !newAddress.city?.trim() || !newAddress.addressLine?.trim()) {
      setAddressError(t("address.errors.required"));
      return;
    }
    setSavingAddress(true);
    try {
      const res = await createAddress({
        governorate: newAddress.governorate,
        city: newAddress.city.trim(),
        streetAddress: newAddress.addressLine.trim(),
        buildingNotes: newAddress.notes?.trim() || undefined,
      });
      if (res.ok) {
        const created: AddressListItem = {
          id: res.addressId,
          label: null,
          governorate: newAddress.governorate,
          city: newAddress.city.trim(),
          streetAddress: newAddress.addressLine.trim(),
          buildingNotes: newAddress.notes?.trim() || null,
          isDefault: false,
        };
        setAddresses((prev) => [created, ...prev]);
        setSelectedAddressId(created.id);
        setMode("select");
        setNewAddress({});
        return;
      }
      if (res.reason === "unauthenticated") {
        router.push(routes.auth.login);
        return;
      }
      if (res.reason === "blocked") {
        router.push("/blocked");
        return;
      }
      setAddressError(t("address.errors.saveFailed"));
    } finally {
      setSavingAddress(false);
    }
  }

  // ── Delivery method (REG-14 — the store's own enabled modes only) ───────
  const [deliveryMethod, setDeliveryMethod] = React.useState<DeliveryMethodInput | undefined>(
    context.availableDeliveryModes[0],
  );

  // ── Deposit method (only rails with a configured BETK handle) ───────────
  const configuredMethods = React.useMemo(
    () =>
      DEPOSIT_METHODS.filter((m) => {
        if (m === "instapay") return Boolean(context.handles.instapay);
        if (m === "vodafone_cash") return Boolean(context.handles.vodafoneCash);
        return Boolean(context.handles.orangeCash);
      }),
    [context.handles],
  );
  const [depositMethod, setDepositMethod] = React.useState<DepositMethodInput | undefined>(
    configuredMethods[0],
  );

  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  async function handleSubmit() {
    setFormError(null);
    if (!selectedAddressId) {
      setFormError(t("errors.addressRequired"));
      return;
    }
    if (!deliveryMethod) {
      setFormError(t("errors.deliveryRequired"));
      return;
    }
    if (!depositMethod) {
      setFormError(t("errors.depositRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await createOrderFromInquiry({
        inquiryId: context.inquiryId,
        addressId: selectedAddressId,
        deliveryMethod,
        depositMethod,
      });
      if (res.ok) {
        router.push(routes.buyer.checkoutConfirmation(res.orderId));
        return;
      }
      switch (res.reason) {
        case "unauthenticated":
          router.push(routes.auth.login);
          break;
        case "phone_required":
          router.push("/auth/phone");
          break;
        case "blocked":
          router.push("/blocked");
          break;
        case "already_converted":
          router.push(routes.buyer.checkoutConfirmation(res.existingOrderId));
          break;
        case "not_confirmed":
          router.push(routes.buyer.inboxThread(context.inquiryId));
          break;
        case "payment_config_missing":
          setFormError(t("deposit.configMissing.message"));
          break;
        default:
          setFormError(t("errors.generic"));
      }
    } catch {
      setFormError(t("errors.generic"));
    } finally {
      setSubmitting(false);
    }
  }

  const listingTitle =
    locale === "en" && context.listing?.titleEn ? context.listing.titleEn : context.listing?.titleAr;

  const submitDisabled = submitting || context.paymentConfigMissing;

  return (
    <div className="flex flex-col gap-6">
      {/* Order summary — SERVER-computed amounts only, commission never shown. */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
        <p className="font-display text-base font-bold text-foreground">{t("summary.title")}</p>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{listingTitle}</span>
          <span className="text-foreground">
            {t("summary.quantity")}: {context.quantity}
          </span>
        </div>
        <dl className="flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">{t("summary.subtotal")}</dt>
            <dd dir="ltr" className="font-mono text-foreground">{fmt(context.amounts.subtotal)} {t("summary.currency")}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">{t("summary.deliveryFee")}</dt>
            <dd dir="ltr" className="font-mono text-foreground">{fmt(context.amounts.deliveryFee)} {t("summary.currency")}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-1.5 font-bold">
            <dt className="text-foreground">{t("summary.total")}</dt>
            <dd dir="ltr" className="font-mono text-foreground">{fmt(context.amounts.total)} {t("summary.currency")}</dd>
          </div>
          <div className="flex items-center justify-between text-primary">
            <dt>{t("summary.depositNow")}</dt>
            <dd dir="ltr" className="font-mono">{fmt(context.amounts.deposit)} {t("summary.currency")}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">{t("summary.balanceOnDelivery")}</dt>
            <dd dir="ltr" className="font-mono text-foreground">{fmt(context.amounts.balance)} {t("summary.currency")}</dd>
          </div>
        </dl>
      </div>

      {/* Address select-or-create. */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
        <p className="font-display text-base font-bold text-foreground">{t("address.title")}</p>

        {mode === "select" && (
          <>
            {addresses.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("address.noAddresses")}</p>
            ) : (
              <AddressSelect
                addresses={addresses.map((a) => ({
                  id: a.id,
                  label: a.label ?? `${a.city}، ${GOVERNORATES.find((g) => g.value === a.governorate)?.[locale === "en" ? "labelEn" : "labelAr"] ?? a.governorate}`,
                  detail: a.streetAddress,
                }))}
                selectedId={selectedAddressId}
                onSelect={setSelectedAddressId}
              />
            )}
            <Button type="button" variant="outline" onClick={() => setMode("create")}>
              {t("address.addNew")}
            </Button>
          </>
        )}

        {mode === "create" && (
          <>
            <AddressForm
              value={newAddress}
              onChange={setNewAddress}
              onSubmit={handleSaveAddress}
              governorates={govOptions}
              submitting={savingAddress}
              labels={{ save: t("address.save") }}
            />
            {addressError && <Alert variant="destructive" message={addressError} />}
            {addresses.length > 0 && (
              <Button type="button" variant="ghost" onClick={() => setMode("select")} disabled={savingAddress}>
                {t("address.cancel")}
              </Button>
            )}
          </>
        )}
      </div>

      {/* Delivery method — REG-14, the store's own enabled modes only. */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
        <p className="font-display text-base font-bold text-foreground">{t("delivery.title")}</p>
        <Select value={deliveryMethod} onValueChange={(v) => setDeliveryMethod(v as DeliveryMethodInput)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {context.availableDeliveryModes.map((m) => (
              <SelectItem key={m} value={m}>
                {tDelivery(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Deposit method — only BETK rails that are actually configured (E1/REG-62). */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
        <p className="font-display text-base font-bold text-foreground">{t("deposit.title")}</p>
        {context.paymentConfigMissing ? (
          <Alert
            variant="warning"
            title={t("deposit.configMissing.title")}
            message={t("deposit.configMissing.message")}
          />
        ) : (
          <Select value={depositMethod} onValueChange={(v) => setDepositMethod(v as DepositMethodInput)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {configuredMethods.map((m) => (
                <SelectItem key={m} value={m}>
                  {t(`deposit.methods.${m}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {formError && <Alert variant="destructive" message={formError} />}

      <Button type="button" size="lg" onClick={handleSubmit} disabled={submitDisabled}>
        {submitting ? t("submitting") : t("submit")}
      </Button>
    </div>
  );
}
