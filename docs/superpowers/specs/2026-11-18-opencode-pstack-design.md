# opencode-pstack: port cursor/plugins pstack to OpenCode V2

Date: 2026-11-18
Status: proposed (awaiting human approval)

## Intent and why

Add a third plugin to `opencode-plugins`: an OpenCode V2 distribution of
[pstack](https://github.com/cursor/plugins/tree/main/pstack), Lauren Tan's
opinionated agent workflow stack ("if you want to go fast, go deep first").

pstack is the hardest of the three ports, and the reason is worth stating up
front: its value is **multi-model orchestration**. `/poteto-mode` routes each
step of a task to a chosen model per role, and runs review panels of several
different models. OpenCode can select a model only per **agent**, not per
subagent call, so the port must reproduce pstack's routing by generating one
OpenCode agent per (model, effort) and dispatching by agent id. The upstream
skill text stays unchanged; the adaptation lives in our adapter layer.

## Goals

- A package `@giljae/opencode-pstack` that registers pstack's skills, its two
  agents, and an OpenCode **model-routing setup**.
- Let the user choose, per role, from the **models configured in their own
  OpenCode install** — whatever providers they use. The setup must never assume
  a provider, and no model id or provider may be hardcoded in the package
  (including cline-pass).
- Keep upstream content unchanged (skills, agents, docs, playbooks, scripts).
- Track upstream automatically (`pstack/plugin.json` version on `main`).

## Non-goals

- Reproducing Cursor-only features: `automations`, `bugbot`, `.cursor`
  settings. The adapter notes where a step needs them and continues.
- Per-subagent-call model or effort switching (OpenCode has no such parameter).
- Guaranteeing the external tooling some skills assume (statechart needs Java
  and TLA+/TLC; scripts ship, tools are the user's).
- Forking or editing upstream skill, agent, or doc text.

## Anti-goals

- A package that floods every prompt with 58 skills; 57 of them set
  `disable-model-invocation`, so they must stay explicitly-invoked.
- Assuming or hardcoding a provider or model id anywhere (setup, prompts,
  generated files). The model choices come only from the user's own install.
- Pretending the port is verified on a model set it was not tested with.
- Naming or copy that implies Cursor's or Lauren Tan's endorsement.

## Constraints

- **The setup is provider-agnostic.** It enumerates the models the user has
  configured in OpenCode (`ctx.model.list()`, cross-checked with the
  `opencode models` CLI) and requires an explicit choice per role. No provider,
  model id, or default model is baked into the package. A role with no choice
  is left unset and reported, never silently defaulted to a vendor.
- **Per-agent models only.** OpenCode agent config has `model` and `variant`;
  the `subagent` tool takes an agent id, not a model. So routing = one agent per
  (model, effort), dispatched by id. Effort maps to the model's `#variant` when
  the provider exposes one.
- **Plugins cannot add agents** (established by the EGM port). The pstack
  agents and the generated model-agents are written as files by a setup
  command.
- **57 of 58 skills set `disable-model-invocation: true`.** They must be
  registered as explicitly-invoked skills, not auto-advertised.
- **Subagent nesting depth defaults to one.** pstack's primary → delegate flow
  fits; deeper nesting would need the host option.
- **Subagents run in the background** in OpenCode and report back by id, which
  matches pstack's background delegate model.
- **Heavy skill:** `statechart` is ~408 files (TLA+, Java, test corpora). It is
  vendored unchanged; running it needs the user's Java/TLA toolchain.
- **Upstream is MIT** (Lauren Tan, 2026). Redistribution keeps the notice.
- **Upstream has no release tags** in the monorepo; the trigger is the
  `version` field of `pstack/plugin.json` on `main` (the postgres pattern).

## Approaches

### A. Model-agents + adapter prompt, upstream text unchanged (chosen)

- Vendor the skills, agents, and docs unchanged.
- `/pstack-setup` lists the user's OpenCode models, asks for a per-role choice,
  writes the generated model-agents and a role→agent map, and installs the
  upstream agents plus a `pstack` primary orchestrator.
- The orchestrator's prompt tells it to translate a pstack model slug
  (`claude-opus-5-5-xhigh-fast`) into a `subagent` dispatch of the matching
  generated agent. The mapping is our code, not an edit to pstack.
- Panels become "dispatch one agent per seat"; effort is fixed per agent.

### B. Fork pstack's routing text into OpenCode wording (rejected)

Cleaner instructions, but forks a fast-moving upstream (0.15.43) and breaks the
monorepo's "vendor unchanged" rule.

### C. Rely on the model to bridge slugs and agents with no adapter (rejected)

No map, no generated agents: fragile, and it wastes the user's time on wrong
model choices.

## Architecture

### Package

```
packages/opencode-pstack/
  package.json          # @giljae/opencode-pstack
  vendor.config.json
  README.md  LICENSE  NOTICE
  src/
    index.ts            # Plugin.define({ id: "pstack", setup })
    setup.ts            # register skills + entry commands
    content.ts          # UpstreamManifest, listSkills, listAgents
    skills.ts           # registerSkills (explicit-invocation)
    commands.ts         # entry commands: pstack-setup, pstack-mode, pstack-help
    agents.ts           # buildAgentFiles(modelMap) -> pstack orchestrator + model-agents
    install.ts          # write agent files
    models.ts           # role list, slug parsing, model-map render/parse
  vendor/pstack/        # upstream content, unchanged
    skills/ agents/ docs/ README.upstream.md LICENSE.upstream upstream-plugin.json UPSTREAM.json
```

`vendor.config.json`: repo `https://github.com/cursor/plugins`, trigger
`versionFile` at `pstack/plugin.json` on `main`, include `pstack/skills` →
`skills`, `pstack/agents` → `agents`, `pstack/docs` → `docs`,
`pstack/README.md` → `README.upstream.md`, `pstack/LICENSE` → `LICENSE.upstream`,
`pstack/plugin.json` → `upstream-plugin.json`; exclude `pstack/automations`,
`pstack/assets`.

### Runtime

`setup(ctx)`:

1. Register every vendored skill (directory-form, `autoinvoke: false`), so paths
   to `references/`, `playbooks/`, and `scripts/` resolve.
2. Register a **slash command for every skill** (prefixed `pstack-`, e.g.
   `pstack-poteto-mode`), matching pstack's `/skill` UX, plus `pstack-setup`.
   Command names are prefixed to avoid collisions; the mapping to the skill id
   is documented in the README.

`/pstack-setup` (the model routing step):

1. Enumerate models with `ctx.model.list()` (provider, id, variants).
2. Ask the user for a per-role model choice. Roles (from pstack's
   `poteto-mode`): `code, prose, judgment`, `bug-fix`, `perf-issue`,
   `hillclimb`, `feature, refactoring`, `swarm workers`, and the panel roles
   (`arena runners`, `arena cross-judge pool`, `interrogate reviewers`) as
   lists.
3. Write the generated model-agents into `.opencode/agents/` — one per
   distinct `(provider/model, variant)`, named `pstack-model-<slug>` — the two
   upstream agents (`poteto-agent` with the delegate model, `comment-sicko`),
   and the `pstack` primary orchestrator.
4. Write a role→agent map file (`.opencode/pstack-models.md`), read by the
   orchestrator.

The orchestrator prompt:

- Names the map file and instructs the orchestrator to translate a slug or role
  into a `subagent` dispatch of the mapped agent id.
- States the limits: no per-call model, panels are one agent per seat, effort is
  per-agent, Cursor-only steps are skipped with a note.
- Keeps pstack's other rules (background delegates, fresh delegate per task,
  verification on the `swarm workers` model, the `poteto-agent` read-first rule).

### Licensing and attribution

- Package `LICENSE` stays Apache-2.0 for the adapter; `vendor/pstack/LICENSE` is
  upstream's **MIT**, unchanged; `NOTICE` records Lauren Tan's copyright.
- Names used descriptively; no endorsement implied.

## First-release scope

- Package `@giljae/opencode-pstack`, first published `0.0.1`.
- All 58 skills, each reachable as a `pstack-<skill>` slash command, both
  agents, the setup command, and the routing adapter.
- Ship the vendored `statechart` skill as-is; document its toolchain need.

## Decisions made in this design (builder may check)

- Approach A; model routing via generated per-(model, variant) agents and a
  role→agent map; upstream text unchanged.
- **Provider-agnostic setup**: `/pstack-setup` offers only the models already
  configured in the user's OpenCode; nothing is hardcoded or assumed.
- Any OpenCode model may be mapped; no vendor is privileged.
- Skills registered explicitly-invoked, with a slash command per skill
  (prefixed `pstack-`) plus `pstack-setup`, matching pstack's `/skill` UX.
- `pstack` primary orchestrator installed as a file by `/pstack-setup`.
- Trigger: `pstack/plugin.json` version on `main`.
- Exclude `automations` and `assets` from the vendor tree.
- Package license Apache-2.0; vendored MIT content carries its own license and a
  NOTICE.

## Left to the builder (to verify or settle)

1. Does `ctx.model.list()` expose every model the user has configured
   (all providers), with the ids and variants needed to build the model map, and
   does a generated subagent with `model` + `variant` actually run on that
   model? The setup must show the user's real set, not a curated list.
2. Does registering a skill with `autoinvoke: false` (explicitly-invoked) match
   pstack's `disable-model-invocation`, and does `@<skill-id>` load it?
3. Can the `pstack` orchestrator dispatch generated subagents by id and
   reproduce one `poteto-mode` playbook step (a delegate plus verification)?
4. How do background subagents and the depth-one limit affect pstack's delegate
   and panel flows?
5. Do the `statechart` skill's scripts at least load, and what toolchain do they
   clearly require?
6. Does the `versionFile` trigger read `pstack/plugin.json` on `main` reliably?

## Verification

- Unit tests with fakes: `listSkills`/`listAgents` over the vendored tree,
  `registerSkills` count, `buildAgentFiles`/model-map rendering, `runSetup`
  counts and command registration.
- Drift test: vendored tree matches `UPSTREAM.json`.
- One live spike on a real OpenCode, using the user's own models: `/pstack-setup`
  writes the agents, a skill loads, the orchestrator dispatches a model-agent,
  and the chosen model is confirmed in the child session. Recorded in
  `docs/verification/opencode-pstack-spike.md`.
- Honest reporting: installation, skill loading, model routing, and panels
  reported separately; anything untested marked unverified.
