"use client";

/**
 * P32. Status-only active ↔ sold_out. The button calls setListingSoldOut,
 * which writes no other column. F-P1 does not treat that transition as a
 * publish.
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { routes } from "@/constants/routes";
import { setListingSoldOut } from "@/features/listings/actions/setListingSoldOut";
import type { ListingRefusalCode } from "@/features/listings/publishRefusal";
import { Button } from "@/components/ui/button";

export function SoldOutToggle({
  listingId,
  status,
}: {
  listingId: string;
  status: string;
}) {
  const t = useTranslations("seller.listings.form");
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  if (status !== "active" && status !== "sold_out") return null;
  const soldOut = status === "sold_out";

  async function onClick() {
    setPending(true);
    try {
      const res = await setListingSoldOut({ listingId, soldOut: !soldOut });
      if (res.ok) {
        toast.success(soldOut ? t("markAvailableDone") : t("markSoldOutDone"));
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
      if (res.reason === "refused") {
        toast.error(t(`refusal.${res.code as ListingRefusalCode}`));
        return;
      }
      toast.error(t("availabilityFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onClick}>
      {soldOut ? t("markAvailable") : t("markSoldOut")}
    </Button>
  );
}
