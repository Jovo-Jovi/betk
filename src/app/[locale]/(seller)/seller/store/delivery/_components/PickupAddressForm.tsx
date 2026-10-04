"use client";

/**
 * P27 pickup address. Input + Select. AddressForm also asks for a person's
 * name and phone, which are not columns of store_pickup_addresses, so it is
 * not composed here. No delivery, pickup, or remote mode control.
 */

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { GOVERNORATES } from "@/constants/governorates";
import { routes } from "@/constants/routes";
import { updateStorePickup } from "@/features/store-management/actions/updateStorePickup";
import { Alert } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "../../_components/Field";

interface Props {
  governorate: string;
  city: string;
  streetAddress: string;
  buildingNotes: string;
}

export function PickupAddressForm({ governorate, city, streetAddress, buildingNotes }: Props) {
  const t = useTranslations("seller.store");
  const locale = useLocale();
  const router = useRouter();
  const [gov, setGov] = React.useState(governorate);
  const [cityValue, setCityValue] = React.useState(city);
  const [street, setStreet] = React.useState(streetAddress);
  const [notes, setNotes] = React.useState(buildingNotes);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const govLabel = (g: (typeof GOVERNORATES)[number]) => (locale === "en" ? g.labelEn : g.labelAr);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await updateStorePickup({
        governorate: gov,
        city: cityValue,
        streetAddress: street,
        buildingNotes: notes.trim() === "" ? undefined : notes.trim(),
      });
      if (res.ok) {
        toast.success(t("delivery.saved"));
        router.refresh();
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
      if (res.reason === "mismatch") {
        setError(t("delivery.mismatch"));
        return;
      }
      setError(t("delivery.saveFailed"));
    } catch {
      setError(t("delivery.saveFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="flex flex-col gap-6" data-slot="pickup-address" onSubmit={handleSubmit} noValidate>
      <p className="text-sm text-muted-foreground">{t("delivery.intro")}</p>
      <Field htmlFor="pickupGovernorate" label={t("delivery.governorateLabel")} hint={t("delivery.governorateHint")} required>
        <Select value={gov || undefined} onValueChange={setGov}>
          <SelectTrigger id="pickupGovernorate">
            <SelectValue placeholder={t("delivery.governoratePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {GOVERNORATES.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {govLabel(g)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field htmlFor="pickupCity" label={t("delivery.cityLabel")} required>
        <Input id="pickupCity" value={cityValue} onChange={(e) => setCityValue(e.target.value)} maxLength={100} />
      </Field>
      <Field htmlFor="pickupStreet" label={t("delivery.streetLabel")} required>
        <Input id="pickupStreet" value={street} onChange={(e) => setStreet(e.target.value)} maxLength={2000} />
      </Field>
      <Field htmlFor="pickupNotes" label={t("delivery.notesLabel")} hint={t("delivery.notesHint")}>
        <Input id="pickupNotes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
      </Field>
      {error && <Alert variant="destructive" message={error} />}
      <Button type="submit" disabled={submitting}>
        {submitting ? t("delivery.saving") : t("delivery.save")}
      </Button>
    </form>
  );
}
