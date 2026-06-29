"use client";

/**
 * PhoneLoginForm — client component for /auth/login.
 *
 * Controlled form wired to the `sendOtp` Server Action via `useActionState`.
 * On success, stores the normalised E.164 phone in sessionStorage and
 * navigates to /auth/verify?phone=...&returnUrl=... so the verify page
 * can pre-fill the phone without a query-param round-trip.
 *
 * Design system: compose shadcn/ui + components/shared placeholders.
 * Phase DS owns all visual tokens — do NOT restyle here.
 */

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { sendOtp, type SendOtpResult } from "@/features/auth/actions/sendOtp";

interface Props {
  returnUrl: string;
}

const initialState: SendOtpResult = { success: false };

export function PhoneLoginForm({ returnUrl }: Props) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(sendOtp, initialState);

  useEffect(() => {
    if (state.success && state.normalizedPhone) {
      // Navigate to verify page, passing phone + returnUrl as query params.
      // The phone is E.164 — safe to put in a URL param; never logged by the page.
      const params = new URLSearchParams();
      params.set("phone", state.normalizedPhone);
      if (returnUrl && returnUrl !== "/") params.set("returnUrl", returnUrl);
      router.push(`/auth/verify?${params.toString()}` as Route);
    }
  }, [state.success, state.normalizedPhone, returnUrl, router]);

  return (
    <form action={formAction} className="flex flex-col gap-4 w-full">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="phone"
          className="text-sm font-medium text-foreground"
        >
          رقم الهاتف
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="tel"
          placeholder="01XXXXXXXXX"
          required
          disabled={isPending}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono ltr text-start"
          aria-describedby={state.errorAr ? "phone-error" : undefined}
          aria-invalid={!!state.errorAr}
        />
        {state.errorAr && (
          <p id="phone-error" className="text-sm text-destructive" role="alert">
            {state.errorAr}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-10 px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      >
        {isPending ? "جارٍ الإرسال…" : "إرسال الكود"}
      </button>
    </form>
  );
}
