import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import type { SkillDefinition, SkillHost } from "../src/host.ts";
import { registerSkills } from "../src/skills.ts";

const dirs: string[] = [];

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "skills-"));
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
    write(join(bundle, "skills/egm-b/SKILL.md"), "---\nname: egm-b\ndescription: B\n---\nbody b");
    write(join(bundle, "skills/egm-a/SKILL.md"), "---\nname: egm-a\ndescription: A\n---\nbody a");
    write(join(bundle, "skills/egm-a/references/note.md"), "ref");

    const { host, added } = fakeHost();
    const count = await registerSkills(host, bundle);

    expect(count).toBe(2);
    expect(added.map((s) => s.id)).toEqual(["egm-a", "egm-b"]);
    expect(added[0]).toEqual({
      id: "egm-a",
      name: "egm-a",
      description: "A",
      path: join(bundle, "skills/egm-a/SKILL.md"),
      content: "body a",
    });
  });

  test("returns zero when the bundle has no skills", async () => {
    const bundle = fixture();
    const { host, added } = fakeHost();
    expect(await registerSkills(host, bundle)).toBe(0);
    expect(added).toEqual([]);
  });
});
