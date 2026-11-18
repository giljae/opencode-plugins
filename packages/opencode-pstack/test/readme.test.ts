import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const readme = readFileSync(join(packageRoot, "README.md"), "utf8");
const manifest = JSON.parse(
  readFileSync(join(packageRoot, "vendor", "pstack", "UPSTREAM.json"), "utf8"),
) as { version: string };

describe("package README", () => {
  test("documents the plugin install from npm", () => {
    expect(readme).toContain("opencode plugin add @giljae/opencode-pstack");
    expect(readme).toContain("https://www.npmjs.com/package/@giljae/opencode-pstack");
  });

  test("documents the setup and the pstack-<skill> commands", () => {
    expect(readme).toContain("/pstack-setup");
    expect(readme).toContain("pstack-poteto-mode");
  });

  test("states that models come from the user's own OpenCode", () => {
    expect(readme.toLowerCase()).toMatch(/your own opencode|configured in .*opencode/);
    expect(readme).toContain("Node 22");
    expect(readme).toContain(manifest.version);
  });

  test("states MIT attribution and that it is unofficial", () => {
    expect(readme).toContain("MIT");
    expect(readme.toLowerCase()).toMatch(/not affiliated with.*endorsed by/);
  });

  test("explains what pstack is and gives a concrete, step-by-step setup", () => {
    expect(readme.toLowerCase()).toContain("what is pstack");
    expect(readme).toContain("bug-fix:");
    expect(readme).toContain(".opencode/pstack-models.md");
    expect(readme).toMatch(/1\./);
    expect(readme).toMatch(/2\./);
    expect(readme.toLowerCase()).toContain("troubleshooting");
  });
});
