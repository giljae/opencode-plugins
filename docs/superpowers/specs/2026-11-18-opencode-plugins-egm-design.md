# opencode-plugins monorepo and the EGM OpenCode V2 port

Date: 2026-11-18
Status: proposed (awaiting human approval)

## Intent and why

Publish a public npm monorepo that ships several OpenCode plugins and skills.
The first deliverable is an OpenCode **V2** distribution of Google's
Elephant-Goldfish Model (EGM), packaged so that `opencode plugin add` installs
the whole workflow in one step.

The reason to build this rather than rely on upstream: upstream's OpenCode
support is a V1-era, out-of-tree **installer script**
(`adapters/opencode/install.py`, pinned to CLI 1.18.29). Its V2 work is in
flight (issue #282, an unmerged contributor branch with live runs on OpenCode
2.2.6) and, like V1, is expected to ship as an installer, not as an npm plugin.
The gap this repo fills is the **distribution form**: a real OpenCode V2 plugin
package that reuses EGM's canonical content unchanged and tracks upstream
commits.

"Track upstream" is a hard requirement: when upstream changes its skills,
personas, or standards, we republish a new version rather than diverge.

## Goals

- An npm monorepo where one OpenCode plugin = one publishable package.
- First package `@giljae/opencode-egm`: installs EGM's orchestrator, reviewer
  subagents, skills, and commands into OpenCode V2 through the plugin API.
- Reuse upstream EGM content **unchanged** (skills, agent personas, resources,
  document standards). We add adapter code only; we fork no skill text.
- Deterministic, provenance-recorded upstream sync at a pinned commit, with a
  CI drift check.
- Public distribution with correct Apache-2.0 attribution and no implied Google
  endorsement.
- A structure that makes the second and third plugin cheap to add.

## Non-goals

- Reimplementing or improving EGM's reasoning, wording, or standards.
- Supporting OpenCode V1.
- Claiming "verified isolation" or "verified OpenCode support" before we have
  the evidence upstream itself demands (clean profile, fixed model, recorded
  traces).
- GUI, TUI, or RPC plugin parts in the first release.
- Publishing any plugin other than `@giljae/opencode-egm` in the first release.
- Copying files into a user's global OpenCode config (see anti-goals).

## Anti-goals

- A package that mutates global or project OpenCode config as a side effect of
  install. Upstream's installer deliberately writes outside the source tree; a
  published plugin must not.
- Drift: shipping upstream content that no longer matches the recorded commit.
- Any naming or copy that implies Google authorship, support, or endorsement of
  this distribution.
- Silent scope inflation: shipping all seven skills while implying they are all
  equally verified.

## Constraints

- **OpenCode V2 interfaces.** Target the installed V2 line (2.x). V2 differs
  from V1: `permissions` is an ordered rule array (last match wins), the
  delegation tool is `subagent` (not `task`), agents live under
  `.opencode/agents/`, and plugins are npm packages with a server part
  (`@opencode/plugin`, `Plugin.define`, `setup(ctx)`). The V1 adapter in
  upstream does not apply.
- **Registration surface (verified against `@opencode/plugin` 2.0.11 and
  2.3.1).** A server plugin can add **skills** (`ctx.skill.transform`, with
  `id`/`name`/`description`/`path`/`content`), **commands**
  (`ctx.command.transform`), tools, and other domains, and can read/assert
  permissions (`ctx.permission`).
- **Plugins cannot add agents.** `AgentEditor` exposes
  `list`/`get`/`update`/`remove`/`default` but no `add` in any V2 version. Editable
  domains that do have `add`: skill, command, tool, provider, reference,
  artifact, vcs, websearch, worktree. Agents come only from the config `agents`
  object (inline definitions; no paths array) or from markdown under
  `.opencode/agents/`, `~/.config/opencode/agents/`, or `/etc/opencode/agents/`.
  This changes the install model: the plugin registers skills and commands, and
  an explicit install step writes the nine agent files.
- **Skill file layout matters.** EGM skills reference sibling files. Some are
  skill-relative (`references/...`), others are bundle-root-relative
  (`agents/...`, `resources/document_standards/...`). Vendored layout must
  preserve both, and skill registration must give the agent a working base
  directory (directory-form `SKILL.md`), because flat skills lose the
  neighboring-file list.
- **`.env` protection.** `grep` bypasses per-file `read` rules and can expose
  `.env` files (upstream finding). Reviewers must deny `grep`.
- **Licensing.** Upstream is Apache-2.0 with `SPDX-License-Identifier:
  Apache-2.0` headers and per-file copyright. Redistribution requires retaining
  copyright notices and shipping the license. Upstream has no `NOTICE` file.
- **npm operational prerequisite.** Scope `@giljae` does not yet exist on the
  registry and no npm login is present. Publishing requires creating the scope
  and authenticating. Not a design decision, but a release blocker to record.

## Approaches

### A. Vendored content + our own thin V2 adapter (chosen)

Vendor upstream's canonical content at a pinned commit, and write the OpenCode
V2 registration/permission adapter ourselves. The package is a real plugin;
`opencode plugin add @giljae/opencode-egm` installs everything.

- Trades: best UX and full control of the distribution; we own the adapter and
  must follow V2 API changes; overlaps some of upstream #282; we must keep the
  adapter separable so it can be swapped for upstream's when that lands.
- Why chosen: the value of this repo is the distribution form, which upstream is
  unlikely to provide and whose timeline we do not control. The adapter is the
  part that must track the OpenCode V2 API regardless, so writing it now costs
  little that waiting would avoid.

### B. Wait for upstream #282, then wrap its adapter

Vendor upstream's V2 adapter (once merged) and republish it as a plugin.

- Trades: least duplication and automatic alignment; blocked on an unmerged,
  not-yet-design-approved issue; and upstream's adapter is likely an installer,
  so a wrapping plugin layer is still ours to write.

### C. Content-only bundle, no adapter code

Ship markdown only and document a config/`skills`-array setup.

- Trades: least code; but agents and commands cannot be registered by config
  arrays alone, so setup becomes manual and the one-line install UX is lost.
  Rejected.

## Architecture

### Repository layout (npm workspaces)

```
opencode-plugins/
  package.json            # workspaces, scripts, devDeps
  tsconfig.base.json
  LICENSE                 # Apache-2.0
  README.md
  scripts/
    sync-upstream.mjs     # vendor one upstream commit (shared)
  packages/
    opencode-egm/
      package.json
      README.md
      LICENSE
      NOTICE              # attribution for vendored Google content
      src/
        index.ts          # Plugin.define + setup(): registers everything
        paths.ts          # bundle root resolution
        agents.ts         # reviewer + orchestrator registration
        skills.ts         # skill registration from vendored dirs
        commands.ts       # /egm-* command registration
        permissions.ts    # V2 permission rule sets
      vendor/egm/         # upstream content, unchanged
        UPSTREAM.json     # repo, commit, ref, fetched_at, sha256 map
        agents/ skills/ resources/ docs/
```

Future plugins add a sibling under `packages/` with the same shape and reuse
`scripts/sync-upstream.mjs`.

### Runtime behavior

`setup(ctx)`:

1. Resolve `bundleRoot` to the vendored directory inside the installed package.
2. Register skills: for each `vendor/egm/skills/<id>/SKILL.md`, register with
   the path-derived id, frontmatter name/description, absolute `path`, and body
   `content`, preserving the directory form so `references/` resolve.
3. Register commands: `/egm-brainstorm`, `/egm-draft`, `/egm-review`,
   `/egm-review-loop`, `/egm-resolve`, `/egm-bootstrap`, `/egm-drift-report`,
   each prompting the `egm` agent to load the matching skill with `$ARGUMENTS`,
   plus `/egm-install-agents`.
4. Register agents by writing files, not through the plugin API: the
   `/egm-install-agents` command writes nine markdown agent files into the
   project's `.opencode/agents/` directory (or a target passed in the command),
   generated from the vendored personas plus our orchestrator prompt and
   permission rules. The orchestrator prompt embeds the installed bundle path.
   Re-run after a plugin update.
5. Tell the orchestrator the absolute `bundleRoot` (embedded at install time) so
   bundle-root references (`agents/`, `resources/`) resolve.

### Permissions (V2 rule arrays)

- Reviewers: deny everything, then allow `read` and `glob`; deny `grep`; deny
  `.env` and `.env.*` reads (`*.env.example` allowed); allow read of the bundle
  directory; no edit, shell, subagent, or skill.
- Orchestrator: allow `read`/`glob`/`grep`; allow `skill` for `egm-*`; allow
  `subagent` only for the eight reviewer ids; ask for edits and shell; allow
  bundle reads.
- Exact encoding of "deny everything except X" is an open verification item
  (see below).

## Upstream sync and provenance

- `scripts/sync-upstream.mjs --ref <tag|sha>` fetches
  `google/elephant-goldfish-model` at that ref, copies the whitelist
  (`agents/`, `skills/`, `resources/`, relevant `docs/`, `LICENSE`), and writes
  `vendor/egm/UPSTREAM.json` with the repo, ref, commit, fetch time, and a
  SHA-256 per file.
- No hand-editing of vendored files. If upstream content needs a change, it goes
  upstream or the sync breaks.
- CI verifies the vendored tree matches `UPSTREAM.json` hashes and that no file
  is present that the manifest does not list.
- The sync itself needs network and is not run in ordinary CI.

## Automatic reflection and publishing (requirement)

When upstream updates, this distribution must refresh and publish without a
human doing it by hand. A scheduled workflow (`.github/workflows/upstream-sync.yml`)
runs on `schedule` (daily) and `workflow_dispatch`:

1. Resolve the latest upstream release tag (`vMAJOR.MINOR.PATCH`) and compare
   its commit with `vendor/egm/UPSTREAM.json`. Exit early when unchanged.
2. When changed, run `scripts/sync-upstream.mjs`, run the unit tests, and read
   the vendored diff to classify the change (agents/skills set changed vs
   adapter-only).
3. Bump the version and write a changeset entry automatically.
4. Commit, tag, and publish to npm with `NPM_TOKEN`, using the changesets
   publishing path, then create the GitHub release.

**Trigger (decided): upstream release tags.** The workflow acts on the latest
upstream release tag `vMAJOR.MINOR.PATCH`, whose release workflow has already run
upstream's own tests. Shared skill/persona content that lands on `main` between
tags is intentionally not picked up until upstream cuts a release. Tracking
`main` HEAD (fresher but ships unreleased content) was rejected.

**Version strategy.** Independent semver owned by this repo, starting at
`0.0.1`. The upstream tag and commit are recorded in `package.json` (a custom
field), `UPSTREAM.json`, and the package README. A sync to a new upstream
release bumps `minor`; an adapter-only fix bumps `patch`. Mirroring upstream's
version was rejected because the two release cadences and contents differ.

**Safety rails for unattended publishing.** Tests must pass before publish; a
changed hash must be present or the workflow exits; the published version is
never republished; failures leave the last good version in place and open an
issue rather than publishing a partial state.

## Licensing and attribution

- Root and per-package `LICENSE` (Apache-2.0) plus a `NOTICE` recording the
  upstream project, copyright holder (Google LLC), and commit.
- Package README states it is an unofficial port of EGM, is not affiliated with
  or endorsed by Google, and links upstream.
- Package name is our own; upstream names/logos are used only descriptively.

## First-release scope

- Package: `@giljae/opencode-egm`, first published version `0.0.1`.
- Register **all seven skills** and the seven `/egm-*` commands through the
  plugin, and install **nine agent files** (one primary `egm` orchestrator and
  eight read-only reviewers) through `/egm-install-agents` (decided).
- Verification effort concentrates on `egm-review` and the
  brainstorm→draft→review path. `egm-bootstrap` and `egm-drift-report`
  (worker/scout delegation) ship with documented limitations if their required
  delegation is unavailable, mirroring upstream's own honesty about limits.
- Document OpenCode version, model, and platform used for any manual check, and
  mark anything untested as unverified.

## Decisions made in this design (builder may check)

- npm workspaces + changesets; one publishable package per plugin.
- Ship TypeScript source and let OpenCode load it (matches the documented
  `exports: { ".": "./src/index.ts" }`); typecheck with `tsc --noEmit`, no
  bundling.
- Vendored snapshot + sync script over git submodule (submodule content does not
  survive `npm pack` reliably).
- Eight reviewer subagents + one primary agent, matching upstream's adapter
  contract; no nested synthesizer agent (the primary synthesizes).
- Skills registered as directory-form entries so `references/` resolve.
- Pin the OpenCode line and `@opencode/plugin` version at implementation time and
  record both in the package README and the sync manifest.
- Agent system prompts use the persona **body only**; frontmatter is V2 agent
  metadata, not prompt text.
- Commands pass the user's text as `$ARGUMENTS`; relative target paths resolve
  against the project working directory.
- Do not set a default agent; the user selects `egm` explicitly.
- Honor an `EGM artifact directory` instruction like upstream; default to the
  working directory.
- The sync drift check runs offline in CI (vendored hashes vs manifest).
- Versioning is independent semver starting at `0.0.1` with the upstream ref
  recorded in metadata.
- Reflection and publishing are automatic, triggered by upstream release tags.
- Keep canonical `egm-*` skill ids for parity and document that, under V2
  precedence, a same-id user skill is overridden by the plugin's registration.

## Left to the builder (to verify or settle)

Open verification items, best handled by one small spike before the full
adapter:

1. Does `ctx.skill.transform` with a `path` to a directory-form `SKILL.md`
   expose the neighboring-file list and a usable base directory, and can the
   agent read `references/`, `agents/`, and `resources/` inside the installed
   package?
2. Does the V2 permission model accept a wildcard-action deny followed by
   specific allows, and is it enforced on subagents at runtime?
3. Does agent registration via `ctx.agent.transform` accept `mode: subagent`,
   a system prompt, and a `permissions` array, and does the orchestrator address
   subagents by the registered ids?
4. Are `external_directory` rules needed so the installed package (often under
   `node_modules`) is readable by both orchestrator and reviewers?
5. How much of the orchestrator prompt must be rewritten from V1 idiom
   (`task`) to V2 (`subagent`), and does the vendored skill text mention V1 tool
   names anywhere that would mislead the agent?
6. Do plugin-registered skills participate in V2 precedence in a way that
   predictably overrides a same-id user skill, and is that acceptable to
   document rather than work around?

## Verification

- Unit tests: sync determinism and manifest integrity; registration mapping
  (7 skills, 9 agents, 7 commands) from the vendored manifest; permission rule
  shapes.
- The spike above, recorded with the OpenCode and model versions used.
- Honest status reporting: installation, workflow, and isolation outcomes
  reported separately; missing evidence marked unverified.

## Operational prerequisites (not design)

- Create and authenticate the npm `@giljae` scope, and set `NPM_TOKEN` for CI.
