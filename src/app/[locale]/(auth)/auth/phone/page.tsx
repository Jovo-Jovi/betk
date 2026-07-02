/**
 * /auth/phone — phone-capture flow for authenticated phone-NULL (Google) users.
 *
 * Real URL: /auth/phone  (the `(auth)` route group is URL-invisible). This is
 * the destination of the "add phone to transact" affordance on /account (T05).
 *
 * FIRST LIVE CONSUMER + PROOF of requireVerifiedPhone() (T07): this page calls
 * the canonical gate to decide what to show, exercising every outcome:
 *   • gate passes (already has a verified phone) → nothing to capture →
 *     redirect to /account.
 *   • PhoneRequiredError → the expected path → render the capture form.
 *   • NotAuthenticatedError → redirect to /auth/login (returnUrl=/auth/phone).
 *   • UserDeactivatedError / UserNotActiveError (R-A05) → redirect to /blocked.
 *
 * The middleware classifies /auth/* as public, so this RSC self-guards via the
 * gate rather than relying on the protected-route middleware.
 *
 * RTL Arabic — Phase DS owns visual styling; Phase 02 / T07.
 */

import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  requireVerifiedPhone,
  PhoneRequiredError,
  NotAuthenticatedError,
  UserDeactivatedError,
  UserNotActiveError,
} from "@/features/auth";
import { PhoneCaptureForm } from "./_components/PhoneCaptureForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.phone");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function PhoneCapturePage() {
  let needsCapture = false;

  try {
    // The first live consumer of the canonical transaction gate.
    await requireVerifiedPhone();
    // No throw → the account already has a verified phone (+ passes R-A05);
    // nothing to capture. Fall through to the redirect below.
  } catch (err) {
    if (err instanceof PhoneRequiredError) {
      needsCapture = true;
    } else if (err instanceof NotAuthenticatedError) {
      redirect("/auth/login?returnUrl=%2Fauth%2Fphone" as Route);
    } else if (
      err instanceof UserDeactivatedError ||
      err instanceof UserNotActiveError
    ) {
      redirect("/blocked" as Route);
    } else {
      throw err;
    }
  }

  if (!needsCapture) {
    // requireVerifiedPhone() passed — user already has a verified phone.
    redirect("/account" as Route);
  }

  const t = await getTranslations("auth.phone");

  return (
    <div className="w-full max-w-sm flex flex-col gap-8">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <PhoneCaptureForm />
    </div>
  );
}
