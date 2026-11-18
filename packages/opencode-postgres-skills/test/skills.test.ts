import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import type { SkillDefinition, SkillHost } from "../src/host.ts";
import { registerSkills } from "../src/skills.ts";

const dirs: string[] = [];

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "pg-skills-"));
  dirs.push(dir);
  return dir;
}

function write(path: string, contents: string): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, contents);
}

afterEach(() => {
  while (dirs.length > 0) {
    rmSync(dirs.pop() as string, { recursive: true, force: true });
  }
});

function fakeHost(): { host: SkillHost; added: SkillDefinition[] } {
  const added: SkillDefinition[] = [];
  const host: SkillHost = {
    skill: {
      transform: async (cb) => {
        cb({ add: (skill) => added.push(skill) });
      },
    },
  };
  return { host, added };
}

describe("registerSkills", () => {
  test("registers each vendored skill as a directory-form skill", async () => {
    const bundle = fixture();
    write(join(bundle, "skills/b/SKILL.md"), "---\nname: b\ndescription: B\n---\nbody b");
    write(join(bundle, "skills/a/SKILL.md"), "---\nname: a\ndescription: A\n---\nbody a");

    const { host, added } = fakeHost();
    const count = await registerSkills(host, bundle);

    expect(count).toBe(2);
    expect(added.map((skill) => skill.id)).toEqual(["a", "b"]);
    expect(added[0]).toEqual({
      id: "a",
      name: "a",
      description: "A",
      path: join(bundle, "skills/a/SKILL.md"),
      content: "body a",
    });
  });
});
