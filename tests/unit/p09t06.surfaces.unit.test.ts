// @vitest-environment jsdom
/**
 * Pack §8 row 8. P23 and P27 render no {delivery, pickup, remote} control.
 * The assertion is the DOM of the composed steps and the pickup form, not a
 * hydration-string search.
 *
 * E3: an empty legal version label does not render the version line.
 */

import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";
import { LegalNotice } from "@/app/[locale]/(public)/legal/_components/LegalNotice";
import { StepPickup } from "@/app/[locale]/(seller-onboarding)/seller/onboarding/_components/steps/StepPickup";
import { StepDocuments } from "@/app/[locale]/(seller-onboarding)/seller/onboarding/_components/steps/StepDocuments";
import { StepCategory } from "@/app/[locale]/(seller-onboarding)/seller/onboarding/_components/steps/StepCategory";
import { PickupAddressForm } from "@/app/[locale]/(seller)/seller/store/delivery/_components/PickupAddressForm";
import { emptyDocState, emptyWizardData, type CategoryOption } from "@/app/[locale]/(seller-onboarding)/seller/onboarding/_components/wizardShared";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => React.createElement("a", { href, className }, children),
}));

vi.mock("sonner", () => ({ toast: { success: () => undefined } }));

vi.mock("@/features/store-management/actions/updateStorePickup", () => ({
  updateStorePickup: async () => ({ ok: true }),
}));

afterEach(cleanup);

const MODES = new Set(["delivery", "pickup", "remote"]);

function assertNoModeControls(container: HTMLElement) {
  const controls = container.querySelectorAll(
    "input, button, select, textarea, [role='switch'], [role='checkbox']",
  );
  for (const el of Array.from(controls)) {
    const name = (el.getAttribute("name") ?? "").toLowerCase();
    const id = (el.getAttribute("id") ?? "").toLowerCase();
    const value = (el.getAttribute("value") ?? "").toLowerCase();
    expect(MODES.has(name), name).toBe(false);
    expect(MODES.has(value), value).toBe(false);
    expect(id.startsWith("mode-"), id).toBe(false);
  }
  expect(container.querySelector("[role='switch']")).toBeNull();
  expect(container.querySelector("[data-delivery-mode]")).toBeNull();
}

function wrap(node: React.ReactElement) {
  return React.createElement(NextIntlClientProvider, {
    locale: "en",
    messages: en,
    children: node,
  });
}

const categories: CategoryOption[] = [
  { id: "11111111-1111-4111-8111-111111111111", slug: "handmade", labelAr: "يدوي", labelEn: "Handmade", food: false },
  { id: "22222222-2222-4222-8222-222222222222", slug: "food-beverages", labelAr: "أغذية", labelEn: "Food", food: true },
];

describe("P09 T06 — no delivery-mode controls (pack §8)", () => {
  it("P23 pickup, categories, and documents have no mode control", () => {
    const data = emptyWizardData(2);
    data.governorate = "cairo";
    const update = () => undefined;

    const pickup = render(wrap(React.createElement(StepPickup, { data, update, errors: {} })));
    assertNoModeControls(pickup.container);

    const category = render(
      wrap(
        React.createElement(StepCategory, {
          data,
          update,
          errors: {},
          categories,
          categoryLimit: 2,
        }),
      ),
    );
    assertNoModeControls(category.container);

    const documents = render(
      wrap(
        React.createElement(StepDocuments, {
          front: emptyDocState,
          back: emptyDocState,
          foodUploads: { packaging: emptyDocState, label: emptyDocState, expiry: emptyDocState },
          onSelectFront: () => undefined,
          onSelectBack: () => undefined,
          onRetryFront: () => undefined,
          onRetryBack: () => undefined,
          onSelectFood: () => undefined,
          onRetryFood: () => undefined,
          foodChosen: true,
          foodCopy: {
            intro: en.seller.onboarding.food["food-v1"].intro,
            packagingLabel: "Packaging photo",
            packagingHint: "hint",
            labelLabel: "Label photo",
            labelHint: "hint",
            expiryLabel: "Expiry photo",
            expiryHint: "hint",
            socialLabel: "Social page URL",
            socialHint: "hint",
            socialPlaceholder: "https://",
          },
          socialUrl: "",
          onSocialUrl: () => undefined,
          agreementAccepted: false,
          onAgreement: () => undefined,
          errors: {},
        }),
      ),
    );
    assertNoModeControls(documents.container);
    expect(documents.getByRole("checkbox", { name: /seller agreement/i })).toBeTruthy();
    expect(documents.getByRole("link", { name: /seller agreement/i }).getAttribute("href")).toBe(
      "/legal/seller-agreement",
    );
  });

  it("P27 pickup form has no mode control", () => {
    const view = render(
      wrap(
        React.createElement(PickupAddressForm, {
          governorate: "cairo",
          city: "Nasr",
          streetAddress: "1 Street",
          buildingNotes: "",
        }),
      ),
    );
    assertNoModeControls(view.container);
    expect(view.container.querySelector("[data-slot='pickup-address']")).toBeTruthy();
  });
});

describe("P09 T06 E3 — empty legal version label", () => {
  const shared = {
    title: "Returns",
    pendingTitle: "Pending legal review",
    pendingBody: "The document text is not published yet.",
    versionCaption: "Version",
    readFailed: false,
    errorMessage: "error",
    retryLabel: "Try again",
  };

  it("does not render the version line when the label is empty", () => {
    const view = render(React.createElement(LegalNotice, { ...shared, versionLabel: "" }));
    expect(view.getByText("Pending legal review")).toBeTruthy();
    expect(view.container.querySelector("[data-slot='legal-version']")).toBeNull();
  });

  it("renders the version line when the label is set", () => {
    const view = render(React.createElement(LegalNotice, { ...shared, versionLabel: "STAGING-DRAFT-1" }));
    expect(view.getByText("Pending legal review")).toBeTruthy();
    expect(view.container.querySelector("[data-slot='legal-version']")?.textContent).toBe("STAGING-DRAFT-1");
  });
});
