/**
 * P09 T09. Share href is the configured origin plus a public route.
 * R-L16: type=service is not a discovery filter.
 */

import { afterEach, describe, expect, it } from "vitest";
import { searchListingsParamsSchema } from "@/validations/discovery";
import { publicListingShareUrl, publicStoreShareUrl } from "@/features/discovery/publicUrl";

const LISTING = "30e7879e-a811-4986-813a-38393f7274be";
const PREVIOUS = process.env.NEXT_PUBLIC_SITE_ORIGIN;

afterEach(() => {
  if (PREVIOUS === undefined) delete process.env.NEXT_PUBLIC_SITE_ORIGIN;
  else process.env.NEXT_PUBLIC_SITE_ORIGIN = PREVIOUS;
});

describe("public share URL (E3)", () => {
  it("joins the configured origin to the public listing and store routes", () => {
    process.env.NEXT_PUBLIC_SITE_ORIGIN = "https://betk.example/ignored";
    expect(publicListingShareUrl(LISTING, "ar")).toBe(`https://betk.example/listing/${LISTING}`);
    expect(publicListingShareUrl(LISTING, "en")).toBe(`https://betk.example/en/listing/${LISTING}`);
    expect(publicStoreShareUrl("north-shop", "ar")).toBe("https://betk.example/store/north-shop");
    expect(publicStoreShareUrl("north-shop", "en")).toBe("https://betk.example/en/store/north-shop");
  });

  it("returns null when the origin is missing or carries credentials", () => {
    delete process.env.NEXT_PUBLIC_SITE_ORIGIN;
    expect(publicListingShareUrl(LISTING, "ar")).toBeNull();
    process.env.NEXT_PUBLIC_SITE_ORIGIN = "https://user:secret@betk.example";
    expect(publicStoreShareUrl("north-shop", "ar")).toBeNull();
  });
});

describe("discovery service filter (R-L16)", () => {
  it("drops type=service and keeps a product filter", () => {
    const dropped = searchListingsParamsSchema.parse({ type: "service", q: "lamp" });
    expect(dropped.type).toBeUndefined();
    expect(dropped.q).toBe("lamp");
    expect(searchListingsParamsSchema.parse({ type: "product" }).type).toBe("product");
  });
});
