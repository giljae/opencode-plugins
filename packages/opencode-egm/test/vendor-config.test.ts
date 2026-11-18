import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, test } from "vitest";

// @ts-expect-error see scripts/lib/sync-core.mjs
import { loadVendorConfig } from "../../../scripts/lib/sync-core.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const dirs: string[] = [];

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "vendor-config-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length > 0) {
    rmSync(dirs.pop() as string, { recursive: true, force: true });
  }
});

describe("loadVendorConfig", () => {
  test("reads the EGM config", () => {
    const config = loadVendorConfig(join(repoRoot, "packages/opencode-egm"));
    expect(config.upstream.repo).toContain("elephant-goldfish-model");
    expect(config.upstream.trigger).toBe("release");
    expect(config.upstream.tagPrefix).toBe("v");
    expect(config.dest).toBe("vendor/egm");
    expect(config.manifestField).toBe("egm");
    expect(config.include.map((entry: { to: string }) => entry.to)).toEqual(
      expect.arrayContaining(["agents", "skills", "resources", "docs", "LICENSE"]),
    );
  });

  test("throws when the config is missing", () => {
    expect(() => loadVendorConfig(fixture())).toThrow(/vendor\.config\.json/);
  });

  test("throws when a trigger field is missing", () => {
    const dir = fixture();
    writeFileSync(
      join(dir, "vendor.config.json"),
      JSON.stringify({ upstream: { repo: "r" }, include: [{ from: "a", to: "a" }], dest: "v", manifestField: "x" }),
    );
    expect(() => loadVendorConfig(dir)).toThrow(/trigger/);
  });
});
