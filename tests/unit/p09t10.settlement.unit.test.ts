// @vitest-environment jsdom
/**
 * P29 settlement copy (REG-64) and the seller-console logo (REG-60).
 * cod_enabled stays on the form (REG-63).
 */

import * as React from "react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import { PaymentsSettingsForm } from "@/app/[locale]/(seller)/seller/store/payments/_components/PaymentsSettingsForm";
import { SellerChrome } from "@/app/[locale]/_components/SellerChrome";
import { hasPaymentMethod } from "@/features/listings/listingRules";

const repoRoot = process.cwd();

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const push = vi.hoisted(() => vi.fn());

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: () => undefined }),
}));

vi.mock("sonner", () => ({ toast: { success: () => undefined } }));

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/seller/store/payments",
  useRouter: () => ({ push, replace: () => undefined, refresh: () => undefined }),
}));

vi.mock("@/features/store-management/actions/updateStorePayments", () => ({
  updateStorePayments: async () => ({ ok: true as const }),
}));

afterEach(() => {
  cleanup();
  push.mockClear();
});

function renderPayments(locale: "en" | "ar") {
  const messages = locale === "en" ? en : ar;
  return render(
    React.createElement(NextIntlClientProvider, {
      locale,
      messages,
      children: React.createElement(PaymentsSettingsForm, { payments: { cod_enabled: true } }),
    }),
  );
}

describe("P29 settlement copy", () => {
  it("uses the settlement wording in English and keeps the COD toggle", () => {
    renderPayments("en");
    expect(
      screen.getByText(
        "These handles are where BETK pays you, after commission. Buyers pay BETK, not you. Do not enter them as secrets in any other field.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/shown to buyers/i)).toBeNull();
    expect(screen.queryByText(/checkout/i)).toBeNull();
    expect(screen.getByText("Cash on delivery")).toBeTruthy();
    expect(screen.getByRole("switch")).toBeTruthy();
  });

  it("uses the settlement wording in Arabic", () => {
    renderPayments("ar");
    expect(
      screen.getByText(
        "هذه الحسابات هي الوجهة التي تدفع إليها بيتك مستحقاتك بعد العمولة. المشترون يدفعون لبيتك، لا لك. لا تُدخلها ككلمات سر في أي حقل آخر.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/تُعرض للمشترين/)).toBeNull();
    expect(screen.getByText("الدفع عند الاستلام")).toBeTruthy();
  });

  it("still sends cod_enabled and does not treat it as the publish gate", () => {
    const form = readFileSync(
      `${repoRoot}/src/app/[locale]/(seller)/seller/store/payments/_components/PaymentsSettingsForm.tsx`,
      "utf8",
    );
    const schema = readFileSync(`${repoRoot}/src/validations/sellerOnboarding.ts`, "utf8");
    expect(form).toContain("cod_enabled: data.codEnabled");
    expect(schema).toContain("cod_enabled:");
    expect(hasPaymentMethod({ cod_enabled: true })).toBe(false);
    expect(hasPaymentMethod({ instapay_handle: "seller.handle" })).toBe(true);
  });
});

describe("REG-60 seller logo", () => {
  it("points the console logo at home", async () => {
    const user = userEvent.setup();
    render(
      React.createElement(NextIntlClientProvider, {
        locale: "en",
        messages: en,
        children: React.createElement(SellerChrome),
      }),
    );
    const logos = screen.getAllByRole("button", { name: "BETK" });
    expect(logos).toHaveLength(2);
    for (const logo of logos) {
      await user.click(logo);
    }
    expect(push).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenNthCalledWith(1, "/");
    expect(push).toHaveBeenNthCalledWith(2, "/");
  });
});
