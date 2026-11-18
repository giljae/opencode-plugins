# opencode-pstack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@giljae/opencode-pstack`, an OpenCode V2 plugin that registers pstack's 58 skills (each as a slash command) and two agents, and lets the user map pstack's roles to the models already configured in their OpenCode install.

**Architecture:** Vendor pstack unchanged. The plugin registers skills (explicitly-invoked) and a `pstack-<skill>` command per skill. A `/pstack-setup` command enumerates the user's models, asks per role, writes one subagent per `(model, variant)` plus the upstream agents and a `pstack` orchestrator into `.opencode/agents/`, and writes a role→agent map the orchestrator reads. No provider or model is hardcoded.

**Tech Stack:** TypeScript (shipped as source), Node >= 22, npm workspaces, Vitest, `@opencode/plugin`.

**Spec:** `docs/superpowers/specs/2026-11-18-opencode-pstack-design.md`

## Global Constraints

- Package `@giljae/opencode-pstack`; plugin id `pstack`; first version `0.0.1`.
- **Provider-agnostic: no provider or model id may appear in the package, prompts, or generated files.** Model choices come only from `ctx.model.list()` at setup time.
- Skills registered as explicitly-invoked (`autoinvoke: false`) because 57 of 58 upstream skills set `disable-model-invocation`.
- One `pstack-<skill-id>` slash command per registered skill, plus `pstack-setup`.
- Agents are installed as markdown files (OpenCode plugins cannot add agents).
- Vendor upstream content unchanged; keep the MIT copyright; no edits to skill, agent, or doc text.
- Upstream trigger: the `version` field of `pstack/plugin.json` on the cursor/plugins `main` branch.
- Vendor config excludes `pstack/automations` and `pstack/assets`.
- No Cursor-only behavior (`automations`, `bugbot`, `.cursor`); the adapter notes a skipped step instead.
- Reuse `scripts/lib/sync-core.mjs` and `scripts/sync.mjs` unchanged.

## Review Focus

Failure modes the spec implies that no single task's happy-path test covers; each is pinned by a test in the owning task.

1. A provider or model id is hardcoded somewhere, so the plugin assumes one vendor — the generated files and setup must contain only entries from `ctx.model.list()`. (Task 6, Task 7)
2. Skills are registered without `autoinvoke: false`, flooding every prompt with 58 skills. (Task 4)
3. A generated model-agent carries no `model`/`variant`, so routing is inert. (Task 6)
4. A `pstack-<skill>` command maps to the wrong or a missing skill id. (Task 5)
5. The orchestrator cannot translate a pstack slug/role into a dispatch, so `poteto-mode` does not route. (Task 6, Task 8)
6. The heaviest skill (`statechart`, ~408 files) breaks registration or path resolution. (Task 3, Task 8)

---

### Task 1: Scaffold the opencode-pstack package

**Files:**
- Create: `packages/opencode-pstack/{package.json,tsconfig.json,vitest.config.ts,LICENSE,NOTICE,README.md,vendor.config.json}`
- Create: `packages/opencode-pstack/src/index.ts` (placeholder)
- Test: `packages/opencode-pstack/test/package.test.ts`

**Interfaces:**
- Consumes: the config format from the postgres port.
- Produces: an installable workspace package.

- [ ] **Step 1: Write the failing test**

`test/package.test.ts`: `name === "@giljae/opencode-pstack"`, `version === "0.0.1"`, `engines.node` includes `>=22`, `publishConfig.access === "public"`, `exports["."] === "./src/index.ts"`, `files` includes `vendor`, `dependencies["@opencode/plugin"]` is pinned, and `LICENSE`/`NOTICE` exist.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/opencode-pstack/test/package.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create the package, install, and test**

`vendor.config.json`: upstream `https://github.com/cursor/plugins`, trigger `versionFile`, branch `main`, versionFile `pstack/plugin.json`; include `pstack/skills` → `skills`, `pstack/agents` → `agents`, `pstack/docs` → `docs`, `pstack/README.md` → `README.upstream.md`, `pstack/LICENSE` → `LICENSE.upstream`, `pstack/plugin.json` → `upstream-plugin.json`; exclude `pstack/automations`, `pstack/assets`; dest `vendor/pstack`; manifestField `pstack`. `NOTICE` records Lauren Tan's MIT copyright.

Run: `npm install && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/opencode-pstack package.json package-lock.json
git commit -m "chore: scaffold opencode-pstack package"
```

---

### Task 2: Vendor pstack

**Files:**
- Create (generated): `packages/opencode-pstack/vendor/pstack/**`, `UPSTREAM.json`
- Test: `packages/opencode-pstack/test/vendor-drift.test.ts`

**Interfaces:**
- Consumes: `scripts/sync.mjs`.
- Produces: the vendored tree and the recorded upstream.

- [ ] **Step 1: Write the failing test**

`test/vendor-drift.test.ts`: `verifyVendored` returns `[]`; the manifest lists `skills/poteto-mode/SKILL.md`, `agents/poteto-agent.md`, `agents/comment-sicko.md`, and `skills/statechart/SKILL.md`; `pkg.pstack.upstream.version` equals `manifest.version`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/opencode-pstack/test/vendor-drift.test.ts`
Expected: FAIL.

- [ ] **Step 3: Sync, then test**

Run: `node scripts/sync.mjs --plugin packages/opencode-pstack && npm test`
Expected: vendored tree present (~500 files); PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/opencode-pstack
git commit -m "feat: vendor upstream pstack with provenance"
```

---

### Task 3: Content parsing (skills and agents)

**Files:**
- Create: `packages/opencode-pstack/src/content.ts`
- Test: `packages/opencode-pstack/test/content.test.ts`

**Interfaces:**
- Produces:
  - `UpstreamManifest`, `VendoredSkill`, `VendoredAgent`.
  - `parseFrontmatter(markdown): { data, body }`
  - `listSkills(bundleDir): VendoredSkill[]` — `autoinvoke` is `false` when the frontmatter has `disable-model-invocation: true` (Review Focus 6 covers the heavy skill being present).
  - `listAgents(bundleDir): VendoredAgent[]`
  - `readUpstreamManifest(bundleDir): UpstreamManifest`

- [ ] **Step 1: Write the failing test**

`test/content.test.ts`: `listSkills("vendor/pstack")` returns 58 entries including `statechart`, `poteto-mode`, `tdd`; `poteto-mode` has `autoinvoke === false`; `listAgents` returns `poteto-agent` (with a `model` field in the tree) and `comment-sicko`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/opencode-pstack/test/content.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/content.ts`** (same shape as the earlier ports, plus `autoinvoke`)

- [ ] **Step 4: Run to verify pass, then commit**

Run: `npx vitest run packages/opencode-pstack/test/content.test.ts`
Expected: PASS.

```bash
git add packages/opencode-pstack/src/content.ts packages/opencode-pstack/test/content.test.ts
git commit -m "feat: parse vendored pstack skills and agents"
```

---

### Task 4: Skill registration

**Files:**
- Create: `packages/opencode-pstack/src/host.ts`, `src/skills.ts`
- Test: `packages/opencode-pstack/test/skills.test.ts`

**Interfaces:**
- Produces:
  - `host.ts`: `SkillDefinition` (with `autoinvoke?: boolean`), `SkillHost`, `CommandHost`, `McpHost`-free (this package needs no MCP).
  - `registerSkills(host: SkillHost, bundleDir: string): Promise<number>` — passes `autoinvoke` through.

- [ ] **Step 1: Write the failing test**

`test/skills.test.ts`: a fake `SkillHost`; `registerSkills("vendor/pstack")` registers 58 skills, each with an absolute `path` to the vendored `SKILL.md`, `content` without frontmatter, and `autoinvoke === false` for a `disable-model-invocation` skill (Review Focus 2).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/opencode-pstack/test/skills.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/host.ts` and `src/skills.ts`**

- [ ] **Step 4: Run to verify pass, then commit**

```bash
git add packages/opencode-pstack/src/host.ts packages/opencode-pstack/src/skills.ts packages/opencode-pstack/test/skills.test.ts
git commit -m "feat: register vendored pstack skills as explicit skills"
```

---

### Task 5: Command registration

**Files:**
- Create: `packages/opencode-pstack/src/commands.ts`
- Test: `packages/opencode-pstack/test/commands.test.ts`

**Interfaces:**
- Produces:
  - `commandName(skillId: string): string` → `pstack-<skillId>`.
  - `registerCommands(host: CommandHost, bundleDir: string, agentId: string): Promise<number>` — one command per skill, each forwarding to the orchestrator, plus `pstack-setup` is registered separately (Task 7).

- [ ] **Step 1: Write the failing test**

`test/commands.test.ts`: a fake `CommandHost`; one command per vendored skill, named `pstack-<skillId>`; executing `pstack-poteto-mode` calls `session.prompt` with the orchestrator agent and a text that names `poteto-mode` (Review Focus 4).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/opencode-pstack/test/commands.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/commands.ts`**

- [ ] **Step 4: Run to verify pass, then commit**

```bash
git add packages/opencode-pstack/src/commands.ts packages/opencode-pstack/test/commands.test.ts
git commit -m "feat: register a pstack-<skill> command for every skill"
```

---

### Task 6: Model map and agent generation

**Files:**
- Create: `packages/opencode-pstack/src/models.ts`, `src/agents.ts`, `src/install.ts`
- Test: `packages/opencode-pstack/test/models.test.ts`, `test/agents.test.ts`

**Interfaces:**
- Produces:
  - `ROLES: readonly string[]` (pstack's roles: `code, prose, judgment`, `bug-fix`, `perf-issue`, `hillclimb`, `feature, refactoring`, `swarm workers`, `arena runners`, `arena cross-judge pool`, `interrogate reviewers`).
  - `modelAgentId(provider: string, model: string, variant?: string): string` → `pstack-model-<sanitized>`.
  - `renderModelMap(choices: Map<string, { provider, model, variant? }>): string` and `parseModelMap(text)`, round-tripping.
  - `AgentFile = { name: string; content: string }`.
  - `buildAgentFiles(bundleDir: string, map: RoleModelMap): AgentFile[]` — the `pstack` orchestrator (primary, `orchestratorPrompt`), one `pstack-model-*` subagent per distinct `(provider, model, variant)` with `model` and `variant` frontmatter, `poteto-agent` and `comment-sicko` from the vendored tree (delegate model applied where a role asks).
  - `orchestratorPrompt(bundleDir: string, mapPath: string): string` — instructs slug/role → `subagent` dispatch by agent id; states the limits; skips Cursor-only steps.
  - `installAgents(files, targetDir): string[]`, `writeModelMap(path, content)`.

- [ ] **Step 1: Write the failing tests**

`test/models.test.ts`: `modelAgentId` sanitizes (`openai/gpt-6.2` + `high` → `pstack-model-openai-gpt-6-2-high`); `renderModelMap`/`parseModelMap` round-trip; **no test or fixture may contain a real provider name** — use placeholder providers (Review Focus 1).
`test/agents.test.ts`: `buildAgentFiles` against a fixture map returns the `pstack` primary, one subagent per distinct model with the right `model`/`variant` frontmatter (Review Focus 3), and the two upstream agents; the orchestrator body contains the map path and no hardcoded model id (Review Focus 1, 5).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/opencode-pstack/test/models.test.ts packages/opencode-pstack/test/agents.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/models.ts`, `src/agents.ts`, `src/install.ts`**

- [ ] **Step 4: Run to verify pass, then commit**

```bash
git add packages/opencode-pstack/src/models.ts packages/opencode-pstack/src/agents.ts packages/opencode-pstack/src/install.ts packages/opencode-pstack/test
git commit -m "feat: generate model-routing agents and a role map"
```

---

### Task 7: Plugin entry and the `/pstack-setup` command

**Files:**
- Create: `packages/opencode-pstack/src/setup.ts`, `src/pstack-setup.ts`
- Modify: `packages/opencode-pstack/src/index.ts`
- Test: `packages/opencode-pstack/test/setup.test.ts`, `test/pstack-setup.test.ts`

**Interfaces:**
- Produces:
  - `Host = SkillHost & CommandHost`
  - `runSetup(host: Host, bundleDir: string, agentId: string): Promise<{ skills: number; commands: number }>`
  - `registerSetupCommand(host: CommandHost, options: { bundleDir: string; targetDir: string; mapPath: string }): Promise<void>` — the `/pstack-setup` command. Its `execute` lists models via a `ModelHost` (`ctx.model.list()`), prompts the user for a per-role choice, then writes agents and the map. The model listing and answer are injected so the pure parts are testable.
  - `ModelHost = { model: { list(): Promise<{ provider: string; id: string; variants?: string[] }[]> } }`
  - `export default Plugin.define({ id: "pstack", async setup(ctx) { … } })`

- [ ] **Step 1: Write the failing tests**

`test/setup.test.ts`: `runSetup` over the real bundle returns `{ skills: 58, commands: 58 }` and registers `pstack-setup`.
`test/pstack-setup.test.ts`: with a fake `ModelHost` returning placeholder providers, the setup command offers exactly those models (nothing else) and, after a chosen map is supplied, writes the expected agent files and map; with a role left unchosen it reports the role rather than defaulting (Review Focus 1).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/opencode-pstack/test/setup.test.ts packages/opencode-pstack/test/pstack-setup.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/setup.ts`, `src/pstack-setup.ts`, `src/index.ts`**

- [ ] **Step 4: Full suite and typecheck, then commit**

Run: `npm test && npm run typecheck`
Expected: PASS.

```bash
git add packages/opencode-pstack/src
git commit -m "feat: wire the pstack plugin entry and setup command"
```

---

### Task 8: Live OpenCode spike

**Files:**
- Create: `docs/verification/opencode-pstack-spike.md`

**Interfaces:**
- Consumes: the built package and the user's configured models.
- Produces: findings recorded with the OpenCode version and the models used.

- [ ] **Step 1: Load the plugin and run `/pstack-setup`**

Install in a scratch project, run `/pstack-setup`, and confirm it lists the user's configured models (all providers) and writes agents + the map.

- [ ] **Step 2: Verify the seven items**

1. `ctx.model.list()` exposes the user's real models and variants.
2. A generated `pstack-model-*` subagent runs on the model in its frontmatter (confirm in the child session).
3. The 58 skills register with `autoinvoke: false`; a `pstack-<skill>` command loads its skill.
4. `pstack-poteto-mode` (or `@poteto-mode`) loads, and the orchestrator dispatches a model-agent by id.
5. Background subagents and the depth-one limit behave with a delegate.
6. No Cursor-only step hard-fails; a skipped step is noted.
7. The `statechart` skill's scripts load (toolchain need recorded).

- [ ] **Step 3: Record and adjust**

Write `docs/verification/opencode-pstack-spike.md`: one line per item, `pass`/`fail`/`unverified`, the command, and the observed result. Any finding that changes a Task 1-7 decision becomes a follow-up commit referencing the document.

- [ ] **Step 4: Commit**

```bash
git add docs/verification/opencode-pstack-spike.md
git commit -m "docs: record the pstack OpenCode spike"
```

---

### Task 9: Docs and first release

**Files:**
- Modify: `README.md` (root plugin table)
- Modify: `packages/opencode-pstack/README.md`
- Test: `packages/opencode-pstack/test/readme.test.ts`

**Interfaces:**
- Produces: the published `@giljae/opencode-pstack@0.0.1`.

- [ ] **Step 1: Write the failing test**

`test/readme.test.ts`: the README contains `opencode plugin add @giljae/opencode-pstack`, the npm link, `/pstack-setup`, `pstack-poteto-mode`, a statement that models are chosen from the user's own OpenCode install (any provider), the Node >= 22 requirement, `MIT` attribution, "not affiliated with or endorsed by" Cursor and the author, and the vendored upstream version.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/opencode-pstack/test/readme.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write both READMEs and add the plugin to the root table**

Document: install; `/pstack-setup` (choose your models); the `pstack-<skill>` commands; the routing limits (no per-call model, panels are agents, Cursor-only steps skipped); the statechart toolchain.

- [ ] **Step 4: Full suite**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Publish the first version** (human action, npm 2FA)

`npm publish --workspace @giljae/opencode-pstack`

- [ ] **Step 6: Commit**

```bash
git add README.md packages/opencode-pstack/README.md packages/opencode-pstack/test/readme.test.ts
git commit -m "docs: document and release @giljae/opencode-pstack 0.0.1"
```

---

## Self-Review

- **Spec coverage:** provider-agnostic setup (Tasks 6, 7, 9); skills explicitly-invoked (Tasks 3, 4); per-skill commands (Task 5); model-agents + map + orchestrator prompt (Tasks 6, 7); unchanged vendoring + MIT (Tasks 1, 2, 9); trigger (Tasks 1, 2); Cursor-only skips (Tasks 6, 8); heavy skill (Tasks 3, 8); spike (Task 8).
- **Step scan:** each step names a file, a signature, or a command with an expected result.
- **Type consistency:** `UpstreamManifest`, `VendoredSkill`, `VendoredAgent`, `SkillHost`, `CommandHost`, `Host`, `ModelHost`, `RoleModelMap`, `AgentFile` are defined once and reused.
- **Review Focus:** the six items each have a named owning test.
- **Proportion:** the plan states decisions and test intent; the implementer writes the bodies.
