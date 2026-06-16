# src/validations/

Zod schemas — one file per feature area (e.g. `auth.ts`, `checkout.ts`, `listings.ts`). Every Server Action and API route handler must import and parse its input schema from here before touching the DB (enforced by CI Zod-coverage gate in T13).

Naming convention: `<noun>Schema` (e.g. `createListingSchema`, `checkoutSchema`).

Feature folders map to UI Spec areas — see `src/features/README.md`.
