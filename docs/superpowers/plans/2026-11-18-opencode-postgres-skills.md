# opencode-postgres-skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `@giljae/opencode-postgres-skills`, an OpenCode V2 plugin that registers microsoft/postgres-skills' three skills and its local Postgres MCP server, and generalize the monorepo's sync/publish tooling to serve multiple plugins.

**Architecture:** A per-package `vendor.config.json` drives one generic `scripts/sync.mjs`. A new package registers vendored skills (directory-form) and a pinned, locally launched `@microsoft/postgres-mcp` server through `ctx.mcp.transform`. One publishing workflow loops over every package that has a vendor config.

**Tech Stack:** TypeScript (shipped as source), Node >= 22 for this plugin, npm workspaces, Vitest, GitHub Actions, `@opencode/plugin`, `@microsoft/postgres-mcp`.

**Spec:** `docs/superpowers/specs/2026-11-18-opencode-postgres-skills-design.md`

## Global Constraints

- New package `@giljae/opencode-postgres-skills`, first published version `0.0.1`; plugin id `postgres-skills`.
- Target OpenCode V2 only; pin `@opencode/plugin` to the same version as the EGM package.
- Vendor upstream content unchanged; retain the MIT copyright; no editing of skill, script, or reference text.
- Upstream trigger for this plugin: the `version` field of `plugin/plugin.json` on `main`.
- MCP server: pinned dependency `@microsoft/postgres-mcp`, launched by absolute path from the installed package (`process.execPath` + resolved `bin/postgres-mcp.js`), registered **enabled**, named `postgres-mcp`.
- Node >= 22 required by this plugin (upstream scripts); record it in the README and `engines`.
- No agents and no commands in this package.
- Reuse `scripts/lib/sync-core.mjs` (`sha256File`, `buildManifest`, `listFiles`, `verifyVendored`).
- Generalizing the tooling must not change EGM's vendored content.
- Upstream manifest identity shape: `{ repo, ref, commit, version, fetchedAt, files }`; the package field is `<manifestField>.upstream = { repo, ref, commit, version }`.

## Review Focus

Failure modes the spec implies that no single task's happy-path test covers; each is pinned by a test in the owning task.

1. The config-driven sync refactor silently changes or drops EGM's vendored files — the EGM drift test must stay green with no content diff. (Task 1)
2. The MCP entry file does not resolve after install, so the server never launches — `registerMcp` must set a command whose entry path exists. (Task 6, Task 8)
3. Skills are registered without a usable base directory, so `references/` and `scripts/` do not resolve — skill `path` must point at the vendored `SKILL.md`. (Task 5, Task 8)
4. The `versionFile` trigger reads a missing or malformed version and records a wrong version — sync must fail loudly. (Task 1, Task 3)
5. The generalized workflow publishes the wrong package or races commits across packages — the loop must be serial and `test_publish` isolated per package. (Task 9)
6. The MCP server fails to launch offline or spawns unexpectedly — pinned local dependency; enabled behavior documented. (Task 6, Task 8)

---

### Task 1: Generalized vendoring config and sync (keep EGM working)

**Files:**
- Create: `packages/opencode-egm/vendor.config.json`
- Create: `scripts/sync.mjs`
- Modify: `scripts/lib/sync-core.mjs` (add config + trigger + include helpers)
- Modify: `packages/opencode-egm/package.json` (`sync` script; `egm.upstream` shape)
- Modify: `packages/opencode-egm/test/vendor-drift.test.ts` (field shape)
- Remove: `scripts/sync-upstream.mjs`
- Test: `packages/opencode-egm/test/sync-core.test.ts` (extend), `packages/opencode-egm/test/vendor-config.test.ts`

**Interfaces:**
- Consumes: existing `sync-core.mjs` helpers.
- Produces:
  - `VendorConfig = { upstream: { repo, trigger: "release" | "versionFile", tagPrefix?, branch?, versionFile? }, include: {from,to}[], exclude: string[], dest: string, manifestField: string }`
  - `loadVendorConfig(packageDir: string): VendorConfig` — throws on a missing or malformed config.
  - `buildIncludePlan(config: VendorConfig): { from: string; to: string }[]`
  - `parseVersion(jsonText: string): string` — throws when `version` is missing.
  - `applyInclude(sourceRoot, dest, include, exclude): Record<string, string>` — writes files, returns the `files` map for the manifest.
  - CLI: `node scripts/sync.mjs --plugin <dir> [--check]` (`--check` reports changed/unchanged without writing).

- [ ] **Step 1: Write the failing tests**

`test/sync-core.test.ts` (extend): `parseVersion('{"version":"0.3.0"}')` returns `"0.3.0"` and throws on missing/malformed; `buildIncludePlan` returns the config's include list; `applyInclude` maps `plugin/skills` → `skills` in a temp fixture and returns hashed keys, applying `exclude`.
`test/vendor-config.test.ts`: `loadVendorConfig("packages/opencode-egm")` returns `trigger: "release"`, `tagPrefix: "v"`, and the include plan covering `agents`, `skills`, `resources`, `docs`, `LICENSE`; `loadVendorConfig` throws on a temp dir with no config.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/opencode-egm/test/sync-core.test.ts packages/opencode-egm/test/vendor-config.test.ts`
Expected: FAIL — new helpers not exported.

- [ ] **Step 3: Implement the helpers and `scripts/sync.mjs`**

Move the EGM whitelist/exclude into `packages/opencode-egm/vendor.config.json`. `scripts/sync.mjs` loads a package's config, resolves the trigger (release tag via `git ls-remote`, or `versionFile` at the branch HEAD via `git show <branch>:<file>`), clones at the commit, applies the include plan, writes `UPSTREAM.json` (`{repo, ref, commit, version, fetchedAt, files}`), and updates `<manifestField>.upstream`. Regenerate the destination from scratch (as the EGM sync did).

- [ ] **Step 4: Re-sync EGM and confirm no content change**

Run: `node scripts/sync.mjs --plugin packages/opencode-egm`
Expected: same file set as before; `git diff --stat packages/opencode-egm/vendor` shows only `UPSTREAM.json` (shape change), no content files.

- [ ] **Step 5: Update EGM's field shape and drift test**

Change the drift test to read `pkg.egm.upstream.ref`/`commit`/`version`, and update `package.json`'s `egm.upstream`.

- [ ] **Step 6: Full suite, then commit**

Run: `npm test`
Expected: PASS (EGM drift green).

```bash
git add scripts packages/opencode-egm
git commit -m "refactor: config-driven upstream sync shared across plugins"
```

---

### Task 2: Scaffold the opencode-postgres-skills package

**Files:**
- Create: `packages/opencode-postgres-skills/{package.json,tsconfig.json,vitest.config.ts,LICENSE,NOTICE,README.md,vendor.config.json}`
- Create: `packages/opencode-postgres-skills/src/index.ts` (placeholder `export {};`)
- Test: `packages/opencode-postgres-skills/test/package.test.ts`

**Interfaces:**
- Consumes: Task 1's config format.
- Produces: an installable workspace package with the pinned MCP dependency.

- [ ] **Step 1: Write the failing test**

`test/package.test.ts` asserts `name === "@giljae/opencode-postgres-skills"`, `version === "0.0.1"`, `engines.node` includes `>=22`, `dependencies["@microsoft/postgres-mcp"]` is a pinned version (no range), `publishConfig.access === "public"`, `exports["."] === "./src/index.ts"`, `files` includes `vendor`, and `LICENSE`/`NOTICE` exist.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/opencode-postgres-skills/test/package.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create the package and install**

`vendor.config.json` uses `trigger: "versionFile"`, `branch: "main"`, `versionFile: "plugin/plugin.json"`, `include` = `[{from:"plugin/skills",to:"skills"},{from:"plugin/MIGRATION.md",to:"MIGRATION.md"},{from:"plugin/SETUP.md",to:"SETUP.md"},{from:"LICENSE",to:"LICENSE"}]`, `exclude: []`, `dest: "vendor/postgres-skills"`, `manifestField: "postgresSkills"`. Pin `@microsoft/postgres-mcp` to the version recorded at implementation. `NOTICE` records Microsoft's MIT copyright.

Run: `npm install`

- [ ] **Step 4: Run the test, then commit**

Run: `npm test`
Expected: PASS.

```bash
git add packages/opencode-postgres-skills package.json package-lock.json
git commit -m "chore: scaffold opencode-postgres-skills package"
```

---

### Task 3: Vendor upstream content

**Files:**
- Create (generated): `packages/opencode-postgres-skills/vendor/postgres-skills/**`, `UPSTREAM.json`
- Test: `packages/opencode-postgres-skills/test/vendor-drift.test.ts`

**Interfaces:**
- Consumes: `scripts/sync.mjs` (Task 1), `vendor.config.json` (Task 2).
- Produces: the vendored tree and the recorded upstream.

- [ ] **Step 1: Write the failing test**

`test/vendor-drift.test.ts`: `verifyVendored(vendorDir, manifest)` returns `[]`; the manifest lists `skills/postgresql-best-practices/SKILL.md`, `skills/pg-graph/SKILL.md`, `skills/migrate-oracle-app/SKILL.md`; the package's `postgresSkills.upstream.version` equals the manifest `version`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/opencode-postgres-skills/test/vendor-drift.test.ts`
Expected: FAIL — vendor tree missing.

- [ ] **Step 3: Sync**

Run: `node scripts/sync.mjs --plugin packages/opencode-postgres-skills`
Expected: `vendor/postgres-skills/skills/` with 3 skills; `UPSTREAM.json` records the current `plugin.json` version and the main commit.

- [ ] **Step 4: Run the test, then commit**

Run: `npm test`
Expected: PASS.

```bash
git add packages/opencode-postgres-skills/vendor packages/opencode-postgres-skills/test packages/opencode-postgres-skills/package.json
git commit -m "feat: vendor upstream postgres-skills with provenance"
```

---

### Task 4: Content parsing

**Files:**
- Create: `packages/opencode-postgres-skills/src/content.ts`
- Test: `packages/opencode-postgres-skills/test/content.test.ts`

**Interfaces:**
- Consumes: the vendored tree (Task 3).
- Produces:
  - `UpstreamManifest` and `VendoredSkill` types (same shape as EGM).
  - `parseFrontmatter(markdown): { data, body }`
  - `listSkills(bundleDir: string): VendoredSkill[]` — one entry per `skills/*/SKILL.md`.
  - `readUpstreamManifest(bundleDir: string): UpstreamManifest` — throws when missing or malformed.

- [ ] **Step 1: Write the failing test**

`test/content.test.ts`: `listSkills` over a temp fixture returns one entry per `SKILL.md` dir, id = directory name, body without frontmatter, and ignores dirs without one; a real-bundle assertion that `listSkills("vendor/postgres-skills").map(s => s.id)` equals `["migrate-oracle-app","pg-graph","postgresql-best-practices"]`; `readUpstreamManifest` throws on a missing file.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/opencode-postgres-skills/test/content.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/content.ts`**

Same approach as EGM's `content.ts`; reuse the flat frontmatter parsing. Sort by id.

- [ ] **Step 4: Run to verify pass, then commit**

Run: `npx vitest run packages/opencode-postgres-skills/test/content.test.ts`
Expected: PASS.

```bash
git add packages/opencode-postgres-skills/src/content.ts packages/opencode-postgres-skills/test/content.test.ts
git commit -m "feat: parse vendored postgres-skills"
```

---

### Task 5: Skill registration

**Files:**
- Create: `packages/opencode-postgres-skills/src/host.ts`, `src/skills.ts`
- Test: `packages/opencode-postgres-skills/test/skills.test.ts`

**Interfaces:**
- Consumes: `listSkills` (Task 4).
- Produces:
  - `host.ts`: `SkillHost` (structural `{ skill: { transform } }`), `McpHost` (`{ mcp: { transform } }`), and the definition shapes used below.
  - `registerSkills(host: SkillHost, bundleDir: string): Promise<number>`

- [ ] **Step 1: Write the failing test**

`test/skills.test.ts`: a fake `SkillHost` capturing `editor.add`; `registerSkills` adds 3 skills whose `id` equals the directory name and whose `path` is the absolute vendored `SKILL.md`; `content` has no frontmatter.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/opencode-postgres-skills/test/skills.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/host.ts` and `src/skills.ts`**

Keep the directory-form `path` so `references/` and `scripts/` resolve.

- [ ] **Step 4: Run to verify pass, then commit**

Run: `npx vitest run packages/opencode-postgres-skills/test/skills.test.ts`
Expected: PASS.

```bash
git add packages/opencode-postgres-skills/src/host.ts packages/opencode-postgres-skills/src/skills.ts packages/opencode-postgres-skills/test/skills.test.ts
git commit -m "feat: register vendored postgres skills"
```

---

### Task 6: MCP registration

**Files:**
- Create: `packages/opencode-postgres-skills/src/mcp.ts`
- Test: `packages/opencode-postgres-skills/test/mcp.test.ts`

**Interfaces:**
- Consumes: `McpHost` (Task 5).
- Produces:
  - `MCP_SERVER_NAME = "postgres-mcp"`
  - `resolveMcpEntry(): string` — absolute path to `@microsoft/postgres-mcp`'s `bin/postgres-mcp.js`.
  - `registerMcp(host: McpHost): Promise<void>` — `host.mcp.transform(e => e.set(MCP_SERVER_NAME, config))`.

- [ ] **Step 1: Write the failing test**

`test/mcp.test.ts`: `resolveMcpEntry()` returns an existing file whose path contains `bin/postgres-mcp.js` (Review Focus 2). A fake `McpHost` captures the `set(name, config)` call; assert name `postgres-mcp`, `config.type === "local"`, `config.command[0] === process.execPath`, `config.command` includes the resolved entry and `run`/`--no-telemetry`, `config.environment.POSTGRES_MCP_QUERY_TIMEOUT_MS === "540000"`, and `config.disabled` is undefined (Review Focus 6).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/opencode-postgres-skills/test/mcp.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/mcp.ts`**

Use `createRequire(import.meta.url).resolve("@microsoft/postgres-mcp/bin/postgres-mcp.js")`. Build the local server config with the pinned entry, environment, and `timeout: { startup: 90000 }`.

- [ ] **Step 4: Run to verify pass, then commit**

Run: `npx vitest run packages/opencode-postgres-skills/test/mcp.test.ts`
Expected: PASS.

```bash
git add packages/opencode-postgres-skills/src/mcp.ts packages/opencode-postgres-skills/test/mcp.test.ts
git commit -m "feat: register the local postgres MCP server"
```

---

### Task 7: Plugin entry

**Files:**
- Modify: `packages/opencode-postgres-skills/src/index.ts`
- Create: `packages/opencode-postgres-skills/src/setup.ts`
- Test: `packages/opencode-postgres-skills/test/setup.test.ts`

**Interfaces:**
- Consumes: `registerSkills` (Task 5), `registerMcp` (Task 6), `readUpstreamManifest` (Task 4).
- Produces:
  - `Host = SkillHost & McpHost`
  - `runSetup(host: Host, bundleDir: string): Promise<{ skills: number; mcp: number }>`
  - `export default Plugin.define({ id: "postgres-skills", async setup(ctx) { … } })`

- [ ] **Step 1: Write the failing test**

`test/setup.test.ts`: a fake `Host`; `runSetup(host, "vendor/postgres-skills")` returns `{ skills: 3, mcp: 1 }`, registers skills whose paths are under the bundle, and calls `mcp.transform` once with the `postgres-mcp` server. A missing `UPSTREAM.json` makes `runSetup` throw (Review Focus 4).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/opencode-postgres-skills/test/setup.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/setup.ts` and `src/index.ts`**

`runSetup` resolves `bundleDir` (default `new URL("../vendor/postgres-skills/", import.meta.url)`), calls `readUpstreamManifest`, registers skills, then MCP. `index.ts` delegates, casting the context to `Host` at the boundary as EGM does.

- [ ] **Step 4: Full suite and typecheck, then commit**

Run: `npm test && npm run typecheck`
Expected: PASS.

```bash
git add packages/opencode-postgres-skills/src/index.ts packages/opencode-postgres-skills/src/setup.ts packages/opencode-postgres-skills/test/setup.test.ts
git commit -m "feat: wire the postgres-skills plugin entry"
```

---

### Task 8: Live OpenCode spike

**Files:**
- Create: `docs/verification/opencode-postgres-skills-spike.md`

**Interfaces:**
- Consumes: the built package.
- Produces: findings recorded with the OpenCode, Node, and MCP versions used.

- [ ] **Step 1: Load the plugin in a scratch project**

Configure the plugin (local dir or the `plugins` path) and start a session. Record versions.

- [ ] **Step 2: Verify the six items**

1. `ctx.mcp.transform` + `set` starts the local server (enabled).
2. OpenCode installs the plugin's dependencies, so `resolveMcpEntry()` resolves and the server runs with no network.
3. The MCP tools are exposed, and their names match what the skills call (`postgres_mcp_query`, …); record any mismatch.
4. The three skills load, and a directory-form skill exposes `references/` and `scripts/`.
5. A skill script runs under the default agent's shell permission.
6. The server does not error when no database is configured.

- [ ] **Step 3: Record and adjust**

Write `docs/verification/opencode-postgres-skills-spike.md`: one line per item, `pass`/`fail`/`unverified`, the command, and the observed result. A finding that changes a Task 1-7 decision becomes a follow-up commit referencing the document.

- [ ] **Step 4: Commit**

```bash
git add docs/verification/opencode-postgres-skills-spike.md
git commit -m "docs: record postgres-skills OpenCode spike"
```

---

### Task 9: Generalize the publish workflow

**Files:**
- Modify: `.github/workflows/upstream-sync.yml`
- Create: `scripts/upstream-status.mjs`
- Test: `packages/opencode-postgres-skills/test/workflows.test.ts` and the existing EGM `test/workflows.test.ts`

**Interfaces:**
- Consumes: every `packages/*/vendor.config.json`.
- Produces: `node scripts/upstream-status.mjs` prints a JSON array `[{ dir, name, changed, ref, commit, version }]` for all config-bearing packages.

- [ ] **Step 1: Write the failing tests**

New `test/workflows.test.ts` in the postgres package (and update EGM's): the workflow discovers packages from `vendor.config.json`, iterates them serially, has `verify_token` and `test_publish` inputs with a `package_filter` (Review Focus 5), and no longer hard-codes one package name.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/opencode-postgres-skills/test/workflows.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `scripts/upstream-status.mjs` and rewrite the workflow loop**

The loop: for each changed package run `node scripts/sync.mjs --plugin <dir>`, `npm test`, bump the version, publish; commit/tag/push once after the loop unless `test_publish`. `test_publish` publishes a prerelease under the `test` tag for the filtered package only.

- [ ] **Step 4: Run tests, then commit**

Run: `npm test`
Expected: PASS.

```bash
git add .github/workflows/upstream-sync.yml scripts/upstream-status.mjs packages/opencode-postgres-skills/test/workflows.test.ts packages/opencode-egm/test/workflows.test.ts
git commit -m "ci: publish every plugin package from one workflow"
```

---

### Task 10: Docs and first release

**Files:**
- Modify: `README.md` (root plugin table + layout)
- Modify: `packages/opencode-postgres-skills/README.md`
- Test: `packages/opencode-postgres-skills/test/readme.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: the published `@giljae/opencode-postgres-skills@0.0.1`.

- [ ] **Step 1: Write the failing test**

`test/readme.test.ts` asserts the README contains `opencode plugin add @giljae/opencode-postgres-skills`, `https://www.npmjs.com/package/@giljae/opencode-postgres-skills`, the three skill names, `postgres-mcp`, a Node >= 22 requirement, `MIT` attribution, a statement that it is not affiliated with or endorsed by Microsoft, and the vendored upstream version.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/opencode-postgres-skills/test/readme.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write both READMEs and add the plugin to the root table**

Describe the three skills, the auto-registered local MCP server (enabled; starts a process each session; works offline via the pinned dependency), the Node >= 22 requirement, and attribution.

- [ ] **Step 4: Full suite**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Publish the first version** (human action)

`npm publish --workspace @giljae/opencode-postgres-skills` (needs the human's npm 2FA).

- [ ] **Step 6: Commit**

```bash
git add README.md packages/opencode-postgres-skills/README.md packages/opencode-postgres-skills/test/readme.test.ts
git commit -m "docs: document and release @giljae/opencode-postgres-skills 0.0.1"
```

---

## Self-Review

- **Spec coverage:** tooling generalization (Task 1, 9); new package and MCP dependency (Task 2); unchanged vendoring + MIT notice (Tasks 2, 3, 10); skills (Tasks 4, 5, 7); local MCP via `ctx.mcp` (Tasks 6, 7); version-file trigger (Tasks 1, 3); spike (Task 8); offline launch (Tasks 2, 6, 8); no agents/commands (Tasks 5-7).
- **Step scan:** each step names a file, a signature, or a command with an expected result.
- **Type consistency:** `VendorConfig`, `UpstreamManifest`, `VendoredSkill`, `SkillHost`, `McpHost`, `Host`, `MCP_SERVER_NAME` are defined once and reused.
- **Review Focus:** the six items each have a named owning test.
- **Proportion:** the plan states decisions and test intent; the implementer writes the bodies.
