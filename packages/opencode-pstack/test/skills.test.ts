import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import type { SkillDefinition, SkillHost } from "../src/host.ts";
import { registerSkills } from "../src/skills.ts";

const bundle = fileURLToPath(new URL("../vendor/pstack", import.meta.url));

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
  test("registers all 58 skills with absolute paths and no frontmatter", async () => {
    const { host, added } = fakeHost();

    const count = await registerSkills(host, bundle);

    expect(count).toBe(58);
    expect(added).toHaveLength(58);
    for (const skill of added) {
      expect(skill.path.startsWith(bundle)).toBe(true);
      expect(skill.path.endsWith("SKILL.md")).toBe(true);
      // Frontmatter is stripped from the body (the body may mention the field).
      expect(skill.content.trimStart().startsWith("---")).toBe(false);
    }
    expect(added.find((skill) => skill.id === "tdd")?.content).toContain("# TDD Bug Fix");
  });

  test("keeps pstack's explicitly-invoked skills unadvertised", async () => {
    const { host, added } = fakeHost();
    await registerSkills(host, bundle);
    expect(added.find((skill) => skill.id === "poteto-mode")?.autoinvoke).toBe(false);
  });
});
