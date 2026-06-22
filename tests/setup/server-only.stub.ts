// Test-only stub for the `server-only` package.
//
// The real `server-only` module throws when imported outside a React Server
// Component bundle. configs/env.ts and lib/supabase/service.ts import it as a
// guard; in the Vitest (Node) runtime we alias it to this no-op so those
// modules can be exercised by the integration harness.
export {};
