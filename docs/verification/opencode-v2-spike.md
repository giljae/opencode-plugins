# OpenCode V2 plugin verification spike

Date: 2026-11-18
Environment: OpenCode 2.0.11 (macOS, Node 24.20.0), `@opencode/plugin` 2.0.11,
isolated XDG profile for the offline checks, and a live run on the
`cline-pass/baidu/ernie-5.5-flash-preview:free` model.

## Method

- A scratch project with `opencode.jsonc` and an isolated `XDG_*` profile.
- Generated the nine agent files with `buildAgentFiles`/`installAgents` and
  inspected the resolved configuration with `opencode debug agents`.
- Probed plugin loading with bare modules and temporary marker files written at
  module top level and inside `setup`.

## Results

| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1 | Directory-form skill loads and exposes its base dir | **pass** | In a live run the `egm` agent loaded the `egm-review` skill and followed its instructions. |
| 2 | Wildcard deny then specific allows enforced on subagents | **partial** | `debug agents` shows our reviewer rules appended after OpenCode's built-in defaults, so last-match-wins yields read-only; reviewers were dispatched live, but a denied call was not captured. |
| 3 | Nine agent files are discovered; orchestrator addresses subagents by id | **pass** | `debug agents` lists `egm` (primary) and the eight reviewers (subagent); a live run dispatched seven reviewer subagents by id. |
| 4 | `external_directory` behavior for the installed package | **pass** | The orchestrator read bundled docs from the package with no prompt. |
| 5 | No V1 `task` wording reaches the agent | **partial** | The orchestrator prompt has no `task`, but the vendored `docs/opencode.md` (now excluded) described the V1 adapter and the agent cited it. |
| 6 | Plugin skill precedence against a same-id user skill | **unverified** | Not exercised. |

## Live run (2026-11-18)

Model: `cline-pass/baidu/ernie-5.5-flash-preview:free` (a free tier; paid
ClinePass models were blocked with `insufficient_credits`). Plugin loaded
through `.opencode/plugins/egm/index.ts`.

- **Plugin `setup()` ran**: skills 7, commands 7 (marker evidence).
- **`egm-review` workflow ran end to end** for a three-line `design.md`: the
  `egm` agent loaded the skill, then dispatched reviewer subagents — inventive
  catalyst, zoom out (twice), comprehension, structural, style, and design —
  and wrote `zoom_out_report.md`, `comprehension_report.md`,
  `critic_report.md`, and `intermediate_zoom_out_report.md`.
- The run stopped when the free model hit its daily limit (`429`), not on a
  plugin or permission error.

### Findings from the live run

- The vendored `docs/opencode.md` described the **V1** `task` adapter and the
  agent cited it. That file is now excluded from the bundle; the orchestrator
  prompt is authoritative for V2 `subagent` dispatch.
- `opencode run` sends its message to the model and does **not** invoke slash
  commands, so `/egm-install-agents` could not be exercised headlessly. The
  agent files were written for this run by calling `buildAgentFiles` and
  `installAgents` directly. `opencode plugin add @giljae/opencode-egm` is now
  verified; see the install-path section below.

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

## Install path (2026-11-18)

With `@giljae/opencode-egm@0.0.2` published:

- `opencode plugin add @giljae/opencode-egm` installed the package from the npm
  registry into `~/.cache/opencode/npm/@giljae/opencode-egm@latest` and added
  `"@giljae/opencode-egm"` to the global `opencode.jsonc`.
- A session then **loaded it**; the server log records
  `msg="loading plugin" id=@giljae/opencode-egm entrypoint=…/node_modules/@giljae/opencode-egm/src/index.ts`.

The session's model call failed only because the global configuration did not
declare the free ClinePass model used for the test; that is unrelated to the
plugin.

## Limits

- Installation via `opencode plugin add` is verified for `0.0.2`; see the
  install-path section.
- Reviewer isolation was exercised (reviewers were dispatched in fresh
  subagent sessions) but a denied reviewer call was not captured; the merged
  permission lists are the evidence, not an observed runtime denial.
- The live run used a weak free model and stopped at a daily limit. It proves
  the plumbing — skill load, subagent dispatch, report writing, and bundle
  reads — not review quality or the human approval gates.
- `/egm-install-agents` was not exercised: `opencode run` does not invoke slash
  commands. It needs TUI verification.
- `scripts/verify-plugin.mjs` re-runs the offline part (agent discovery and
  reviewer policy) against a local `opencode`. It needs a working OpenCode
  service for the project directory: in this sandbox a fresh XDG profile could
  not start the background service (`Timed out waiting for the background
  service to start`), so run it against a warmed profile.
