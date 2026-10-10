import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Integration (local stack) only.
 *
 * The staging suite uses vitest.config.ts and `vitest run tests/integration`.
 * This config's global setup is the fresh-stack Guard G, not
 * tests/setup/residueGlobalSetup.ts.
 */
export default defineConfig({
  plugins: [react()],
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
    globalSetup: ["./tests/local-stack/guardG.ts"],
    setupFiles: ["./tests/setup/env.ts"],
    include: [
      "tests/local-stack/**/*.smoke.ts",
      "tests/integration/addressBook.p11t01.test.ts",
    ],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
