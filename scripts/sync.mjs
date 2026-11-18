#!/usr/bin/env node
// Vendor an upstream repository into a plugin package, driven by that
// package's vendor.config.json.
//
// Usage: node scripts/sync.mjs --plugin <package-dir> [--check] [--force]
//
// The vendor tree is generated: the destination is cleared before copying, so
// hand-edits are overwritten on the next sync (by design).

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MANIFEST_FILE,
  applyInclude,
  buildManifest,
  loadVendorConfig,
  parseVersion,
} from "./lib/sync-core.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function git(args, options = {}) {
  return execFileSync("git", args, { encoding: "utf8", ...options });
}

function parseArgs(argv) {
  const args = { plugin: undefined, check: false, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--plugin") args.plugin = resolve(argv[++i]);
    else if (argv[i] === "--check") args.check = true;
    else if (argv[i] === "--force") args.force = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!args.plugin) throw new Error("--plugin <dir> is required");
  return args;
}

function compareVersions(a, b) {
  const split = (value) => value.split(/[.-]/).map((part) => (/^\d+$/.test(part) ? Number(part) : part));
  const pa = split(a);
  const pb = split(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x === y) continue;
    return x < y ? -1 : 1;
  }
  return 0;
}

function latestReleaseTag(repo, prefix) {
  const out = git(["ls-remote", "--tags", repo]);
  const versions = out
    .split("\n")
    .map((line) => line.split("\t")[1])
    .filter(Boolean)
    .map((ref) => ref.replace("refs/tags/", ""))
    .filter((tag) => !tag.endsWith("^{}") && tag.startsWith(prefix))
    .map((tag) => tag.slice(prefix.length));
  if (versions.length === 0) {
    throw new Error(`No release tags matching ${prefix}* in ${repo}`);
  }
  versions.sort(compareVersions);
  return `${prefix}${versions.at(-1)}`;
}

function clone(repo, refOrBranch) {
  const tmp = mkdtempSync(join(tmpdir(), "sync-"));
  git(["clone", "--quiet", "--depth", "1", "--branch", refOrBranch, repo, tmp], {
    stdio: "inherit",
  });
  return tmp;
}

function resolveTrigger(upstream) {
  const { repo, trigger } = upstream;
  if (trigger === "release") {
    const prefix = upstream.tagPrefix ?? "";
    const tag = latestReleaseTag(repo, prefix);
    const tmp = clone(repo, tag);
    const commit = git(["-C", tmp, "rev-parse", "HEAD"]).trim();
    const commitDate = git(["-C", tmp, "show", "-s", "--format=%cI", "HEAD"]).trim();
    return { ref: tag, commit, commitDate, version: tag.slice(prefix.length), tmp };
  }
  if (trigger === "versionFile") {
    const branch = upstream.branch ?? "main";
    const tmp = clone(repo, branch);
    const commit = git(["-C", tmp, "rev-parse", "HEAD"]).trim();
    const commitDate = git(["-C", tmp, "show", "-s", "--format=%cI", "HEAD"]).trim();
    const version = parseVersion(git(["-C", tmp, "show", `HEAD:${upstream.versionFile}`]));
    return { ref: branch, commit, commitDate, version, tmp };
  }
  throw new Error(`Unknown trigger: ${trigger}`);
}

function readRecorded(packageJsonPath, manifestField) {
  try {
    return JSON.parse(readFileSync(packageJsonPath, "utf8"))?.[manifestField]?.upstream ?? null;
  } catch {
    return null;
  }
}

function main() {
  const { plugin, check, force } = parseArgs(process.argv.slice(2));
  const config = loadVendorConfig(plugin);
  const packageJsonPath = join(plugin, "package.json");
  const dest = join(plugin, config.dest);
  const resolved = resolveTrigger(config.upstream);
  try {
    const recorded = readRecorded(packageJsonPath, config.manifestField);
    const changed = force || !recorded || recorded.commit !== resolved.commit;
    if (check) {
      console.log(
        JSON.stringify({
          plugin,
          name: JSON.parse(readFileSync(packageJsonPath, "utf8")).name,
          changed,
          ref: resolved.ref,
          commit: resolved.commit,
          version: resolved.version,
        }),
      );
      return;
    }
    if (!changed) {
      console.log(`unchanged: ${plugin} at ${resolved.ref} (${resolved.commit})`);
      return;
    }
    const files = applyInclude(resolved.tmp, dest, config.include, config.exclude);
    const manifest = buildManifest({
      repo: config.upstream.repo,
      ref: resolved.ref,
      commit: resolved.commit,
      version: resolved.version,
      fetchedAt: resolved.commitDate,
      files,
    });
    writeFileSync(join(dest, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    pkg[config.manifestField] = pkg[config.manifestField] ?? {};
    pkg[config.manifestField].upstream = {
      repo: config.upstream.repo,
      ref: resolved.ref,
      commit: resolved.commit,
      version: resolved.version,
    };
    writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
    console.log(`synced ${plugin} → ${resolved.ref} (${resolved.commit}) version ${resolved.version}`);
    console.log(`${Object.keys(files).length} files`);
  } finally {
    rmSync(resolved.tmp, { recursive: true, force: true });
  }
}

main();
