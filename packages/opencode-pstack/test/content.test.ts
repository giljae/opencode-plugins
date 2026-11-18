import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, test } from "vitest";

import { listAgents, listSkills, parseFrontmatter, readUpstreamManifest } from "../src/content.ts";

const realBundle = fileURLToPath(new URL("../vendor/pstack", import.meta.url));
const dirs: string[] = [];

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "pstack-content-"));
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

describe("parseFrontmatter", () => {
  test("returns flat scalar fields and strips the fences", () => {
    const parsed = parseFrontmatter("---\nname: tdd\n---\n# Body");
    expect(parsed.data).toEqual({ name: "tdd" });
    expect(parsed.body).toBe("# Body");
  });
});

describe("listSkills", () => {
  test("reads autoinvoke from disable-model-invocation", () => {
    const bundle = fixture();
    write(join(bundle, "skills/a/SKILL.md"), "---\nname: a\n---\nbody a");
    write(
      join(bundle, "skills/b/SKILL.md"),
      "---\nname: b\ndisable-model-invocation: true\n---\nbody b",
    );
    const skills = listSkills(bundle);
    expect(skills.map((skill) => [skill.id, skill.autoinvoke])).toEqual([
      ["a", true],
      ["b", false],
    ]);
  });

  test("reads the vendored bundle's 58 skills", () => {
    const skills = listSkills(realBundle);
    expect(skills).toHaveLength(58);
    expect(skills.map((skill) => skill.id)).toEqual(
      expect.arrayContaining(["statechart", "poteto-mode", "tdd"]),
    );
    expect(skills.find((skill) => skill.id === "poteto-mode")?.autoinvoke).toBe(false);
  });
});

describe("listAgents", () => {
  test("returns the two upstream agents and any model field", () => {
    const agents = listAgents(realBundle);
    expect(agents.map((agent) => agent.id).sort()).toEqual(["comment-sicko", "poteto-agent"]);
    expect(agents.find((agent) => agent.id === "poteto-agent")?.model).toBeTruthy();
  });
});

describe("readUpstreamManifest", () => {
  test("throws when UPSTREAM.json is missing", () => {
    expect(() => readUpstreamManifest(fixture())).toThrow(/UPSTREAM\.json/);
  });
});
