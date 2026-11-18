import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { listAgents, listSkills, parseFrontmatter, readUpstreamManifest } from "../src/content.ts";

const dirs: string[] = [];

function fixture(name = "bundle"): string {
  const base = mkdtempSync(join(tmpdir(), "content-"));
  dirs.push(base);
  const dir = join(base, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeFile(path: string, contents: string): void {
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
    const parsed = parseFrontmatter("---\nname: egm-x\ndescription: Does x\n---\n# Body\ntext");
    expect(parsed.data).toEqual({ name: "egm-x", description: "Does x" });
    expect(parsed.body).toBe("# Body\ntext");
  });

  test("returns the whole document when there is no frontmatter", () => {
    expect(parseFrontmatter("# Body").data).toEqual({});
    expect(parseFrontmatter("# Body").body).toBe("# Body");
  });
});

describe("listSkills", () => {
  test("lists one skill per directory containing SKILL.md", () => {
    const bundle = fixture();
    writeFile(join(bundle, "skills/egm-b/SKILL.md"), "---\nname: egm-b\ndescription: B\n---\nbody b");
    writeFile(join(bundle, "skills/egm-a/SKILL.md"), "---\nname: egm-a\ndescription: A\n---\nbody a");
    writeFile(join(bundle, "skills/egm-a/references/note.md"), "ref");
    writeFile(join(bundle, "skills/not-a-skill/readme.md"), "ignore");

    const skills = listSkills(bundle);
    expect(skills.map((s) => s.id)).toEqual(["egm-a", "egm-b"]);
    expect(skills[0]?.name).toBe("egm-a");
    expect(skills[0]?.description).toBe("A");
    expect(skills[0]?.body).toBe("body a");
    expect(skills[0]?.skillPath).toBe(join(bundle, "skills/egm-a/SKILL.md"));
  });

  test("round-trips a path containing a space and non-ASCII characters", () => {
    const bundle = fixture("bundle ü nicode");
    writeFile(join(bundle, "skills/egm-x/SKILL.md"), "---\nname: egm-x\n---\nx");
    const [skill] = listSkills(bundle);
    expect(skill?.skillPath.startsWith(bundle)).toBe(true);
    expect(skill?.skillPath).toBe(join(bundle, "skills", "egm-x", "SKILL.md"));
  });
});

describe("listAgents", () => {
  test("ids come from frontmatter names and bodies omit frontmatter", () => {
    const bundle = fixture();
    writeFile(join(bundle, "agents/zoom_out.md"), "---\nname: egm-zoom-out\ndescription: Z\n---\npersona");
    writeFile(join(bundle, "agents/notes.txt"), "ignore");

    const agents = listAgents(bundle);
    expect(agents.map((a) => a.id)).toEqual(["egm-zoom-out"]);
    expect(agents[0]?.name).toBe("egm-zoom-out");
    expect(agents[0]?.description).toBe("Z");
    expect(agents[0]?.body).toBe("persona");
    expect(agents[0]?.file).toBe(join(bundle, "agents/zoom_out.md"));
  });
});

describe("readUpstreamManifest", () => {
  test("throws when UPSTREAM.json is missing", () => {
    const bundle = fixture();
    expect(() => readUpstreamManifest(bundle)).toThrow(/UPSTREAM\.json/);
  });

  test("throws when the manifest is malformed", () => {
    const bundle = fixture();
    writeFile(join(bundle, "UPSTREAM.json"), JSON.stringify({ repo: "r" }));
    expect(() => readUpstreamManifest(bundle)).toThrow(/malformed/i);
  });

  test("parses a valid manifest", () => {
    const bundle = fixture();
    writeFile(
      join(bundle, "UPSTREAM.json"),
      JSON.stringify({ repo: "r", ref: "v1", commit: "c", fetchedAt: "t", files: {} }),
    );
    expect(readUpstreamManifest(bundle).commit).toBe("c");
  });
});
