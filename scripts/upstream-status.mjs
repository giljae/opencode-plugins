#!/usr/bin/env node
// Report, for every package with a vendor.config.json, whether its upstream
// changed. Prints a JSON array on stdout. Used by the publish workflow.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = join(ROOT, "packages");
const syncScript = join(ROOT, "scripts", "sync.mjs");

const dirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(packagesDir, entry.name))
  .filter((dir) => existsSync(join(dir, "vendor.config.json")));

const status = dirs.map((dir) => {
  const out = execFileSync("node", [syncScript, "--plugin", dir, "--check"], {
    encoding: "utf8",
  });
  return JSON.parse(out);
});

console.log(JSON.stringify(status, null, 2));
