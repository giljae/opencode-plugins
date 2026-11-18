// Pure helpers for vendoring an upstream repository at a pinned ref.
// No network access here; the CLI in ../sync.mjs does the I/O.

import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";

/** Our own provenance file; never part of the upstream manifest. */
export const MANIFEST_FILE = "UPSTREAM.json";

/** @param {string} filePath @returns {string} lowercase hex sha256 */
export function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

/**
 * @param {{ repo: string; ref: string; commit: string; version?: string;
 *           fetchedAt: string; files: Record<string, string> }} input
 * @returns {{ repo: string; ref: string; commit: string; version: string;
 *             fetchedAt: string; files: Record<string, string> }}
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
    version: input.version ?? "",
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

/** True when `rel` (POSIX, relative to the source root) is excluded. */
export function isExcluded(rel, exclude) {
  return exclude.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`));
}

/** @param {string} jsonText @returns {string} the `version` field, or throws. */
export function parseVersion(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`Malformed version file: ${error.message}`);
  }
  if (!parsed || typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new Error("Version file has no version field");
  }
  return parsed.version;
}

/** @param {{ include?: { from: string; to: string }[] }} config */
export function buildIncludePlan(config) {
  if (!Array.isArray(config.include) || config.include.length === 0) {
    throw new Error("Vendor config has no include entries");
  }
  return config.include.map((entry) => ({ from: entry.from, to: entry.to }));
}

/** @param {string} packageDir @returns {import("./sync-core.mjs").VendorConfig} */
export function loadVendorConfig(packageDir) {
  const path = join(packageDir, "vendor.config.json");
  if (!existsSync(path)) {
    throw new Error(`Missing vendor.config.json: ${path}`);
  }
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const upstream = raw.upstream ?? {};
  if (!upstream.repo || !upstream.trigger) {
    throw new Error(`vendor.config.json needs upstream.repo and upstream.trigger: ${path}`);
  }
  if (upstream.trigger === "release" && !upstream.tagPrefix) {
    throw new Error(`release trigger needs upstream.tagPrefix: ${path}`);
  }
  if (upstream.trigger === "versionFile" && !upstream.versionFile) {
    throw new Error(`versionFile trigger needs upstream.versionFile: ${path}`);
  }
  if (!raw.dest || !raw.manifestField) {
    throw new Error(`vendor.config.json needs dest and manifestField: ${path}`);
  }
  return {
    upstream,
    include: buildIncludePlan(raw),
    exclude: Array.isArray(raw.exclude) ? raw.exclude : [],
    dest: raw.dest,
    manifestField: raw.manifestField,
  };
}

/**
 * Regenerate `dest` from the mapped include entries and return the file hashes.
 * @returns {Record<string, string>}
 */
export function applyInclude(sourceRoot, dest, include, exclude) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  for (const entry of include) {
    const source = join(sourceRoot, entry.from);
    if (!existsSync(source)) {
      throw new Error(`Missing included path: ${entry.from}`);
    }
    mkdirSync(dirname(join(dest, entry.to)), { recursive: true });
    cpSync(source, join(dest, entry.to), {
      recursive: true,
      filter: (candidate) =>
        !isExcluded(relative(sourceRoot, candidate).split(sep).join("/"), exclude),
    });
  }
  const files = {};
  for (const rel of listFiles(dest)) {
    if (rel === MANIFEST_FILE) continue;
    files[rel] = sha256File(join(dest, rel));
  }
  return files;
}
