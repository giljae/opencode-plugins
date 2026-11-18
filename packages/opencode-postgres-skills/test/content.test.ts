import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, test } from "vitest";

import { listSkills, parseFrontmatter, readUpstreamManifest } from "../src/content.ts";

const realBundle = fileURLToPath(new URL("../vendor/postgres-skills", import.meta.url));
const dirs: string[] = [];

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "pg-content-"));
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
    const parsed = parseFrontmatter("---\nname: pg-graph\n---\n# Body");
    expect(parsed.data).toEqual({ name: "pg-graph" });
    expect(parsed.body).toBe("# Body");
  });
});

describe("listSkills", () => {
  test("lists one skill per directory containing SKILL.md", () => {
    const bundle = fixture();
    write(join(bundle, "skills/b/SKILL.md"), "---\nname: b\n---\nbody b");
    write(join(bundle, "skills/a/SKILL.md"), "---\nname: a\ndescription: A\n---\nbody a");
    write(join(bundle, "skills/support/references/note.md"), "ignore");

    const skills = listSkills(bundle);
    expect(skills.map((skill) => skill.id)).toEqual(["a", "b"]);
    expect(skills[0]?.description).toBe("A");
    expect(skills[0]?.body).toBe("body a");
    expect(skills[0]?.skillPath).toBe(join(bundle, "skills/a/SKILL.md"));
  });

  test("reads the vendored bundle's three skills", () => {
    expect(listSkills(realBundle).map((skill) => skill.id)).toEqual([
      "migrate-oracle-app",
      "pg-graph",
      "postgresql-best-practices",
    ]);
  });
});

describe("readUpstreamManifest", () => {
  test("throws when UPSTREAM.json is missing", () => {
    expect(() => readUpstreamManifest(fixture())).toThrow(/UPSTREAM\.json/);
  });
});
