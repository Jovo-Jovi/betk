DRAFT — NOT LEGALLY REVIEWED — NOT FOR PUBLICATION.

# Buyer terms

These pages describe how the marketplace behaves. Blanks in square brackets are for counsel. They are not filled in here.

## 1. Who this is between

BETK runs an Arabic-first marketplace aimed at Egypt. The buyer needs an account before adding anything to the cart. Sign-in is a phone one-time code or Google. There is no password.

<!-- cite: MVP_SCOPE §8 N21; PRD R-A01; UI P08 -->

## 2. The order

One checkout creates one master order for the buyer and a separate seller order for each seller in the cart, each with its own shipment. The buyer sees one combined delivery amount, not a per-seller split, and does not see BETK’s commission.

<!-- cite: PRD R-O12, R-O13, R-K03, R-O28 -->

## 3. The first payment

<!-- cite: PRD R-O15, R-O16, R-O18; baseline §2.4; UI P16 -->

The buyer pays a deposit of 50% of (goods subtotal + delivery) for the whole master order, in one InstaPay transfer to BETK’s handle, with one screenshot and one optional transfer reference. Vodafone Cash and Orange Cash are not offered for this payment.

BETK’s InstaPay handle is [PIN: betk_instapay_handle].

Staff make one check of that screenshot. That check releases every seller order in the master. The seller is not asked to accept.

<!-- cite: PRD R-O19; ADR-021; ADR-022 -->

## 4. The second payment

<!-- cite: PRD R-O20, R-K06 -->

When a shipment is delivered, the courier collects the other 50% of that seller order in cash and passes it to BETK. Staff confirm that cash after it arrives.

## 5. How long BETK holds the money

The product’s clocks are: proof uploaded; staff confirmation (`confirmed_at`); delivery (`delivered_at`); then a payout-eligibility time equal to delivery plus [PIN: return_hold_hours]. A payout to the seller is manual and comes after that time. There is no stored wallet.

<!-- cite: ERD §6.2; PRD R-O29 -->

If no proof arrives before the payment window ends, the order is cancelled and stock is restored. The window length is [PIN: payment_window_minutes]. An empty value refuses checkout. It is not stored as a number in this draft.

<!-- cite: PRD R-O21; plan §8.2.5 -->

## 6. Cancellation

<!-- cite: baseline §2.6; PRD R-O22, R-O23, R-O24, R-E01 -->

The buyer can cancel only before uploading the proof. After staff confirm the deposit, the buyer’s exit is a return, a refund, or a dispute.

If staff reject the proof, the order is cancelled, stock is restored, and a refund is triggered if the transfer was taken.

The seller cannot cancel a seller order. The seller can escalate to staff.

## 7. Custom quotes

<!-- cite: MVP_SCOPE §8 N23 -->

A custom quote is valid for 24 hours. The quoted price sits in the band from the listed price up to 2× that price, and not below the listed price.

## 8. Acceptance

<!-- cite: PRD R-G01, R-G02, R-G06; UI P08, P67; ERD §6.1 -->

Creating the account is not finished until the buyer accepts the current buyer terms. The record stores the document, the version label, the user, the time, and the status accepted, and may store an IP address and a browser string. A new version needs a new acceptance. The current version label is [PIN: agreement_buyer_terms_version].

Which other documents also block completion of an order is not decided in this draft.

## 9. Blanks

[COUNSEL: governing law]

[COUNSEL: venue]

[COUNSEL: liability]

[COUNSEL: notice]

[COUNSEL: age]

[COUNSEL: fees]

[COUNSEL: time period]

[COUNSEL: terminology]
