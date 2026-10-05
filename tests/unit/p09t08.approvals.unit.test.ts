// @vitest-environment jsdom
/**
 * P49: food_social_url is http(s) only, and the queue page does not fetch it
 * or hand it to ProofViewer.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { foodArtefactsSchema, isHttpUrl } from "@/validations/sellerOnboarding";
import { SIGNED_URL_EXPIRY_SECONDS } from "@/features/seller-approval/docUrl";
import { FoodSocialLink } from "@/app/[locale]/(admin)/admin/sellers/approvals/_components/FoodSocialLink";

const repoRoot = resolve(__dirname, "../..");

afterEach(() => {
  cleanup();
});

describe("food_social_url", () => {
  it("rejects javascript: and accepts only http(s)", () => {
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(foodArtefactsSchema.safeParse({
      packagingPath: "uid/pack.png",
      labelPath: "uid/label.png",
      expiryPath: "uid/expiry.png",
      socialUrl: "javascript:alert(1)",
    }).success).toBe(false);
    expect(foodArtefactsSchema.safeParse({
      packagingPath: "uid/pack.png",
      labelPath: "uid/label.png",
      expiryPath: "uid/expiry.png",
      socialUrl: "https://example.invalid/food",
    }).success).toBe(true);
    expect(foodArtefactsSchema.safeParse({
      packagingPath: "uid/pack.png",
      labelPath: "uid/label.png",
      expiryPath: "uid/expiry.png",
      socialUrl: "http://example.invalid/food",
    }).success).toBe(true);
  });

  it("renders a link only for http(s)", () => {
    const plain = render(createElement(FoodSocialLink, { value: "javascript:alert(1)", label: "Social" }));
    expect(plain.container.querySelector("a")).toBeNull();
    expect(plain.container.textContent).toContain("javascript:alert(1)");
    plain.unmount();

    const linked = render(createElement(FoodSocialLink, { value: "https://example.invalid/food", label: "Social" }));
    const anchor = linked.container.querySelector("a");
    expect(anchor?.getAttribute("href")).toBe("https://example.invalid/food");
    expect(anchor?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("mints admin document URLs for 60 seconds and never feeds the social value to ProofViewer", () => {
    expect(SIGNED_URL_EXPIRY_SECONDS).toBe(60);
    const page = readFileSync(
      resolve(repoRoot, "src/app/[locale]/(admin)/admin/sellers/approvals/page.tsx"),
      "utf8",
    );
    expect(page).toContain("notFound()");
    expect(page).not.toContain("fetch(");
    expect(page).toContain("FoodSocialLink");
    const socialBranch = page.slice(page.indexOf("doc.socialUrl"));
    expect(socialBranch.startsWith("doc.socialUrl")).toBe(true);
    expect(socialBranch.indexOf("FoodSocialLink")).toBeLessThan(socialBranch.indexOf("ProofViewer"));
  });
});
