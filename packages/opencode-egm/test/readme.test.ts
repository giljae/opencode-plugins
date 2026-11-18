import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const readme = readFileSync(join(packageRoot, "README.md"), "utf8");
const manifest = JSON.parse(
  readFileSync(join(packageRoot, "vendor", "egm", "UPSTREAM.json"), "utf8"),
) as { ref: string };

describe("package README", () => {
  test("documents the plugin install and the agent install command", () => {
    expect(readme).toContain("opencode plugin add @giljae/opencode-egm");
    expect(readme).toContain("/egm-install-agents");
  });

  test("states the port is unofficial and not endorsed by Google", () => {
    expect(readme).toContain("unofficial port");
    expect(readme.toLowerCase()).toMatch(/not affiliated with.*endorsed by google/);
  });

  test("links upstream and records the vendored tag and verified OpenCode version", () => {
    expect(readme).toContain("https://github.com/google/elephant-goldfish-model");
    expect(readme).toContain(manifest.ref);
    expect(readme).toContain("2.0.11");
  });
});
