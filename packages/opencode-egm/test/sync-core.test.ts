import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

// Plain JS helper without type declarations.
// @ts-expect-error see scripts/lib/sync-core.mjs
import { buildManifest, listFiles, sha256File, verifyVendored } from "../../../scripts/lib/sync-core.mjs";

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
});
