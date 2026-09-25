# BETK — brief for Egyptian counsel

This note is a fact summary and a list of questions. It is not legal advice. It does not say that anything in the product is acceptable, sufficient, or free of a permission. Please answer the questions. Please do not treat this note as a finding.

An engineer prepared it from the product’s own specification and from a read-only look at the database shape. No customer records are included. No passwords, keys, or account numbers are included.

---

## Glossary

| Term in this note | Meaning |
|---|---|
| BETK | The marketplace operator. Buyers pay BETK. BETK later pays sellers. |
| Master order | One checkout. It belongs to one buyer, has one delivery address, and has one payment proof. |
| Seller order | One seller’s part of that checkout. A cart with three sellers produces three seller orders and three shipments. |
| Deposit | The first payment: half of (goods subtotal + delivery), paid once for the whole master order. |
| Balance | The other half, collected in cash when that shipment is delivered. |
| InstaPay | The only method the buyer uses for the deposit. It is a transfer to BETK’s own handle. |
| Cash on delivery | The balance. The courier collects it per shipment and is supposed to pass it to BETK. |
| Commission | A single percentage of the goods subtotal. Delivery is not included. The percentage is not chosen yet (the stored value is a placeholder zero). |
| Net | Goods subtotal, minus commission, minus the goods portion of any refund. |
| Payout | A manual payment from BETK to the seller’s own handle (InstaPay, Vodafone Cash, or Orange Cash), after a waiting period that follows delivery. |
| Return hold | That waiting period. The product has a settings key for it. The stored value is an engineering placeholder, not a business decision, and it is not part of the launch checklist that covers the InstaPay handle, the commission percentage, and the price band. |
| Proof | One screenshot of the InstaPay transfer, plus an optional transfer reference, attached to the master order. |
| Admin | A BETK staff user. One admin check confirms the deposit for every seller in that master order and releases those seller orders. The seller is not asked to accept. |
| Courier | The person or company who picks up the parcel and delivers it. The product forbids a courier login. How the courier is given the buyer’s name, phone, and address is not chosen. |
| Seller | The shop, including a person selling from home. The seller does not see the buyer’s name, phone, address, or city. |
| Acceptance record | A row the product plans to store: which document, which version, who accepted, when, status “accepted”, and optionally an IP address and a browser string. The table does not exist yet. |
| Version gate | Before an order can be completed, the buyer must already have accepted the current version of whichever documents are in the gate. Which of the four documents are in the gate is not decided. |
| Deactivate-only | Closing an account marks it closed and blocks login. The product does not delete the person and does not anonymise them. A column reserved for a future anonymisation time exists and is unused. |
| Live | The column or bucket exists in the staging database today. |
| Target | The column or table is specified and not created yet. |
| Unknown region | Nobody measured where that provider stores data. The word UNKNOWN below means that, and nothing else. |

Internal tracking numbers from the engineering register are not used in this note.

---

## What BETK is

BETK is an Arabic-first online marketplace aimed at buyers and sellers in Egypt. The interface is Arabic first, with an English version of the same pages. People talk to each other inside the app. A buyer is not given the seller’s phone number, and a seller is not given the buyer’s phone number or address.

There is no guest cart. A person needs an account before the first item can be added. Sign-in is a phone one-time code, or Google. There is no password. A verified phone is required before checkout, before becoming a seller, and before a payout. Whether it is also required before adding to the cart is not decided.

An account that is deactivated cannot sign in. That is the only closure the product implements.

---

## Money, in order

```text
Buyer
  │  one InstaPay transfer = 50% of (goods + delivery) for the whole order
  │  one screenshot
  ▼
BETK holds that money
  │  one staff check releases every seller’s part of the order
  ▼
Each seller prepares their own part
  │  the seller cannot cancel; they can only escalate to staff
  ▼
Courier delivers each shipment
  │  collects the other 50% in cash from the buyer
  │  passes that cash to BETK
  ▼
BETK pays the seller
     net of commission on the goods subtotal only
     only after delivery plus the return-hold setting
     only by a manual payout the seller requests
```

Custody, as the product defines it (not as a legal period):

1. From the proof upload until staff confirm the transfer (`confirmed_at`).
2. From that confirmation until delivery (`delivered_at`).
3. From delivery until a timestamp `payout_eligible_at`, which the product will set to delivery time plus the return-hold setting.
4. After that timestamp, a person still has to request the payout and staff still have to send it. There is no automatic payout and no stored wallet.

Other branches:

- The buyer can cancel only before uploading the proof. The system also cancels if no proof arrives before a payment window. That window’s length is not set. An empty value will refuse checkout rather than invent a length. A recommendation of 30 minutes exists in an older note and was deliberately not stored.
- If staff reject the proof, the order is cancelled, stock comes back, and if the transfer was actually received the product says a refund is triggered.
- After the deposit is confirmed, the buyer’s way out is a return, a refund, or a dispute, not cancellation. A cancellation that happens after a confirmed deposit is specified to trigger a refund.
- The seller can never cancel.
- A return does not put stock back automatically. The refund can be all or part of that seller’s goods. The goods portion and any delivery-fee portion are stored separately. The seller sees only the goods portion.
- A payout request cannot exceed the derived net. That cap is specified and not built yet. The payout table exists today.

The InstaPay handle the buyer would pay is empty in settings. The commission percentage is stored as zero, meaning “not configured”, not “zero commission as a decision”. The return-hold value is an engineering placeholder (the characters 48, hours), not a decision. Vodafone Cash and Orange Cash numbers for BETK are empty; those methods are not offered to the buyer. They remain ways BETK might pay a seller.

A custom price quote may be from the listed price up to twice that price, and it stays valid for 24 hours. Those two numbers are product decisions.

An earlier product note records that a different shape was presented and not chosen: a licensed payment provider would collect the money, and BETK would control release without holding the funds. That note says it is not legal advice. This brief does not treat it as an answer. It is why question 1 is first.

---

## Personal data, in short

The product stores, or plans to store:

- Phone number, and for Google sign-in an email that the sign-in system can hold. The marketplace user table has a phone column and no email column.
- Buyer name, governorate, and city. The buyer’s street address is in an address book and, on a future master order, as a snapshot (name, phone, governorate, city, street, building notes).
- Seller shop name, public governorate and city, and settlement handles. A future pickup street is visible to that seller and to staff, not to buyers.
- Photos of a national ID (front and back), stored as files. Food sellers will also be asked for packaging, label, and expiry photos and for a social-media link that only staff should see. Those food file types are specified and not created yet.
- One transfer screenshot and a transfer reference.
- Messages between buyer and seller, dispute text, return reasons, and review text. Public reviews are not supposed to show the buyer’s name or location.
- Optional IP address and browser string on the future acceptance record. The sign-in system already has session IP and browser columns. A separate unused session table in the marketplace schema can hold device information.
- Staff-only notes and an append-only history of order status. That history cannot be deleted by the product’s own rules.
- Files sit in two buckets: a private `docs` bucket (proofs and seller documents) and a `media` bucket marked public (shop and listing images). There is no delete rule on stored files.

Closing an account does not delete these. There is no anonymisation behaviour.

Who sees the buyer’s address: the buyer, and staff. The seller does not. The courier is meant to see name, phone, and address on a label, once a handoff exists. That handoff is not built and not chosen.

---

## Processors and regions

| Who | What they receive in the current code | Live call? | Data region |
|---|---|---|---|
| Supabase | The database, sign-in, and the file buckets above | Yes | UNKNOWN — human to confirm |
| Google | Sign-in. The app starts a Google sign-in. An email column exists on the sign-in system. | Yes | UNKNOWN — human to confirm |
| TorvoSMS | The phone number and a text message that contains the one-time code | Yes, in the SMS hook | UNKNOWN — human to confirm |
| PostHog | The user’s internal id, and event names. Autocapture of page content is switched off in code. Name, phone, and email are not in the identify call. | Yes | UNKNOWN — human to confirm |
| Sentry | The user’s internal id on error reports. The code does not set an email or a phone. Whether the product also sends an IP address is not pinned. | Yes | UNKNOWN — human to confirm |
| Resend | Intended: a recipient email. The send call is not written. | No | UNKNOWN — human to confirm |
| WhatsApp | Intended: a recipient phone and a template. The send call is not written. | No | UNKNOWN — human to confirm |
| A generic SMS helper | Intended: a phone and a text. The send call is not written. This is not the one-time-code hook. | No | UNKNOWN — human to confirm |
| Twilio | Named in a local config block that is switched off. | No | UNKNOWN — human to confirm |
| Bosta | A stub describes a shipment with both parties’ names, phones, and streets, and a cash amount. The call is not written. Bosta is not the chosen courier. | No | UNKNOWN — human to confirm |
| The future courier | Name, phone, and address on a label, plus the cash balance | Not built | UNKNOWN — human to confirm |
| The application host | The website itself. No region is written in the project file. | The host is not measured here | UNKNOWN — human to confirm |

UNKNOWN means this exercise did not measure the region. It does not mean the region is inside or outside Egypt.

---

## The ten questions

Please answer in the form asked. If an answer would force a change to who holds the money, who may sell, or what the product stores, say so in plain words. Do not draft the new product.

**1. Central Bank of Egypt.** Does BETK, holding the deposit and the cash that the courier passes back, for the stretches of time described above, need Central Bank of Egypt payment-services licensing [unverified — counsel to confirm], or must that money run through a licensed partner?

Answer as: proceed with BETK holding the funds; or hold only through a kind of partner you name; or stop this holding shape. This is the answer that can change the core model. The licensed-partner shape was presented to the product owner and was not selected.

**2. Cash collection.** May a courier who cannot log in to BETK collect the cash half on BETK’s behalf and pass it to BETK?

Answer yes or no, with any condition (a contract, a permission of the courier, or a different person collecting). Please do not choose the internal handoff method.

**3. Who sells, and who may cancel.** In the buyer terms, who should be named as the seller of the goods: BETK, or the shop? Can the product keep the rule that the shop can never cancel and can only escalate to staff?

Answer with those two points.

**4. Home-food sellers.** Can a person selling food from home be approved on packaging photos, a label photo, an expiry photo, and a social-media link that only staff see?

Answer yes or no. If no, name what is missing as advice, not as a new screen.

**5. Personal data and hosting.** May the data listed above be processed by the providers listed above, while every data region is still unknown, including where a provider is outside Egypt?

Answer with the facts you still need (which regions) and whether it is advisable to launch while those regions are unknown. Candidate registration duties: [unverified — counsel to confirm]. Please name them in your answer if they matter. They are not stated here.

**6. Identity images and erasure.** Someone asks for their data to be erased. The product can only deactivate the account. Identity images sit in a private bucket with no delete rule. Order history cannot be deleted. What should happen to (i) the identity images, (ii) the order history, and (iii) the rest of the account?

Answer keep, delete, or anonymise for each, and any period as your number.

**7. Click-accept.** Is a stored row — document name, version, user, time, status accepted, optional IP and browser — enough for acceptance at signup and for the seller’s onboarding signature? What should happen for people who already have accounts and no such row? Which of the four documents should block completion of an order?

Answer yes or no on the row. For old accounts, pick one: write the row with no new action; ask at the next sign-in; ask before the next order; or another form you name. For the gate, mark each document in or out. The product has not chosen.

**8. Returns.** The product does not restore stock when an item is returned. A refund can be partial. After the deposit is confirmed the buyer cannot cancel. The return window is not set (an empty value will refuse the request). Each shop can also type its own return text, and the product has not decided whether that text replaces, repeats, or sits beside the platform policy.

Please give a short map: buyer action, what happens to the money, what happens to the stock. And one label for the shop’s text versus the platform policy.

**9. Tax.** Commission and payouts go to sellers who may be informal. Is a tax step missing from that payout?

Answer “no tax step” or “a tax step is advised”, and name the step. Any rate is yours, not ours.

**10. Age.** What minimum age, if any, should the documents state? The profile has a name and a governorate. It has no birth date.

Answer with an age, or “no age statement”, and whether a birth-date field is advised.

---

## The four documents

Please write these four. Engineering will publish them on public pages and store the acceptance row described above. Engineering will not invent the legal wording.

1. **Buyer terms.** Facts to cover: the 50% InstaPay deposit and the single proof; the 50% cash balance per shipment; who holds the money along the timeline above; cancellation only before the proof; returns after confirmation; the seller cannot cancel; a quote is valid 24 hours and may be up to twice the listed price; the payment window is not set; the buyer does not see the commission.
2. **Seller agreement.** Facts to cover: commission is a percentage of the goods subtotal and the percentage is not set; payout to the seller’s own handle after delivery and the return hold; the seller never sees the buyer’s name, phone, or address; the seller cannot cancel; food photos and the staff-only social link; the pickup address is for staff and the courier.
3. **Return and refund policy.** Facts to cover: a return is requested on a delivered seller order with a reason and evidence; the seller can accept (refund) or reject (dispute, then staff); the refund can be partial; stock does not come back automatically; a confirmed deposit is not undone by buyer cancellation; the return window is unset; the shop’s own return text has no decided relationship to this policy.
4. **Privacy policy.** Facts to cover: the data list, the providers, the unknown regions, deactivate-only closure, identity images, the courier label, the analytics id, the SMS phone and code, and Google sign-in.

Periods, liability caps, governing law, venue, age, notice, and fees belong in your text. They are not decided in this note.

---

## What we are not asking

- We are not asking you to choose the courier company.
- We are not asking you to set the commission, the price band, the payment window, or the return hold.
- We are not asking you to add database tables or pages.
- We are not asking you to approve a draft as final wording. Separate skeleton drafts exist for engineers. They are full of blanks. They are not proposed clauses.
- We are not asking for a statement that the current build is in order.

---

## Disclaimer

This document is a description of how the software is specified to behave, plus questions. It is not legal advice. It does not answer whether any rule is met. Please treat every legal point as open until you answer it.
