# EGM OpenCode V2 Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@giljae/opencode-egm`, a published OpenCode V2 plugin that installs Google's Elephant-Goldfish Model workflow (7 skills, 9 agents, 7 commands) from vendored upstream content and auto-republishes on upstream release tags.

**Architecture:** An npm-workspaces monorepo. One package, `packages/opencode-egm`, is an OpenCode server plugin whose `setup(ctx)` registers agents, skills, and commands from upstream content vendored under `packages/opencode-egm/vendor/egm`. A shared sync script vendors a pinned upstream tag and records provenance; a scheduled workflow republishes on new tags.

**Tech Stack:** TypeScript (shipped as source, no bundling), Node 20+, npm workspaces, Vitest, Changesets, GitHub Actions, `@opencode/plugin`.

**Spec:** `docs/superpowers/specs/2026-11-18-opencode-plugins-egm-design.md`

## Global Constraints

- Package name `@giljae/opencode-egm`; first published version `0.0.1`.
- Target OpenCode V2 interfaces only (`permissions` rule array, `subagent` delegation, `@opencode/plugin` server part). No V1 support.
- Vendor upstream content unchanged; never hand-edit files under `vendor/`. Fork no skill, persona, or standard text.
- Upstream ref = the latest release tag `vMAJOR.MINOR.PATCH` of `google/elephant-goldfish-model`.
- Apache-2.0: keep copyright notices; ship `LICENSE` and `NOTICE` in the package.
- Register exactly 7 skills, 9 agents (1 primary `egm` + 8 reviewer subagents), 7 commands.
- Reviewer permission sets deny by default, deny `grep`, and deny `.env` / `.env.*` reads (`*.env.example` allowed).
- Versioning: independent semver, start `0.0.1`; upstream tag change bumps `minor`, adapter-only fix bumps `patch`.
- Keep canonical `egm-*` skill and agent ids.
- Do not set a default agent; do not mutate global or project config on install.
- Node >= 20. Package `exports` is `{ ".": "./src/index.ts" }`.

## Review Focus

The spec's expected failure modes that no single task's happy-path test covers; each is pinned by a test in the owning task.

1. Upstream content changes shape (a skill directory loses `SKILL.md`, a persona file disappears, a name moves) — install must fail loudly, never register a partial set. (Task 3, Task 8)
2. The vendored tree drifts from `UPSTREAM.json` (hand edit, missed sync) — CI must reject it. (Task 2)
3. Reviewer permission rules are wrong or misordered (default is `ask`, `grep`/`.env` leaks) — a reviewer must never get broader access than intended. (Task 4)
4. A bundle path contains spaces or non-ASCII characters (the install directory) — registration paths must still resolve. (Task 1, Task 3)
5. A command argument contains shell markers or untrusted review text — the command path must not shell-evaluate it. (Task 7)

---

### Task 1: Monorepo scaffolding and package shell

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.gitignore`, `.editorconfig`
- Create: `.changeset/config.json`, `.changeset/README.md`
- Create: `packages/opencode-egm/package.json`, `packages/opencode-egm/tsconfig.json`, `packages/opencode-egm/vitest.config.ts`
- Create: `packages/opencode-egm/src/index.ts` (placeholder, replaced in Task 8)
- Create: `packages/opencode-egm/LICENSE` (copy of the root Apache-2.0), `packages/opencode-egm/NOTICE`, `packages/opencode-egm/README.md`
- Test: `packages/opencode-egm/test/package.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: workspace layout and the package manifest contract every later task builds on.

- [ ] **Step 1: Create the workspace and package shell**

Root `package.json`: `"private": true`, `"workspaces": ["packages/*"]`, scripts `typecheck` (`npm run typecheck --workspaces --if-present`), `test` (`npm test --workspaces --if-present`), `sync` (`node scripts/sync-upstream.mjs`). Dev deps: `typescript`, `vitest`, `@changesets/cli`, `@types/node`. The package's own scripts are `test` (`vitest run`) and `typecheck` (`tsc --noEmit -p tsconfig.json`). Create `src/index.ts` with `export {};` so typecheck resolves the package's `exports` target.

`packages/opencode-egm/package.json`:
```json
{
  "name": "@giljae/opencode-egm",
  "version": "0.0.1",
  "type": "module",
  "license": "Apache-2.0",
  "exports": { ".": "./src/index.ts" },
  "files": ["src", "vendor", "LICENSE", "NOTICE", "README.md"],
  "dependencies": { "@opencode/plugin": "PIN_AT_IMPLEMENTATION" },
  "egm": { "upstream": { "repo": "", "tag": "", "commit": "" } }
}
```
Pin `@opencode/plugin` to a version compatible with the installed OpenCode V2 line and record the OpenCode version in the README.

- [ ] **Step 2: Write the manifest contract test**

`packages/opencode-egm/test/package.test.ts` asserts: `name === "@giljae/opencode-egm"`, `version === "0.0.1"`, `license === "Apache-2.0"`, `exports["."] === "./src/index.ts"`, `files` includes `"vendor"`, and that `LICENSE` and `NOTICE` exist on disk.

- [ ] **Step 3: Run the tests**

Run: `npm install && npm test`
Expected: PASS.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.base.json .gitignore .editorconfig .changeset packages/opencode-egm
git commit -m "chore: scaffold opencode-plugins monorepo and opencode-egm package"
```

---

### Task 2: Upstream sync and vendoring

**Files:**
- Create: `scripts/lib/sync-core.mjs`, `scripts/sync-upstream.mjs`
- Create (generated): `packages/opencode-egm/vendor/egm/**`, `packages/opencode-egm/vendor/egm/UPSTREAM.json`
- Test: `packages/opencode-egm/test/sync-core.test.ts`, `packages/opencode-egm/test/vendor-drift.test.ts`

**Interfaces:**
- Consumes: Task 1 workspace.
- Produces:
  - `sha256File(path: string): string`
  - `buildManifest(input: { repo: string; ref: string; commit: string; fetchedAt: string; files: Record<string,string> }): UpstreamManifest`
  - `verifyVendored(vendorDir: string, manifest: UpstreamManifest): string[]` — returns mismatch/extra/missing descriptions.
  - `WHITELIST: string[]` = `["agents", "skills", "resources", "docs", "LICENSE"]`
  - `UpstreamManifest = { repo, ref, commit, fetchedAt, files }` (re-exported by `src/content.ts` later).
  - CLI: `node scripts/sync-upstream.mjs --ref <tag> [--dest <dir>]`.

- [ ] **Step 1: Write the failing test for the pure helpers**

`test/sync-core.test.ts`: build a temp dir with two files, assert `sha256File` matches a known digest; `buildManifest` produces a `files` map with repo-relative POSIX keys; `verifyVendored` reports a modified file and an unlisted extra file.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/opencode-egm/test/sync-core.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `scripts/lib/sync-core.mjs`**

Export the four names above. `verifyVendored` walks the tree, compares each file's sha256 to the manifest, and returns one string per mismatch, missing entry, or unlisted file.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run packages/opencode-egm/test/sync-core.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the CLI and vendor the content**

`scripts/sync-upstream.mjs` resolves `--ref` to a commit (`git ls-remote` / GitHub API), shallow-clones `google/elephant-goldfish-model` at that commit into a temp dir, copies each `WHITELIST` entry into `packages/opencode-egm/vendor/egm`, writes `UPSTREAM.json`, and also writes `egm.upstream` (`repo`, `tag`, `commit`) into the package manifest. It refuses to run if the destination already contains unlisted files.

Run: `node scripts/sync-upstream.mjs --ref v0.1.1`
Expected: `vendor/egm/` populated; `UPSTREAM.json` lists every file.

- [ ] **Step 6: Write the drift test**

`test/vendor-drift.test.ts` reads `vendor/egm/UPSTREAM.json`, asserts `verifyVendored(vendorDir, manifest)` returns `[]`, asserts the manifest contains `agents/zoom_out.md` and `skills/egm-review/SKILL.md`, and asserts the package manifest's `egm.upstream.commit` equals the manifest's `commit`.

- [ ] **Step 7: Run the tests and commit**

Run: `npx vitest run packages/opencode-egm/test/vendor-drift.test.ts`
Expected: PASS.

```bash
git add scripts packages/opencode-egm/vendor packages/opencode-egm/package.json packages/opencode-egm/test
git commit -m "feat: vendor upstream EGM at a pinned release tag with provenance"
```

---

### Task 3: Content parsing

**Files:**
- Create: `packages/opencode-egm/src/content.ts`
- Test: `packages/opencode-egm/test/content.test.ts`

**Interfaces:**
- Consumes: vendored tree from Task 2.
- Produces:
  - `parseFrontmatter(markdown: string): { data: Record<string, string>; body: string }`
  - `listSkills(bundleDir: string): VendoredSkill[]` where `VendoredSkill = { id: string; dir: string; skillPath: string; name: string; description: string; body: string }`
  - `listAgents(bundleDir: string): VendoredAgent[]` where `VendoredAgent = { id: string; file: string; name: string; description: string; body: string }`
  - `readUpstreamManifest(bundleDir: string): UpstreamManifest` (throws when `UPSTREAM.json` is missing or unparsable)

- [ ] **Step 1: Write the failing tests**

`test/content.test.ts`: `parseFrontmatter` on a block with `name`/`description` returns the fields and the body without the `---` fences. `listSkills` over a temp fixture returns one entry per directory containing `SKILL.md`, `id` equal to the directory name, and ignores directories without one. `listAgents` returns one entry per `*.md`, `id` from the frontmatter `name`, body without frontmatter. `readUpstreamManifest` throws on a missing file. Add the case for a skill path under a directory containing a space and a non-ASCII character, asserting `skillPath` round-trips unchanged (Review Focus 4).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/opencode-egm/test/content.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/content.ts`**

Minimal YAML frontmatter handling (line-based `key: value`; these files use flat scalars). `listSkills` reads `skills/*/SKILL.md`; `listAgents` reads `agents/*.md`. Sort results by `id` for determinism. Do not transform paths.

- [ ] **Step 4: Run to verify pass, then commit**

Run: `npx vitest run packages/opencode-egm/test/content.test.ts`
Expected: PASS.

```bash
git add packages/opencode-egm/src/content.ts packages/opencode-egm/test/content.test.ts
git commit -m "feat: parse vendored EGM skills and personas"
```

---

### Task 4: Reviewer and orchestrator permissions

**Files:**
- Create: `packages/opencode-egm/src/permissions.ts`
- Test: `packages/opencode-egm/test/permissions.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `Permission = { action: string; resource: string; effect: "allow" | "deny" | "ask" }`
  - `REVIEWER_IDS: readonly string[]` = `["egm-codebase-details","egm-comprehension","egm-design-critic","egm-implementation-readiness","egm-inventive-catalyst","egm-structural","egm-style","egm-zoom-out"]`
  - `reviewerPermissions(bundleDir: string): Permission[]`
  - `orchestratorPermissions(bundleDir: string, reviewerIds: readonly string[]): Permission[]`
  - `resolveEffect(rules: readonly Permission[], action: string, resource: string): "allow" | "deny" | "ask"` — last matching rule wins; `ask` when none match.

- [ ] **Step 1: Write the failing tests**

`test/permissions.test.ts` drives `resolveEffect` over the returned arrays to pin intent:
- reviewer: `read` of a normal file → `allow`; `read` of `.env` → `deny`; `read` of `.env.example` → `allow`; `grep` → `deny`; `edit`/`shell`/`subagent`/`skill` on anything → `deny`; `read` under `bundleDir` → `allow`; an action with no matching rule → `deny` (Review Focus 3).
- orchestrator: `skill` `egm-review` → `allow`, `skill` `other` → `deny`; `subagent` each reviewer id → `allow`, `subagent` anything else → `deny`; `edit` → `ask`; `read` of `.env` → `ask`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/opencode-egm/test/permissions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/permissions.ts`**

Reviewer rules in order: deny `*`/`*`; allow `read`/`*`; deny `read`/`*.env`; deny `read`/`*.env.*`; allow `read`/`*.env.example`; allow `read`/`<bundleDir>/*`; allow `glob`/`*`; deny `grep`/`*`. Orchestrator rules: allow `read`/`glob`/`grep`; ask `read`/`*.env`; allow `skill`/`egm-*`; deny `skill`/`*`; allow `subagent`/<each reviewer id>; deny `subagent`/`*`; ask `edit`/`*`; ask `shell`/`*`. Implement `resolveEffect` with simple `*`/`?` glob semantics matching OpenCode.

- [ ] **Step 4: Run to verify pass, then commit**

Run: `npx vitest run packages/opencode-egm/test/permissions.test.ts`
Expected: PASS.

```bash
git add packages/opencode-egm/src/permissions.ts packages/opencode-egm/test/permissions.test.ts
git commit -m "feat: define read-only reviewer and orchestrator permission rules"
```

---

### Task 5: Skill registration

**Files:**
- Create: `packages/opencode-egm/src/host.ts`, `packages/opencode-egm/src/skills.ts`
- Test: `packages/opencode-egm/test/skills.test.ts`

**Interfaces:**
- Consumes: `listSkills` (Task 3).
- Produces:
  - `host.ts`: `SkillHost`, `AgentHost`, `CommandHost` minimal structural interfaces for the OpenCode context, plus `SkillDefinition`, `AgentDefinition`, `CommandDefinition` input shapes.
  - `registerSkills(host: SkillHost, bundleDir: string): Promise<number>` — returns the count added.

- [ ] **Step 1: Write the failing test**

`test/skills.test.ts` builds a fake `SkillHost` that captures `editor.add` calls, runs `registerSkills` against a temp bundle with two skill dirs, and asserts: two adds; each `id` equals its directory name; each `path` is the absolute `SKILL.md`; `content` is the body with no frontmatter; `name`/`description` come from frontmatter.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/opencode-egm/test/skills.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/host.ts` and `src/skills.ts`**

`registerSkills` calls `host.skill.transform(async (editor) => { for (const s of listSkills(bundleDir)) editor.add({...}) })` and returns the count. Keep the directory-form `path` so OpenCode exposes the neighboring-file list.

- [ ] **Step 4: Run to verify pass, then commit**

Run: `npx vitest run packages/opencode-egm/test/skills.test.ts`
Expected: PASS.

```bash
git add packages/opencode-egm/src/host.ts packages/opencode-egm/src/skills.ts packages/opencode-egm/test/skills.test.ts
git commit -m "feat: register vendored skills as directory-form skills"
```

---

### Task 6: Orchestrator prompt and agent files

**Files:**
- Create: `packages/opencode-egm/src/orchestrator.ts`, `packages/opencode-egm/src/agents.ts`
- Test: `packages/opencode-egm/test/orchestrator.test.ts`, `packages/opencode-egm/test/agents.test.ts`

**Interfaces:**
- Consumes: `listAgents` (Task 3), `reviewerPermissions`, `orchestratorPermissions`, `REVIEWER_IDS` (Task 4).
- Produces:
  - `orchestratorPrompt(bundleDir: string, reviewerIds: readonly string[]): string`
  - `AgentFile = { name: string; content: string }`
  - `buildAgentFiles(bundleDir: string): AgentFile[]` — markdown for `egm` (mode `primary`) plus the 8 reviewers (mode `subagent`), 9 files, sorted.

- [ ] **Step 1: Write the failing tests**

`test/orchestrator.test.ts`: the prompt contains the absolute `bundleDir`, the word `subagent`, every reviewer id, and the instruction to keep human approval gates; it does not contain the V1 word `task` as a tool name.
`test/agents.test.ts`: against a temp bundle, `buildAgentFiles` returns 9 files; `egm.md` has `mode: primary`, the orchestrator permissions, the bundle path in the body, and a non-empty system body; each `egm-<reviewer>.md` has `mode: subagent`, the reviewer permissions, and that persona's body. Add the case that a missing persona makes `buildAgentFiles` throw rather than emit a partial set (Review Focus 1).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/opencode-egm/test/orchestrator.test.ts packages/opencode-egm/test/agents.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/orchestrator.ts` and `src/agents.ts`**

`orchestratorPrompt` is a V2-adapted rewrite of upstream's adapter prompt (dispatch with `subagent` and the registered reviewer ids; pass absolute persona, target, and standard paths; fresh session; no parent history; stop when delegation or a required read is missing; keep every approval gate; honor `EGM artifact directory`). `buildAgentFiles` renders YAML frontmatter (`description`, `mode`, `color`, `permissions` as an ordered list) followed by the system body, and throws when the expected reviewer id set is absent.

- [ ] **Step 4: Run to verify pass, then commit**

Run: `npx vitest run packages/opencode-egm/test/orchestrator.test.ts packages/opencode-egm/test/agents.test.ts`
Expected: PASS.

```bash
git add packages/opencode-egm/src/orchestrator.ts packages/opencode-egm/src/agents.ts packages/opencode-egm/test
git commit -m "feat: render the egm orchestrator and reviewer agent files"
```

---

### Task 7: Command registration

**Files:**
- Create: `packages/opencode-egm/src/commands.ts`
- Test: `packages/opencode-egm/test/commands.test.ts`

**Interfaces:**
- Consumes: `CommandHost` (Task 5), `listSkills` (Task 3).
- Produces:
  - `EGM_COMMANDS: readonly string[]` = `["egm-bootstrap","egm-brainstorm","egm-draft","egm-drift-report","egm-resolve","egm-review","egm-review-loop"]`
  - `registerCommands(host: CommandHost, bundleDir: string, agentId: string): Promise<number>`

- [ ] **Step 1: Write the failing test**

`test/commands.test.ts` uses a fake `CommandHost` capturing added definitions. Assert 7 commands whose names are `EGM_COMMANDS`, each with a description and an `execute`; invoking an `execute` calls `ctx.session.prompt` once with `agentID` set to the orchestrator and the user's raw text appended unchanged, without any shell interpolation (Review Focus 5).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/opencode-egm/test/commands.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/commands.ts`**

Each command's `execute({ sessionID, prompt, delivery })` calls `host.session.prompt({ ...prompt, sessionID, agentID: agentId, text: `Load and follow the <skillId> skill.\n\nUser request: ${prompt.text}`, delivery })`. Build the command list from the seven skill ids so a missing skill fails at registration.

- [ ] **Step 4: Run to verify pass, then commit**

Run: `npx vitest run packages/opencode-egm/test/commands.test.ts`
Expected: PASS.

```bash
git add packages/opencode-egm/src/commands.ts packages/opencode-egm/test/commands.test.ts
git commit -m "feat: register /egm-* commands on the orchestrator"
```

---

### Task 8: Plugin entry, agent install command, and full registration

**Files:**
- Modify: `packages/opencode-egm/src/index.ts` (create the real entry)
- Create: `packages/opencode-egm/src/setup.ts`, `packages/opencode-egm/src/install.ts`
- Test: `packages/opencode-egm/test/setup.test.ts`, `packages/opencode-egm/test/install.test.ts`

**Interfaces:**
- Consumes: `registerSkills` (Task 5), `registerCommands` (Task 7), `buildAgentFiles` (Task 6), `readUpstreamManifest` (Task 3).
- Produces:
  - `installAgents(files: AgentFile[], targetDir: string): string[]` — writes `<targetDir>/<name>` for each file, returns the written paths.
  - `registerInstallCommand(host: CommandHost, options: { bundleDir: string; targetDir: string }): Promise<void>`
  - `runSetup(host: Host, bundleDir: string, targetDir: string): Promise<{ skills: number; commands: number }>`
  - `export default Plugin.define({ id: "egm", async setup(ctx) { ... } })` in `src/index.ts`.

- [ ] **Step 1: Write the failing tests**

`test/install.test.ts`: `installAgents` writes each file into a temp dir and returns the paths; it creates the directory when missing.
`test/setup.test.ts` builds a fake `Host` implementing the skill/command transforms plus `session.prompt`, runs `runSetup(host, bundleDir, targetDir)` against the real vendored `vendor/egm`, and asserts `{ skills: 7, commands: 7 }` and that the registered command names include `egm-install-agents`. Invoke the install command's `execute` and assert it wrote 9 agent files into the target dir. Add a case where `UPSTREAM.json` is missing: `runSetup` throws instead of registering nothing (Review Focus 1).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/opencode-egm/test/setup.test.ts packages/opencode-egm/test/install.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/install.ts`, `src/setup.ts`, and `src/index.ts`**

`installAgents` writes the generated agent markdown into the target directory. `registerInstallCommand` adds an `egm-install-agents` command whose `execute` calls `installAgents(buildAgentFiles(bundleDir), targetDir)` and reports the written paths through `session.prompt`. `runSetup` resolves `bundleDir` (default `fileURLToPath(new URL("../vendor/egm/", import.meta.url))` and `targetDir` (default `<ctx.location.directory>/.opencode/agents`), calls `readUpstreamManifest`, registers skills, the seven skill commands, and the install command, returning counts. `index.ts` imports `Plugin` from `@opencode/plugin` and delegates to `runSetup`.

- [ ] **Step 4: Run the full test suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS, no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/opencode-egm/src/index.ts packages/opencode-egm/src/setup.ts packages/opencode-egm/src/install.ts packages/opencode-egm/test
git commit -m "feat: wire the EGM plugin entry and agent install command"
```

---

### Task 9: Live OpenCode V2 verification spike

**Files:**
- Create: `docs/verification/opencode-v2-spike.md`
- Create: `scripts/verify-plugin.mjs` (a repeatable local check helper)

**Interfaces:**
- Consumes: the built package and vendored content.
- Produces: a findings document recording the OpenCode and model versions used and the outcome of each item; any follow-up code fixes are separate commits.

- [ ] **Step 1: Prepare a scratch profile**

Install the package into a disposable project and start OpenCode with the plugin configured. Record `opencode --version` and the model id.

- [ ] **Step 2: Verify the six open items from the spec**

1. A directory-form skill exposes `references/` and its base directory; the agent can read `agents/` and `resources/` inside the installed package.
2. A wildcard-action deny followed by specific allows is enforced on subagents at runtime.
3. The nine generated agent files placed in `.opencode/agents/` are discovered, the orchestrator addresses subagents by the ids `egm-<reviewer>`, and the reviewer permission frontmatter is enforced at runtime.
4. `external_directory` behavior for the installed package (often under `node_modules`).
5. No V1 tool names (`task`) remain in the orchestrator or skill text that would mislead the agent.
6. Plugin-registered skill precedence against a same-id user skill.

- [ ] **Step 3: Record findings and adjust**

Write `docs/verification/opencode-v2-spike.md`: one line per item, `pass` / `fail` / `unverified`, the command used, and the observed result. Report installation, workflow, and isolation outcomes separately; mark anything untested as unverified. If a finding invalidates a Task 1-8 decision, fix it in a follow-up commit that references this document.

- [ ] **Step 4: Commit**

```bash
git add docs/verification/opencode-v2-spike.md scripts/verify-plugin.mjs
git commit -m "docs: record OpenCode V2 plugin verification spike"
```

---

### Task 10: Continuous integration and automatic upstream publishing

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/upstream-sync.yml`
- Test: `packages/opencode-egm/test/workflows.test.ts`

**Interfaces:**
- Consumes: `scripts/sync-upstream.mjs` (Task 2), `npm test`.
- Produces: CI on pull requests and a scheduled workflow that syncs a new upstream release tag and publishes.

- [ ] **Step 1: Write the failing test**

`test/workflows.test.ts` parses both YAML files and asserts: `ci.yml` runs on `pull_request` and `push` and runs `npm ci`, `npm test`, `npm run typecheck`; `upstream-sync.yml` has a `schedule` and `workflow_dispatch` trigger, uses `NPM_TOKEN`, resolves the latest upstream release tag, runs `scripts/sync-upstream.mjs`, runs the tests, guards against republishing an existing version, and publishes.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/opencode-egm/test/workflows.test.ts`
Expected: FAIL — files missing.

- [ ] **Step 3: Implement the workflows**

`ci.yml`: on `pull_request` and `push` to `main`; `permissions: contents: read`; steps: checkout (pinned SHA), setup-node 20, `npm ci`, `npm test`, `npm run typecheck`. The vendored drift test provides the offline provenance check.

`upstream-sync.yml`: on `schedule` (daily) and `workflow_dispatch`; `permissions: contents: write`; steps: resolve the latest upstream release tag (`gh api repos/google/elephant-goldfish-model/releases/latest`); compare with `egm.upstream.tag`; exit when unchanged; run `scripts/sync-upstream.mjs`; run tests; classify the vendored diff; bump `minor` (content) or `patch` (adapter); commit; tag; `npm publish` with `NPM_TOKEN`; create the GitHub release. Fail before publish if tests fail, skip if the version already exists, and open an issue instead of publishing a partial state.

- [ ] **Step 4: Run to verify pass, then commit**

Run: `npx vitest run packages/opencode-egm/test/workflows.test.ts`
Expected: PASS.

```bash
git add .github/workflows packages/opencode-egm/test/workflows.test.ts
git commit -m "ci: add verification and automatic upstream release publishing"
```

---

### Task 11: First release 0.0.1

**Files:**
- Modify: `packages/opencode-egm/README.md`
- Create: `.changeset/config.json` entry if needed, `docs/superpowers/specs/2026-11-18-opencode-plugins-egm-design.md` link
- Test: `packages/opencode-egm/test/readme.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: the published `@giljae/opencode-egm@0.0.1`.

- [ ] **Step 1: Write the failing test**

`test/readme.test.ts` asserts the README contains the install line `opencode plugin add @giljae/opencode-egm`, the string `unofficial port`, a statement that it is not affiliated with or endorsed by Google, a link to `https://github.com/google/elephant-goldfish-model`, the vendored upstream tag, and the OpenCode version verified.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/opencode-egm/test/readme.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write the README and confirm the version**

Fill in install, usage (`egm` agent + `/egm-*` commands), the verification status from Task 9, and attribution. Confirm `version` is `0.0.1` and `egm.upstream` matches `UPSTREAM.json`.

- [ ] **Step 4: Run the full suite**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Publish the first version**

Create the npm `@giljae` scope, authenticate, and run `npm publish --workspace @giljae/opencode-egm` from the repo root. Confirm the version resolves: `npm view @giljae/opencode-egm version`.

- [ ] **Step 6: Commit**

```bash
git add packages/opencode-egm/README.md packages/opencode-egm/test/readme.test.ts
git commit -m "docs: document and release @giljae/opencode-egm 0.0.1"
```

---

## Self-Review

- **Spec coverage:** distribution form (Tasks 1, 8, 11); unchanged vendoring (Task 2); provenance + drift (Task 2); the seven skills (Tasks 3, 5, 8); nine agents and read-only reviewers (Tasks 4, 6); commands (Task 7); orchestrator V2 dispatch (Task 6); automatic reflection/publish on release tags (Task 10); licensing and attribution (Tasks 1, 11); verification items (Task 9); version `0.0.1` (Tasks 1, 11).
- **Step scan:** every step names a file, a signature, or a command with expected output.
- **Type consistency:** `UpstreamManifest`, `VendoredSkill`, `VendoredAgent`, `Permission`, `REVIEWER_IDS`, `EGM_COMMANDS`, and the three host interfaces are defined once and reused by later tasks.
- **Review Focus:** the five items each have a named owning test.
- **Proportion:** the plan states decisions and test intent; the implementer writes the bodies.
