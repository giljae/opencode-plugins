import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

// Plain JS helper without type declarations.
// @ts-expect-error see scripts/lib/sync-core.mjs
import { verifyVendored } from "../../../scripts/lib/sync-core.mjs";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const vendorDir = join(packageRoot, "vendor", "egm");

interface Manifest {
  repo: string;
  ref: string;
  commit: string;
  version: string;
  files: Record<string, string>;
}

const manifest = JSON.parse(
  readFileSync(join(vendorDir, "UPSTREAM.json"), "utf8"),
) as Manifest;

describe("vendored EGM tree", () => {
  test("matches UPSTREAM.json exactly", () => {
    expect(verifyVendored(vendorDir, manifest)).toEqual([]);
  });

  test("contains the reviewer personas and skills the plugin registers", () => {
    expect(manifest.files).toHaveProperty("agents/zoom_out.md");
    expect(manifest.files).toHaveProperty("skills/egm-review/SKILL.md");
  });

  test("excludes upstream host docs that describe the V1 task interface", () => {
    expect(manifest.files).not.toHaveProperty("docs/opencode.md");
  });

  test("records a pinned release tag in the package manifest", () => {
    const pkg = JSON.parse(
      readFileSync(join(packageRoot, "package.json"), "utf8"),
    ) as { egm: { upstream: { ref: string; commit: string; version: string } } };
    expect(pkg.egm.upstream.ref).toBe(manifest.ref);
    expect(pkg.egm.upstream.commit).toBe(manifest.commit);
    expect(pkg.egm.upstream.version).toBe(manifest.version);
    expect(manifest.ref).toMatch(/^v\d+\.\d+\.\d+$/);
  });
});
