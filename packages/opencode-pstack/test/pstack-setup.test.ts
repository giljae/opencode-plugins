import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { ROLES, type RoleModelMap } from "../src/models.ts";
import { applySetup, missingRoles, planSetup } from "../src/pstack-setup.ts";

const dirs: string[] = [];

function fixtureBundle(): string {
  const dir = mkdtempSync(join(tmpdir(), "pstack-bundle-"));
  dirs.push(dir);
  mkdirSync(join(dir, "agents"), { recursive: true });
  writeFileSync(
    join(dir, "agents", "poteto-agent.md"),
    "---\nname: poteto-agent\ndescription: delegate\n---\nbody",
  );
  writeFileSync(
    join(dir, "agents", "comment-sicko.md"),
    "---\nname: comment-sicko\ndescription: hater\n---\nbody",
  );
  return dir;
}

function workdir(): string {
  const dir = mkdtempSync(join(tmpdir(), "pstack-work-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length > 0) {
    rmSync(dirs.pop() as string, { recursive: true, force: true });
  }
});

const fullMap: RoleModelMap = Object.fromEntries(
  ROLES.map((role) => [role, { provider: "provider-a", model: "model-b" }]),
);

describe("planSetup", () => {
  test("lists exactly the given models, and nothing else", () => {
    const text = planSetup(
      [
        { provider: "provider-a", id: "model-b", variants: ["high"] },
        { provider: "provider-c", id: "model-d" },
      ],
      ".opencode/pstack-models.md",
    );
    expect(text).toContain("provider-a/model-b");
    expect(text).toContain("provider-c/model-d");
    expect(text).not.toContain("provider-z");
  });
});

describe("missingRoles", () => {
  test("reports unset roles rather than defaulting them", () => {
    expect(missingRoles({ "swarm workers": { provider: "p", model: "m" } })).toContain(
      "code, prose, judgment",
    );
    expect(missingRoles(fullMap)).toEqual([]);
  });
});

describe("applySetup", () => {
  test("writes the agents and the map", () => {
    const dir = workdir();
    const targetDir = join(dir, ".opencode", "agents");
    const mapPath = join(dir, ".opencode", "pstack-models.md");

    const written = applySetup(fullMap, { bundleDir: fixtureBundle(), targetDir, mapPath });

    expect(written).toContain(join(targetDir, "pstack.md"));
    expect(existsSync(mapPath)).toBe(true);
    expect(readFileSync(mapPath, "utf8")).toContain("swarm workers:");
  });

  test("refuses an incomplete map", () => {
    const dir = workdir();
    expect(() =>
      applySetup(
        { "swarm workers": { provider: "p", model: "m" } },
        {
          bundleDir: fixtureBundle(),
          targetDir: join(dir, "agents"),
          mapPath: join(dir, "map.md"),
        },
      ),
    ).toThrow(/No model chosen/);
  });
});
