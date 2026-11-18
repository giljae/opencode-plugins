import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
  name: string;
  version: string;
  license: string;
  exports: Record<string, string>;
  files: string[];
};

describe("@giljae/opencode-egm manifest", () => {
  test("declares the published identity", () => {
    expect(pkg.name).toBe("@giljae/opencode-egm");
    expect(pkg.version).toBe("0.0.1");
    expect(pkg.license).toBe("Apache-2.0");
  });

  test("ships the TypeScript entry point and the vendored tree", () => {
    expect(pkg.exports["."]).toBe("./src/index.ts");
    expect(pkg.files).toContain("vendor");
  });

  test("publishes publicly under the scoped name", () => {
    expect((pkg as { publishConfig?: { access?: string } }).publishConfig?.access).toBe("public");
  });

  test("license and attribution notice ship with the package", () => {
    const license = fileURLToPath(new URL("../LICENSE", import.meta.url));
    const notice = fileURLToPath(new URL("../NOTICE", import.meta.url));
    expect(existsSync(license)).toBe(true);
    expect(existsSync(notice)).toBe(true);
  });
});
