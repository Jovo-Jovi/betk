DRAFT — NOT LEGALLY REVIEWED — NOT FOR PUBLICATION.

# Seller agreement

These pages describe how the marketplace behaves. Blanks in square brackets are for counsel. They are not filled in here.

## 1. Who this is between

BETK and the seller. The public page can be read without an account. The acceptance is recorded when the seller submits onboarding, not from the public page alone.

<!-- cite: UI P68, P23; PRD R-G04, AC-AGR-3 -->

## 2. What the seller does

The seller prepares the goods after staff release the seller order. The seller does not accept or reject the order. The seller does not see the buyer’s name, phone, address, or city. The seller sees the order reference, the items, the preparation deadline, the goods subtotal, the commission, and the net.

<!-- cite: PRD R-O19, R-V02; UI §4.a -->

The seller’s pickup street is visible to that seller and to staff. Buyers do not see it. The public shop page shows governorate and city only.

<!-- cite: ERD §6.1 store_pickup_addresses; ADR-023; PRD R-V03 -->

## 3. Commission and payout

<!-- cite: PRD R-O27, R-O26, R-O29; ERD §6.4 -->

Commission is a single percentage of the goods subtotal. Delivery is not in that base. The percentage is [PIN: commission_rate_pct]. The stored zero is a placeholder, not a chosen rate.

The buyer has already paid 50% to BETK for the whole master order. The courier collects the other 50% of this seller order in cash and passes it to BETK.

<!-- cite: PRD R-O16, R-O20 -->

The seller’s balance is calculated when it is read. It is not a stored wallet. It is the goods subtotal, minus commission, minus the goods portion of refunds. A payout request cannot exceed what is still available. Staff send the payout manually to the seller’s own InstaPay, Vodafone Cash, or Orange Cash handle, and only after delivery plus [PIN: return_hold_hours].

## 4. Cancellation and escalation

<!-- cite: PRD R-E01 -->

The seller cannot cancel. Escalation to staff is the seller’s exit.

## 5. Food

<!-- cite: PRD R-S10; ERD §6.3 -->

If the seller chooses a food category, onboarding asks for photos of packaging, the label, and the expiry date, and for a social-media link that staff can see and the public shop page does not. Publishing food before food approval is refused. The requirements text is [PIN: food_requirements].

## 6. Acceptance

<!-- cite: PRD R-G04, R-G06; ERD §6.1 -->

Onboarding does not submit without an acceptance of the current seller agreement. The record stores the version, the time, the seller’s user id, and the status accepted, and may store an IP address and a browser string. A new version needs a new acceptance. A seller’s acceptance is not a substitute for a buyer’s acceptance. The version label is [PIN: agreement_seller_agreement_version].

## 7. Blanks

[COUNSEL: governing law]

[COUNSEL: venue]

[COUNSEL: liability]

[COUNSEL: notice]

[COUNSEL: fees]

[COUNSEL: tax]

[COUNSEL: terminology]
