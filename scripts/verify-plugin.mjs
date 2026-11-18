#!/usr/bin/env node
// Repeatable local check for the EGM OpenCode plugin.
//
// Generates the nine agent files into a scratch project and asserts OpenCode
// discovers them with the intended permissions. Needs Node >= 23.6 (TypeScript
// type stripping) to import the package sources, and an `opencode` binary on
// PATH (or --opencode).
//
// Usage: node scripts/verify-plugin.mjs [--project <dir>] [--opencode <bin>]
//
// This does not make model calls and does not verify skill loading, subagent
// isolation, or runtime permission enforcement. See
// docs/verification/opencode-v2-spike.md.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PKG = join(ROOT, "packages/opencode-egm");

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const opencode = arg("--opencode", "opencode");
const keep = process.argv.includes("--keep");
const project = resolve(arg("--project", mkdtempSync(join(tmpdir(), "egm-verify-"))));

mkdirSync(project, { recursive: true });
writeFileSync(
  join(project, "opencode.jsonc"),
  `${JSON.stringify({ $schema: "https://opencode.ai/config.json" }, null, 2)}\n`,
);

const agents = await import(pathToFileURL(join(PKG, "src/agents.ts")).href);
const install = await import(pathToFileURL(join(PKG, "src/install.ts")).href);

const generated = agents.buildAgentFiles(join(PKG, "vendor/egm/"));
const target = join(project, ".opencode", "agents");
const written = install.installAgents(generated, target);
console.log(`generated ${written.length} agent files in ${target}`);

let listed;
try {
  listed = JSON.parse(
    execFileSync(opencode, ["debug", "agents"], {
      cwd: project,
      encoding: "utf8",
      timeout: 180_000,
    }),
  );
} catch (error) {
  const detail = String(error.stdout ?? error.message).split("\n").slice(-4).join("\n");
  console.error(
    `FAIL: could not run '${opencode} debug agents'. This helper needs a ` +
      `working OpenCode service for the project directory.\n${detail}`,
  );
  process.exit(1);
}
const byId = new Map(listed.map((agent) => [agent.id, agent]));
const expected = generated.map((file) => file.name.replace(/\.md$/, ""));
const missing = expected.filter((id) => !byId.has(id));
if (missing.length > 0) {
  console.error(`FAIL: agents not discovered: ${missing.join(", ")}`);
  process.exit(1);
}

const reviewer = byId.get("egm-zoom-out");
const denies = (action) =>
  (reviewer.permissions ?? []).some((p) => p.action === action && p.effect === "deny");
if (byId.get("egm").mode !== "primary" || reviewer.mode !== "subagent" || !denies("grep")) {
  console.error("FAIL: unexpected agent modes or reviewer grep policy");
  process.exit(1);
}

console.log(`PASS: ${expected.length} agents discovered; reviewers are read-only subagents`);
if (keep) {
  console.log(`kept ${project}`);
} else {
  rmSync(project, { recursive: true, force: true });
}
