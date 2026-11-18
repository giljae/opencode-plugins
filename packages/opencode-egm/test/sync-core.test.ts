import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

// Plain JS helper without type declarations.
// @ts-expect-error see scripts/lib/sync-core.mjs
import { applyInclude, buildIncludePlan, buildManifest, listFiles, parseVersion, sha256File, verifyVendored } from "../../../scripts/lib/sync-core.mjs";

const dirs: string[] = [];

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "sync-core-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length > 0) {
    rmSync(dirs.pop() as string, { recursive: true, force: true });
  }
});

describe("sync-core", () => {
  test("sha256File hashes file bytes", () => {
    const dir = fixture();
    writeFileSync(join(dir, "a.txt"), "hello");
    expect(sha256File(join(dir, "a.txt"))).toBe(
      createHash("sha256").update("hello").digest("hex"),
    );
  });

  test("buildManifest sorts repo-relative POSIX keys", () => {
    const manifest = buildManifest({
      repo: "r",
      ref: "v1",
      commit: "c",
      fetchedAt: "t",
      files: { "b/x": "2", a: "1" },
    });
    expect(Object.keys(manifest.files)).toEqual(["a", "b/x"]);
  });

  test("listFiles returns nested POSIX paths in sorted order", () => {
    const dir = fixture();
    mkdirSync(join(dir, "sub"));
    writeFileSync(join(dir, "sub", "b.txt"), "b");
    writeFileSync(join(dir, "a.txt"), "a");
    expect(listFiles(dir)).toEqual(["a.txt", "sub/b.txt"]);
  });

  test("verifyVendored reports modified, missing, and unlisted files", () => {
    const dir = fixture();
    mkdirSync(join(dir, "sub"));
    writeFileSync(join(dir, "a.txt"), "a");
    writeFileSync(join(dir, "sub", "b.txt"), "b");
    const manifest = buildManifest({
      repo: "r",
      ref: "v1",
      commit: "c",
      fetchedAt: "t",
      files: {
        "a.txt": sha256File(join(dir, "a.txt")),
        "sub/b.txt": sha256File(join(dir, "sub", "b.txt")),
      },
    });
    expect(verifyVendored(dir, manifest)).toEqual([]);

    writeFileSync(join(dir, "a.txt"), "changed");
    writeFileSync(join(dir, "c.txt"), "extra");
    unlinkSync(join(dir, "sub", "b.txt"));
    expect(verifyVendored(dir, manifest).sort()).toEqual([
      "missing: sub/b.txt",
      "modified: a.txt",
      "unlisted: c.txt",
    ]);
  });

  test("verifyVendored ignores our own UPSTREAM.json", () => {
    const dir = fixture();
    writeFileSync(join(dir, "a.txt"), "a");
    const manifest = buildManifest({
      repo: "r",
      ref: "v1",
      commit: "c",
      fetchedAt: "t",
      files: { "a.txt": sha256File(join(dir, "a.txt")) },
    });
    writeFileSync(join(dir, "UPSTREAM.json"), "{}");
    expect(verifyVendored(dir, manifest)).toEqual([]);
  });

  test("parseVersion reads the version field and rejects malformed input", () => {
    expect(parseVersion('{"name":"x","version":"0.3.0"}')).toBe("0.3.0");
    expect(() => parseVersion("{}")).toThrow(/version/i);
    expect(() => parseVersion("not json")).toThrow();
  });

  test("buildIncludePlan returns the configured include list", () => {
    expect(buildIncludePlan({ include: [{ from: "plugin/skills", to: "skills" }] })).toEqual([
      { from: "plugin/skills", to: "skills" },
    ]);
    expect(() => buildIncludePlan({ include: [] })).toThrow(/include/i);
  });

  test("applyInclude maps source paths into the destination and hashes them", () => {
    const source = fixture();
    mkdirSync(join(source, "pkg", "skills", "a"), { recursive: true });
    writeFileSync(join(source, "pkg", "skills", "a", "SKILL.md"), "body");
    mkdirSync(join(source, "pkg", "docs", "site"), { recursive: true });
    writeFileSync(join(source, "pkg", "docs", "site", "x.md"), "skip");
    const dest = join(fixture(), "vendor");

    const files = applyInclude(source, dest, [{ from: "pkg/skills", to: "skills" }], [
      "pkg/docs/site",
    ]);

    expect(readFileSync(join(dest, "skills/a/SKILL.md"), "utf8")).toBe("body");
    expect(Object.keys(files)).toEqual(["skills/a/SKILL.md"]);
  });

  test("applyInclude throws when an included source path is missing", () => {
    const source = fixture();
    expect(() =>
      applyInclude(source, join(fixture(), "vendor"), [{ from: "nope", to: "nope" }], []),
    ).toThrow(/nope/);
  });
});
