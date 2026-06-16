# skill-zod-validator.md
**Owns:** schema validation patterns, form + API safety.  ← NEW

- One Zod schema per input boundary in `src/validations/<feature>.ts`. Server Actions and API routes parse with it FIRST; reject with field errors on failure.
- Mirror DB constraints: phone E.164; rating 1–5; payout amount ≥ 100 (R-O09); review body ≤ 500; ≤5 listing images / ≤3 review photos / ≤5 dispute evidence / ≤5 tags; price null iff `quote_only`; service listings omit stock (R-L09); slug URL-safe + unique-checked.
- Enums: reuse the literal unions from `constants/enums.ts` (mirroring C3 §2) so Zod, types, and DB agree.
- Keep Zod separate from generated DB types (Dev OS Step 5). Derive form types from schemas via `z.infer`.
- Coerce/normalize at the edge (trim, lowercase tags, normalize Arabic for search) before persisting.
