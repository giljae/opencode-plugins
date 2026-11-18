import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { installAgents } from "../src/install.ts";

const dirs: string[] = [];

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "install-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length > 0) {
    rmSync(dirs.pop() as string, { recursive: true, force: true });
  }
});

describe("installAgents", () => {
  test("creates the target directory and writes each agent file", () => {
    const target = join(fixture(), ".opencode", "agents");
    const written = installAgents(
      [
        { name: "egm.md", content: "orchestrator" },
        { name: "egm-zoom-out.md", content: "reviewer" },
      ],
      target,
    );

    expect(written).toEqual([join(target, "egm.md"), join(target, "egm-zoom-out.md")]);
    expect(readFileSync(join(target, "egm.md"), "utf8")).toBe("orchestrator");
    expect(readFileSync(join(target, "egm-zoom-out.md"), "utf8")).toBe("reviewer");
  });

  test("overwrites existing files so re-running updates them", () => {
    const target = join(fixture(), "agents");
    installAgents([{ name: "egm.md", content: "old" }], target);
    installAgents([{ name: "egm.md", content: "new" }], target);
    expect(readFileSync(join(target, "egm.md"), "utf8")).toBe("new");
  });
});
