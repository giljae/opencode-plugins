# OpenCode V2 plugin verification spike

Date: 2026-11-18
Environment: OpenCode 2.0.11 (macOS, Node 24.20.0), `@opencode/plugin` 2.0.11,
isolated XDG profile under a temporary directory, no model calls (the test
account's free usage limit was reached, and no paid model was authorized).

## Method

- A scratch project with `opencode.jsonc` and an isolated `XDG_*` profile.
- Generated the nine agent files with `buildAgentFiles`/`installAgents` and
  inspected the resolved configuration with `opencode debug agents`.
- Probed plugin loading with bare modules and temporary marker files written at
  module top level and inside `setup`.

## Results

| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1 | Directory-form skill exposes `references/` and its base dir | **unverified** | Needs a model session to load a skill. |
| 2 | Wildcard deny then specific allows enforced on subagents | **partial** | `debug agents` shows our reviewer rules appended after OpenCode's built-in defaults, so last-match-wins yields read-only; runtime enforcement not exercised. |
| 3 | Nine agent files are discovered; orchestrator addresses subagents by id | **pass** | `debug agents` lists `egm` (primary) and the eight reviewers (subagent) with the generated system prompts. |
| 4 | `external_directory` behavior for the installed package | **unverified** | Not exercised. |
| 5 | No V1 `task` wording reaches the agent | **pass** | The generated orchestrator prompt contains `subagent` and no `task` tool name. |
| 6 | Plugin skill precedence against a same-id user skill | **unverified** | Not exercised. |

### Findings that shaped the design

- **Plugins cannot add agents.** `AgentEditor` exposes
  `list`/`get`/`update`/`remove`/`default` but no `add` in 2.0.11 and 2.3.1.
  Agents are therefore delivered as markdown files written by the
  `/egm-install-agents` command; see the design's constraint note.

### Plugin loading findings

- A bare `.opencode/plugins/*.ts` module is **imported** during `opencode run`
  (a top-level side effect ran).
- Our package's `src/index.ts` is imported when referenced from
  `.opencode/plugins/<dir>/index.ts` (a re-export), so the package code and its
  `@opencode/plugin` resolution work under OpenCode.
- A local plugin **directory configured through the project `plugins` array did
  not load** in 2.0.11, with an absolute path, a relative path, and a plain
  `.mjs` entry. The intended distribution path (`opencode plugin add
  @giljae/opencode-egm`, which installs the package into OpenCode's store and
  references it by name) is **unverified until the package is published**.
- `opencode run` fails on model access before session setup, so the plugin's
  `setup()` (skill and command registration) did not run in this spike.

### Reviewer permission merge (observed)

```
*/* allow            (OpenCode built-in default)
... built-in env/external defaults ...
*/* deny             (ours)
read * allow
read *.env deny
read *.env.* deny
read *.env.example allow
read <bundle>/* allow
glob * allow
grep * deny
```

Because OpenCode appends agent rules after the built-in defaults and the last
matching rule wins, a reviewer resolves to read-only with `grep` and `.env`
denied.

## Limits

- No model calls: installation, workflow, and isolation are reported separately.
- Unverified items above stay unverified. This spike does not prove skill
  loading, reviewer isolation at runtime, or end-to-end workflow behavior.
- `scripts/verify-plugin.mjs` re-runs the offline part (agent discovery and
  reviewer policy) against a local `opencode`. It needs a working OpenCode
  service for the project directory: in this sandbox a fresh XDG profile could
  not start the background service (`Timed out waiting for the background
  service to start`), so run it against a warmed profile.
