# src/lib/

Low-level shared utilities and Supabase client factory.

## supabase/
| File | Purpose |
|---|---|
| `client.ts` | Browser Supabase client (`createBrowserClient` via `@supabase/ssr`) |
| `server.ts` | RSC/Server Action client (bound to `next/headers` cookies) |
| `service.ts` | Service-role client — **BYPASSES RLS**; server-only; never import in client code |
| `types.ts` | Generated via `supabase gen types typescript`; regenerate after every migration |

## utils.ts
General-purpose pure helpers (cn, formatPrice, formatDate, etc.). No business logic.

Feature folders map to UI Spec areas — see `src/features/README.md`.
