#!/usr/bin/env node
// Vendor google/elephant-goldfish-model at a pinned ref into the package.
//
// Usage: node scripts/sync-upstream.mjs --ref <tag> [--dest <dir>]
//
// The vendor tree is generated: the destination is cleared before copying, so
// hand-edits are overwritten on the next sync (by design).

import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MANIFEST_FILE,
  WHITELIST,
  buildManifest,
  isExcluded,
  listFiles,
  sha256File,
} from "./lib/sync-core.mjs";

const REPO = "https://github.com/google/elephant-goldfish-model";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DEST = join(ROOT, "packages/opencode-egm/vendor/egm");
const PACKAGE_JSON = join(ROOT, "packages/opencode-egm/package.json");

function parseArgs(argv) {
  const args = { ref: undefined, dest: DEFAULT_DEST };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--ref") args.ref = argv[++i];
    else if (argv[i] === "--dest") args.dest = resolve(argv[++i]);
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!args.ref) throw new Error("--ref <tag> is required");
  return args;
}

function cloneAt(ref) {
  const tmp = mkdtempSync(join(tmpdir(), "egm-sync-"));
  execFileSync("git", ["clone", "--quiet", "--depth", "1", "--branch", ref, REPO, tmp], {
    stdio: "inherit",
  });
  const commit = execFileSync("git", ["-C", tmp, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const commitDate = execFileSync("git", ["-C", tmp, "show", "-s", "--format=%cI", "HEAD"], {
    encoding: "utf8",
  }).trim();
  return { tmp, commit, commitDate };
}

function copyWhitelist(sourceRoot, dest) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  for (const entry of WHITELIST) {
    const source = join(sourceRoot, entry);
    if (!existsSync(source)) continue;
    mkdirSync(dirname(join(dest, entry)), { recursive: true });
    cpSync(source, join(dest, entry), {
      recursive: true,
      filter: (candidate) =>
        !isExcluded(relative(sourceRoot, candidate).split(sep).join("/")),
    });
  }
}

function manifestFor(dest, ref, commit, fetchedAt) {
  const files = {};
  for (const rel of listFiles(dest)) {
    if (rel === MANIFEST_FILE) continue;
    files[rel] = sha256File(join(dest, rel));
  }
  return buildManifest({ repo: REPO, ref, commit, fetchedAt, files });
}

function updatePackageManifest(ref, commit) {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8"));
  pkg.egm = pkg.egm ?? {};
  pkg.egm.upstream = { repo: REPO, tag: ref, commit };
  writeFileSync(PACKAGE_JSON, `${JSON.stringify(pkg, null, 2)}\n`);
}

function main() {
  const { ref, dest } = parseArgs(process.argv.slice(2));
  const { tmp, commit, commitDate } = cloneAt(ref);
  try {
    copyWhitelist(tmp, dest);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  const manifest = manifestFor(dest, ref, commit, commitDate);
  writeFileSync(join(dest, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  updatePackageManifest(ref, commit);
  console.log(`synced ${ref} (${commit}) → ${dest}`);
  console.log(`${Object.keys(manifest.files).length} files`);
}

main();
