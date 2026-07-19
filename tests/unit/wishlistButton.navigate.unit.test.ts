// @vitest-environment jsdom
/**
 * WishlistButton no-navigate — runtime DOM proof (STEP 0b, closes the T06
 * "proven structurally, no browser available" gap for REG-25's reconciliation).
 *
 * CD-DELTA-2 fixed the shared WishlistButton to call `stopPropagation()` +
 * `preventDefault()` in its own onClick, so a heart tap inside a card can never
 * bubble to the card's navigation handler (`ListingCardLink`'s `onClick` →
 * `router.push(routes.listing(id))`). T06 only argued this from the source; this
 * test dispatches a real click in jsdom and asserts the wrapping onClick (the
 * navigation stand-in) never fires while the toggle still does.
 *
 * Uses React.createElement (not JSX) so the file stays a `.ts` and is picked up
 * by the existing vitest `tests/**\/*.test.ts` include without a config change.
 */

import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { WishlistButton } from "@/components/shared/WishlistButton";

afterEach(cleanup);

describe("REG-25 STEP 0b — WishlistButton no-navigate (CD-DELTA-2 runtime proof)", () => {
  it("a heart click fires onToggle but does NOT bubble to the wrapping card onClick (navigation)", () => {
    // Stands in for ListingCard's card-level onClick = router.push(listing).
    const cardOnClick = vi.fn();
    const onToggle = vi.fn();

    const { getByRole } = render(
      React.createElement(
        "div",
        { onClick: cardOnClick },
        React.createElement(WishlistButton, { onToggle }),
      ),
    );

    fireEvent.click(getByRole("button"));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(true);
    // stopPropagation() held — the card's navigation onClick never fired.
    expect(cardOnClick).not.toHaveBeenCalled();
  });

  it("control: clicking the surrounding card DOES trigger the card onClick", () => {
    const cardOnClick = vi.fn();

    const { getByTestId } = render(
      React.createElement(
        "div",
        { onClick: cardOnClick, "data-testid": "card-body" },
        React.createElement("span", null, "card body"),
        React.createElement(WishlistButton, {}),
      ),
    );

    fireEvent.click(getByTestId("card-body"));
    expect(cardOnClick).toHaveBeenCalledTimes(1);
  });
});
