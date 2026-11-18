import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const readme = readFileSync(join(packageRoot, "README.md"), "utf8");
const manifest = JSON.parse(
  readFileSync(join(packageRoot, "vendor", "postgres-skills", "UPSTREAM.json"), "utf8"),
) as { version: string };

describe("package README", () => {
  test("documents the plugin install from npm", () => {
    expect(readme).toContain("opencode plugin add @giljae/opencode-postgres-skills");
    expect(readme).toContain("https://www.npmjs.com/package/@giljae/opencode-postgres-skills");
  });

  test("names the three skills and the MCP server", () => {
    for (const skill of ["postgresql-best-practices", "pg-graph", "migrate-oracle-app"]) {
      expect(readme).toContain(skill);
    }
    expect(readme).toContain("postgres-mcp");
  });

  test("states requirements and the vendored version", () => {
    expect(readme).toContain("Node 22");
    expect(readme).toContain(manifest.version);
    expect(readme).toContain("2.0.11");
  });

  test("states MIT attribution and that it is unofficial", () => {
    expect(readme).toContain("MIT");
    expect(readme.toLowerCase()).toMatch(/not affiliated with.*endorsed by microsoft/);
  });
});
