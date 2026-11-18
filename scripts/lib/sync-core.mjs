// Pure helpers for vendoring google/elephant-goldfish-model at a pinned ref.
// No network access here; the CLI in ../sync-upstream.mjs does the I/O.

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** Top-level upstream paths copied into the vendor tree. */
export const WHITELIST = ["agents", "skills", "resources", "docs", "LICENSE"];

/** Paths under a whitelisted entry that are not part of the runtime content. */
export const EXCLUDE = ["docs/site", "docs/designs", "docs/opencode.md"];

/** Our own provenance file; never part of the upstream manifest. */
export const MANIFEST_FILE = "UPSTREAM.json";

/** @param {string} filePath @returns {string} lowercase hex sha256 */
export function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

/**
 * @param {{ repo: string; ref: string; commit: string; fetchedAt: string;
 *           files: Record<string, string> }} input
 * @returns {{ repo: string; ref: string; commit: string; fetchedAt: string;
 *             files: Record<string, string> }}
 */
export function buildManifest(input) {
  const files = {};
  for (const key of Object.keys(input.files).sort()) {
    files[key] = input.files[key];
  }
  return {
    repo: input.repo,
    ref: input.ref,
    commit: input.commit,
    fetchedAt: input.fetchedAt,
    files,
  };
}

/** Sorted POSIX-relative paths of every file under `root`. */
export function listFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    )) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        out.push(relative(root, full).split(sep).join("/"));
      }
    }
  };
  walk(root);
  return out.sort();
}

/**
 * Every way the vendored tree disagrees with the manifest.
 * @param {string} vendorDir
 * @param {{ files: Record<string, string> }} manifest
 * @returns {string[]}
 */
export function verifyVendored(vendorDir, manifest) {
  const found = new Set(listFiles(vendorDir));
  const problems = [];
  for (const [rel, digest] of Object.entries(manifest.files)) {
    if (!found.has(rel)) {
      problems.push(`missing: ${rel}`);
      continue;
    }
    found.delete(rel);
    if (sha256File(join(vendorDir, rel)) !== digest) {
      problems.push(`modified: ${rel}`);
    }
  }
  for (const extra of found) {
    if (extra === MANIFEST_FILE) continue;
    problems.push(`unlisted: ${extra}`);
  }
  return problems.sort();
}

/** True when `rel` (POSIX, relative to a vendored entry root) is excluded. */
export function isExcluded(rel) {
  return EXCLUDE.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`));
}

/** True when the directory entry `name` is excluded from the whitelist. */
export function isExcludedTopLevel(name) {
  return EXCLUDE.some((prefix) => prefix === name || prefix.startsWith(`${name}/`));
}

/** @param {string} dir @returns {boolean} */
export function isDirectory(dir) {
  try {
    return statSync(dir).isDirectory();
  } catch {
    return false;
  }
}
