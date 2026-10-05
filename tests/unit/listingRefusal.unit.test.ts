/**
 * P09 T07. A publish refusal is a stable code. The Postgres sentence is not
 * the value the action returns.
 */

import { describe, expect, it } from "vitest";
import { LISTING_REFUSAL_CODES, listingRefusalCode } from "@/features/listings/publishRefusal";

describe("listingRefusalCode", () => {
  it("maps each BETK code and the shipping check, longer codes first", () => {
    expect(listingRefusalCode("BETK_PREP_CAP_UNCONFIGURED")).toBe("BETK_PREP_CAP_UNCONFIGURED");
    expect(listingRefusalCode("BETK_PREP_CAP")).toBe("BETK_PREP_CAP");
    expect(listingRefusalCode("BETK_PRICE_BAND_UNCONFIGURED")).toBe("BETK_PRICE_BAND_UNCONFIGURED");
    expect(listingRefusalCode("BETK_PRICE_BAND")).toBe("BETK_PRICE_BAND");
    expect(
      listingRefusalCode('new row for relation "listings" violates check constraint "chk_active_listing_shipping"'),
    ).toBe("SHIPPING");
    for (const code of LISTING_REFUSAL_CODES) {
      if (code === "SHIPPING") continue;
      expect(listingRefusalCode(`ERROR:  ${code}`)).toBe(code);
    }
  });

  it("returns null when the database text is not a known refusal", () => {
    expect(listingRefusalCode("permission denied for table listings")).toBeNull();
    expect(listingRefusalCode(null)).toBeNull();
  });
});
