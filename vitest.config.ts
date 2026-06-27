import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Vitest config for BETK.
 *
 * Integration tests (e.g. tests/integration/rls.smoke.test.ts) run in a Node
 * environment and talk to the STAGING Supabase project over the network.
 *
 * Two aliases keep server-only modules importable inside the test runtime:
 *   • "@"          -> src/ (mirrors tsconfig "@/*" path)
 *   • "server-only" -> a no-op stub, so configs/env.ts and lib/supabase/service.ts
 *                      (which `import "server-only"`) can be imported in Node.
 *
 * .env.local + Zod-loader placeholders are wired in tests/setup/env.ts.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/setup/server-only.stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup/env.ts"],
    include: [
      "tests/**/*.{test,spec}.ts",
      "src/**/*.{test,spec}.ts",
      // Deno Edge Function unit tests (e.g. send-sms-hook) live colocated under
      // supabase/functions; their pure logic (lib.ts) is Node-importable.
      "supabase/functions/**/*.{test,spec}.ts",
    ],
    // Network-bound integration tests must not run concurrently against the
    // same shared staging project, and need generous timeouts.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
