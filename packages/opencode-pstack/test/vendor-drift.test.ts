import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

// @ts-expect-error see scripts/lib/sync-core.mjs
import { verifyVendored } from "../../../scripts/lib/sync-core.mjs";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const vendorDir = join(packageRoot, "vendor", "pstack");

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

describe("vendored pstack tree", () => {
  test("matches UPSTREAM.json exactly", () => {
    expect(verifyVendored(vendorDir, manifest)).toEqual([]);
  });

  test("contains the skills and agents the plugin registers", () => {
    expect(manifest.files).toHaveProperty("skills/poteto-mode/SKILL.md");
    expect(manifest.files).toHaveProperty("skills/statechart/SKILL.md");
    expect(manifest.files).toHaveProperty("agents/poteto-agent.md");
    expect(manifest.files).toHaveProperty("agents/comment-sicko.md");
  });

  test("records the upstream version in the package manifest", () => {
    const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
      pstack: { upstream: { commit: string; version: string } };
    };
    expect(pkg.pstack.upstream.commit).toBe(manifest.commit);
    expect(pkg.pstack.upstream.version).toBe(manifest.version);
  });
});
