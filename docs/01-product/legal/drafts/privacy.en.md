DRAFT — NOT LEGALLY REVIEWED — NOT FOR PUBLICATION.

# Privacy policy

These pages describe what the product stores and who receives it. Blanks in square brackets are for counsel. Regions that were not measured are written UNKNOWN. That word is not a claim about where the data sits.

## 1. Who this is about

Buyers, sellers, and staff of an Arabic-first marketplace aimed at Egypt. Closing an account marks it deactivated and blocks login. The product does not delete the person and does not anonymise them. A column for an anonymisation time exists and nothing writes it.

<!-- cite: OD-2 in MVP_SCOPE §4.1; UI P09, P79 -->

## 2. Data the product stores

<!-- cite: pack inventory method: information_schema 2026-09-23; ERD §6 and §8 for target fields -->

- Phone number on the marketplace user. Email can exist on the sign-in system. The marketplace user table has no email column.
- Buyer name, governorate, and city. Street address in the buyer’s address book.
- On a future master order: recipient name, phone, governorate, city, street, and building notes. Those columns are not in the database yet.
- Shop name, public governorate and city, and the seller’s payout handles. A future pickup street, visible to that seller and to staff, not to buyers.
- National-id images (front and back) in a private file bucket. Food sellers will be asked for packaging, label, and expiry photos and for a social-media link that staff see. Those food types are not in the database yet.
- One transfer screenshot and a transfer reference.
- Messages, dispute text, return reasons, and review text. A public review is not supposed to show the buyer’s name or location.
- Optional IP address and browser string on a future acceptance record. The sign-in system already has session IP and browser columns.
- Order-status history that the product’s rules do not delete. Staff notes in an append-only log.

Files: private bucket `docs` (proofs and seller documents) and bucket `media` (shop and listing images), which is marked public. Measured policies allow insert and select. There is no delete policy on stored files.

<!-- cite: storage.buckets and storage.objects policies, 2026-09-23 -->

## 3. Who can see the buyer’s address

<!-- cite: PRD R-V01, R-V02; ADR-024 -->

The buyer, and staff. Not the seller. A courier is meant to see the buyer’s name, phone, and address on a label. The courier has no login. How the label is handed over is not chosen.

## 4. Providers

| Provider | What the current code sends | Call is live? | Region |
|---|---|---|---|
| Supabase (database, sign-in, files) | The fields above | Yes | Database: Frankfurt, Germany (Amazon Web Services), by IP geolocation of the database host. The dashboard region code was not read. Sign-in and files: UNKNOWN — human to confirm. Same project; not measured separately. |
| Vercel | Runs the website and its server code, so it handles the requests that carry the data above | Yes | Server code: Frankfurt, Germany, read from the live deployment. Edge network locations: not measured. |
| Google | Sign-in. The app starts Google sign-in. | Yes | UNKNOWN — human to confirm |
| TorvoSMS | Phone number and a message that contains the one-time code | Yes | API host: Frankfurt, Germany (Hostinger), by DNS resolution and IP geolocation. Where the message text is stored: UNKNOWN — human to confirm. The provider has not stated that. |
| PostHog | Internal user id and event names. Page autocapture is off. | Yes | UNKNOWN — human to confirm. An EU-cloud project exists. The deployed host was not read. When that host is unset, the code default is the US host (`src/services/posthog.ts:17`). |
| Sentry | Internal user id on errors. Email and phone are not set in that call. | Yes | UNKNOWN — human to confirm. The data-region setting and the live host name were not read. |
| Resend | Intended recipient email. The send call is not written. | No | UNKNOWN — human to confirm |
| WhatsApp | Intended recipient phone. The send call is not written. | No | UNKNOWN — human to confirm |
| Courier | Name, phone, and address on a future label | Not built | UNKNOWN — human to confirm |

<!-- cite: src/services/posthog.ts:17; SentryProvider; send-sms-hook/lib.ts; resend.ts and whatsapp.ts stubs; human-reported regions 2026-09-25 -->

## 5. Messages

Buyer and seller messages stay in the app. The product does not offer the other party’s phone number as a contact button.

<!-- cite: UI §4.g -->

## 6. Acceptance

<!-- cite: PRD R-G05; UI P70; ERD §6.1 -->

This page can be read without an account. Whether completing an order requires accepting it is not decided. If it is included, the version label is [PIN: agreement_privacy_version]. A new version needs a new acceptance.

## 7. Blanks

[COUNSEL: governing law]

[COUNSEL: venue]

[COUNSEL: liability]

[COUNSEL: notice]

[COUNSEL: age]

[COUNSEL: time period]

[COUNSEL: fees]

[COUNSEL: terminology]
