# opencode-postgres-skills: port microsoft/postgres-skills to OpenCode V2

Date: 2026-11-18
Status: proposed (awaiting human approval)

## Intent and why

Add a second plugin to the `opencode-plugins` monorepo: an OpenCode V2
distribution of [`microsoft/postgres-skills`](https://github.com/microsoft/postgres-skills).
Where `@giljae/opencode-egm` established the pattern, this port stresses it
differently — the upstream ships **skills with executable Node scripts** and a
**local PostgreSQL MCP server**, not agents.

The goal is the same as the EGM port: reuse upstream content unchanged, add only
an OpenCode V2 adapter, track upstream automatically, and publish to npm under
`@giljae`.

## Goals

- A new package `@giljae/opencode-postgres-skills` that registers upstream's
  three skills and its local Postgres MCP server in one install.
- Register the MCP server **through the plugin**, so the user edits no config:
  OpenCode V2 exposes `ctx.mcp.transform` with an editor that has `set`.
- Reuse upstream content unchanged (skills, references, scripts, docs).
- Generalize the shared tooling so more plugins are cheap: a per-package vendor
  config, one sync entry point, and one publishing workflow that loops over
  plugins.
- Track upstream automatically and republish on change.

## Non-goals

- Forking or editing upstream skill, script, reference, or doc text.
- Vendor the MCP server's source; instead depend on upstream's **pinned
  npm package** and launch it locally, so nothing is fetched at runtime.
- Porting to harnesses other than OpenCode V2.
- Making the `migrate-oracle-app` workflow work end to end — it needs Oracle,
  Java, and Maven tooling we do not supply.

## Anti-goals

- A package that makes the user hand-edit `opencode.json` for MCP or skills.
- Shipping upstream content that does not match the recorded commit.
- Implying the MCP server or the Oracle migration path is verified when it is
  not.
- Naming or copy that implies Microsoft endorsement of this distribution.

## Constraints

- **Upstream license is MIT** (Microsoft Corporation, 2025). Redistribution
  requires retaining the MIT copyright and permission notice.
- **Upstream has no usable release tags.** The only tag is
  `postgres-skills--v0.1.1`, while `plugin/plugin.json` says `0.3.0`. The
  auto-publish trigger therefore tracks the **version field in
  `plugin/plugin.json` on `main`**, not a release (decided).
- **The plugin API can register MCP.** `ctx.mcp.transform(editor => …)` with
  `editor.set(name, config)` is available in `@opencode/plugin` 2.0.11 and
  2.3.1. Local server config: `{ type: "local", command: string[], cwd?,
  environment?, disabled?, timeout?: { startup?, catalog?, execution? } }`.
- **Skills need Node >= 22 and shell execution.** Upstream scripts use Node
  built-ins (`node --test`, `node:…`) and are run by the agent through the shell
  tool, which is subject to OpenCode permission rules.
- **The MCP server is a local Node process.** `@microsoft/postgres-mcp`
  (MIT, `bin: postgres-mcp` → `bin/postgres-mcp.js`, Node >= 22) is declared as a
  **pinned dependency** of this package. OpenCode installs a plugin's
  dependencies alongside it, so the server is present on disk and is launched by
  absolute path — no `npx`, no `@latest`, no network at runtime. This keeps the
  plugin usable in air-gapped environments. (The database it connects to may of
  course be remote.)
- **Vendoring is path-mapped.** Upstream keeps content under `plugin/` while
  `LICENSE` is at the repo root, so the vendor config maps explicit source paths
  to destination paths.

## Approaches

### A. Generalize the monorepo tooling; one package per plugin (chosen)

- Each package owns a `vendor.config.json` describing its upstream, its trigger,
  and its path mappings.
- One `scripts/sync.mjs --plugin <dir>` reads that config; the current
  EGM-specific `scripts/sync-upstream.mjs` is replaced by it.
- One publishing workflow loops over the auto-publish packages instead of
  hard-coding `@giljae/opencode-egm`.
- The new package is a small adapter: register skills, register MCP.

Trades: one refactor of shared tooling up front; near-zero marginal cost for the
third plugin. This matches the root README's promise of shared tooling.

### B. Copy the EGM sync script and workflow per plugin (rejected)

Fastest to write, but duplicates and diverges the tooling the monorepo exists to
share.

### C. Bundle EGM and postgres-skills into one package (rejected)

Contradicts the "several plugins" goal and forces unrelated upgrades together.

### Upstream trigger (for this plugin)

Release tags (the EGM trigger) do not exist here. Chosen: **track the
`version` field of `plugin/plugin.json` on `main`** — upstream's own release
marker, stable, and dedupes per version. Rejected: tracking `main` HEAD (ships
unreleased content, noisier) and tracking tags (never updates).

## Architecture

### Shared tooling (generalization)

Every publishable plugin gets a `vendor.config.json`:

```jsonc
{
  "upstream": {
    "repo": "https://github.com/microsoft/postgres-skills",
    "trigger": "versionFile",            // or "release"
    "branch": "main",
    "versionFile": "plugin/plugin.json"  // for versionFile triggers
    // "tagPrefix": "v"                  // for release triggers
  },
  "include": [
    { "from": "plugin/skills", "to": "skills" },
    { "from": "plugin/MIGRATION.md", "to": "MIGRATION.md" },
    { "from": "plugin/SETUP.md", "to": "SETUP.md" },
    { "from": "LICENSE", "to": "LICENSE" }
  ],
  "exclude": [],
  "manifestField": "postgresSkills"       // package.json field recording upstream
}
```

`scripts/sync.mjs --plugin <dir>`:

1. Resolve the trigger ref:
   - `release`: the latest GitHub release tag (optionally filtered by prefix).
   - `versionFile`: the `branch` HEAD, plus the version read from `versionFile`.
2. Compare with the package's recorded upstream in `package.json` and
   `vendor/**/UPSTREAM.json`. Exit early when unchanged.
3. Clone at the resolved commit, copy each `include` entry, apply `exclude`.
4. Write `UPSTREAM.json` (`repo`, `ref`, `commit`, `version`, `fetchedAt`,
   per-file SHA-256).
5. Update the package's `manifestField` with the same identity.

The drift test (`verifyVendored`) already lives in `scripts/lib/sync-core.mjs`
and is reused.

The publishing workflow `upstream-sync.yml` becomes a loop over every
`packages/*` that has a `vendor.config.json`: for each, resolve the trigger,
compare, and if changed run sync → test → bump → publish → commit/tag/push →
release. `verify_token` and `test_publish` remain; `test_publish` publishes a
prerelease under the `test` tag for a selected package only.

### New package

```
packages/opencode-postgres-skills/
  package.json            # @giljae/opencode-postgres-skills
  vendor.config.json
  README.md  LICENSE (Apache-2.0)  NOTICE
  src/
    index.ts              # Plugin.define({ id: "postgres-skills", setup })
    setup.ts              # runSetup(host, bundleDir): register skills + MCP
    content.ts            # UpstreamManifest, listSkills(bundleDir)
    skills.ts             # registerSkills (directory-form)
    mcp.ts                # registerMcp(host): set the local server
    host.ts               # structural SkillHost + McpHost
  vendor/postgres-skills/ # upstream content, unchanged
    skills/ MIGRATION.md SETUP.md LICENSE UPSTREAM.json
```

`setup(ctx)`:

1. Resolve `bundleDir` to `vendor/postgres-skills`.
2. `registerSkills(host, bundleDir)` — three directory-form skills:
   `postgresql-best-practices`, `pg-graph`, `migrate-oracle-app`.
3. `registerMcp(host)` — set one local server, launched from the plugin's own
   installed dependency so no network is needed:

   ```ts
   import { createRequire } from "node:module";

   const require = createRequire(import.meta.url);
   const entry = require.resolve("@microsoft/postgres-mcp/bin/postgres-mcp.js");

   ctx.mcp.transform((editor) => {
     editor.set("postgres-mcp", {
       type: "local",
       command: [process.execPath, entry, "run", "--no-telemetry"],
       environment: { POSTGRES_MCP_QUERY_TIMEOUT_MS: "540000" },
       timeout: { startup: 90000 },
     });
   });
   ```

   The dependency version is pinned at implementation time and recorded in the
   README.

No agents and no commands: OpenCode registers skills and MCP from the plugin
directly, so this adapter is smaller than EGM's.

### Licensing and attribution

- Package `LICENSE` is Apache-2.0 for our adapter code.
- `vendor/postgres-skills/LICENSE` is upstream's **MIT** text, unchanged, and
  `NOTICE` records Microsoft's copyright and the frozen revision.
- The MCP server is a separate npm package with its own license; the README says
  so.
- Package name is ours; upstream names are used only descriptively, with no
  Microsoft endorsement implied.

## First-release scope

- Package `@giljae/opencode-postgres-skills`, first published `0.0.1`.
- All three skills and the local MCP server, matching upstream parity.
- `verify-portal`-free: unit tests with fakes plus one live spike (below).

## Decisions made in this design (builder may check)

- Approach A; one package per plugin; `vendor.config.json` per package.
- Upstream trigger for this plugin: `plugin/plugin.json` `version` on `main`.
- MCP server registered at runtime through `ctx.mcp.transform` + `editor.set`,
  named `postgres-mcp`, and launched from a **pinned dependency** by absolute
  path (works offline). Registered **enabled** (no `disabled` flag), matching
  upstream parity: the plugin starts a local process in every session. Stated in
  the README.
- Skills registered directory-form so `references/` and `scripts/` resolve.
- Package `LICENSE` Apache-2.0; vendored MIT content carries its own license and
  a NOTICE.
- No agents, no commands.

## Left to the builder (to verify or settle)

1. Does `ctx.mcp.transform((e) => e.set("postgres-mcp", …))` actually start the
   local server and expose its tools in a session?
2. Confirm OpenCode installs the plugin's own dependencies (including
   `@microsoft/postgres-mcp`) into its store, so the absolute-path launch works
   with no network.
3. What tool names does OpenCode expose for that server, and do the vendored
   skills' bare names (`postgres_mcp_query`, …) resolve? If they do not,
   decide the smallest mitigation that keeps skill text unmodified (for example
   the server name, or a documented name mapping).
4. Do directory-form skills expose `scripts/` and `references/`, and can the
   default agent run those scripts under its shell permission?
5. Does the `versionFile` trigger read `plugin/plugin.json` on `main` reliably
   from the workflow?
6. Does the generalized workflow loop correctly over two plugins with different
   triggers, and does `test_publish` stay isolated per package?

## Verification

- Unit tests with fakes: `listSkills` over the vendored tree, `registerSkills`
  count, `registerMcp` sets the expected server config, `runSetup` counts.
- Drift test: vendored tree matches `UPSTREAM.json`.
- One live spike on a real OpenCode: plugin loads, three skills load, the MCP
  server connects, tool names observed, recorded in
  `docs/verification/opencode-postgres-skills-spike.md`.
- Honest reporting: installation, skill loading, MCP connection, and script
  execution reported separately; anything untested marked unverified.
