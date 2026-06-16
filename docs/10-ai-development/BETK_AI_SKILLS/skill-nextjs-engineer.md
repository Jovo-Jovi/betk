# skill-nextjs-engineer.md
**Owns:** App Router, Server Actions, RSC patterns.

- Default to Server Components; add `"use client"` only for interactivity (forms, threads, filters, optimistic UI). Keep client components small and leaf-level.
- Mutations = Server Actions (Zod → authz → mutate → `revalidatePath`/`revalidateTag` → typed result). No client-side DB writes.
- Route groups mirror auth gates: `(public)`, `(auth)`, `(buyer)`, `(seller)/seller`, `(admin)/admin`. `middleware.ts` enforces auth + role routing + suspended-user block.
- RTL-first: `dir="rtl"`, `lang="ar"`; use Tailwind logical utilities (`ps/pe/ms/me`); LTR islands for digits/refs. No raw left/right in shared components.
- Caching: homepage 60s, rating_aggregates 5-min (`CACHING_STRATEGY.md`); use `revalidateTag` keyed by store/listing on writes.
- Loading via `loading.tsx`/Suspense with skeletons; errors via `error.tsx` + `ErrorRetryCard`; not-found via `not-found.tsx`. Follow `UI_STATE_STANDARDS.md`.
