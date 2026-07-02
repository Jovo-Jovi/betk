"use client";

/**
 * GoogleSignInButton — initiates Google OAuth redirect.
 *
 * Uses the browser Supabase client (anon key, RLS applies). The OAuth callback
 * route (`/auth/callback`) is T03 scope — NOT built here.
 *
 * Design system: Phase DS owns visuals — do NOT restyle.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createBrowserClient } from "@supabase/ssr";

export function GoogleSignInButton() {
  const t = useTranslations("auth.google");
  const tErrors = useTranslations("errors");
  const [isPending, setIsPending] = useState(false);
  const [errorAr, setErrorAr] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setIsPending(true);
    setErrorAr(null);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setErrorAr(tErrors("googleSignInFailed"));
      setIsPending(false);
    }
    // On success, the browser is redirected automatically — no further action needed.
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isPending}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background h-10 px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        aria-label={t("ariaLabel")}
      >
        {/* Google logo SVG (inline — no external asset fetch) */}
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
        >
          <path
            d="M17.64 9.2045c0-.638-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.6149z"
            fill="#4285F4"
          />
          <path
            d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.8591-3.0477.8591-2.3441 0-4.3282-1.5836-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z"
            fill="#34A853"
          />
          <path
            d="M3.964 10.71c-.18-.54-.2827-1.1168-.2827-1.71s.1027-1.17.2827-1.71V4.9582H.9573C.3477 6.1732 0 7.5482 0 9s.3477 2.8268.9573 4.0418L3.964 10.71z"
            fill="#FBBC05"
          />
          <path
            d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1632 6.6559 3.5795 9 3.5795z"
            fill="#EA4335"
          />
        </svg>
        <span>{isPending ? t("connecting") : t("continueLabel")}</span>
      </button>
      {errorAr && (
        <p className="text-sm text-destructive text-center" role="alert">
          {errorAr}
        </p>
      )}
    </div>
  );
}
