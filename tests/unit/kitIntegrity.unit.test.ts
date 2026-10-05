/**
 * Kit-integrity guard. Red on a modified file, an added file, and a removed
 * file. Green when the tree matches the manifest.
 */

import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { checkKitIntegrity, hashKitTree } from "../../scripts/check-kit-integrity.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "betk-kit-"));
  roots.push(root);
  mkdirSync(join(root, "src", "components", "ui"), { recursive: true });
  mkdirSync(join(root, "src", "components", "shared"), { recursive: true });
  return root;
}

function write(root: string, rel: string, body: string): void {
  writeFileSync(join(root, rel), body);
}

function fixture(root: string): void {
  write(root, "src/components/ui/a.tsx", "export const a = 1;\n");
  write(root, "src/components/shared/b.tsx", "export const b = 1;\n");
}

describe("kit integrity", () => {
  it("is green on a match", () => {
    const root = tempRoot();
    fixture(root);
    const expected = hashKitTree(root);
    expect(checkKitIntegrity(root, expected).problems).toEqual([]);
  });

  it("is red on a modified file", () => {
    const root = tempRoot();
    fixture(root);
    const expected = hashKitTree(root);
    write(root, "src/components/ui/a.tsx", "export const a = 2;\n");
    expect(checkKitIntegrity(root, expected).problems).toEqual(["changed src/components/ui/a.tsx"]);
  });

  it("is red on an added file", () => {
    const root = tempRoot();
    fixture(root);
    const expected = hashKitTree(root);
    write(root, "src/components/shared/c.tsx", "export const c = 1;\n");
    expect(checkKitIntegrity(root, expected).problems).toEqual([
      "added src/components/shared/c.tsx",
    ]);
  });

  it("is red on a removed file", () => {
    const root = tempRoot();
    fixture(root);
    const expected = hashKitTree(root);
    rmSync(join(root, "src", "components", "ui", "a.tsx"));
    expect(checkKitIntegrity(root, expected).problems).toEqual(["removed src/components/ui/a.tsx"]);
  });

  it("matches the committed manifest", () => {
    const manifest = JSON.parse(
      readFileSync(join(repoRoot, "docs", "00-design", "kit-manifest.json"), "utf8"),
    ) as { files: Record<string, string> };
    expect(checkKitIntegrity(repoRoot, manifest.files).problems).toEqual([]);
  });
});
