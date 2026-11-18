import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
  name: string;
  version: string;
  engines: { node: string };
  publishConfig: { access: string };
  exports: Record<string, string>;
  files: string[];
  dependencies: Record<string, string>;
};

describe("@giljae/opencode-postgres-skills manifest", () => {
  test("declares the published identity", () => {
    expect(pkg.name).toBe("@giljae/opencode-postgres-skills");
    expect(pkg.version).toBe("0.0.1");
    expect(pkg.engines.node).toContain(">=22");
    expect(pkg.publishConfig.access).toBe("public");
  });

  test("pins the MCP dependency and ships the entry and vendor tree", () => {
    expect(pkg.dependencies["@microsoft/postgres-mcp"]).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.exports["."]).toBe("./src/index.ts");
    expect(pkg.files).toContain("vendor");
  });

  test("license and attribution notice ship with the package", () => {
    expect(existsSync(fileURLToPath(new URL("../LICENSE", import.meta.url)))).toBe(true);
    expect(existsSync(fileURLToPath(new URL("../NOTICE", import.meta.url)))).toBe(true);
  });
});
