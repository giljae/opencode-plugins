import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

// @ts-expect-error see scripts/lib/sync-core.mjs
import { verifyVendored } from "../../../scripts/lib/sync-core.mjs";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const vendorDir = join(packageRoot, "vendor", "postgres-skills");

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

describe("vendored postgres-skills tree", () => {
  test("matches UPSTREAM.json exactly", () => {
    expect(verifyVendored(vendorDir, manifest)).toEqual([]);
  });

  test("contains the three skills the plugin registers", () => {
    expect(manifest.files).toHaveProperty("skills/postgresql-best-practices/SKILL.md");
    expect(manifest.files).toHaveProperty("skills/pg-graph/SKILL.md");
    expect(manifest.files).toHaveProperty("skills/migrate-oracle-app/SKILL.md");
  });

  test("records the upstream version in the package manifest", () => {
    const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
      postgresSkills: { upstream: { ref: string; commit: string; version: string } };
    };
    expect(pkg.postgresSkills.upstream.commit).toBe(manifest.commit);
    expect(pkg.postgresSkills.upstream.version).toBe(manifest.version);
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
