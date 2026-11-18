# OpenCode pstack spike

Date: 2026-11-18
Environment: OpenCode 2.0.11 (macOS, Node 24.20.0). Plugin loaded from
`.opencode/plugins/pstack` (a re-export of the package's `src/index.ts`).
**No model call succeeded:** the ClinePass key rejects non-Cline clients
(`403: ... only available via Cline product surfaces`), and no provider was
configured in OpenCode, so `opencode models` listed nothing.

## Results

| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1 | `ctx.model.list()` exposes the user's real models | **unverified** | No provider configured; `opencode models` returned nothing. The setup refuses to default when models are missing. |
| 2 | A generated model-agent runs on its model | **partial** | OpenCode parsed `model: provider-c/model-d#high` into the agent as `{ providerID: "provider-c", id: "model-d", variant: "high" }` (`debug agents`). No run was possible. |
| 3 | Skills register with `autoinvoke: false`; a `pstack-<skill>` command loads its skill | **unverified** | Needs a model session to load a skill. The plugin loads (server log). |
| 4 | `pstack-poteto-mode` loads and the orchestrator dispatches a model-agent by id | **unverified** | Needs a model. |
| 5 | Background subagents and the depth-one limit behave with a delegate | **unverified** | Needs a model. |
| 6 | No Cursor-only step hard-fails; a skipped step is noted | **unverified** | Needs a model. |
| 7 | The `statechart` scripts load | **unverified** | Needs a model and the Java/TLA toolchain. |

### Offline verification that did pass

- The generated agents are discovered: `debug agents` lists `pstack`
  (primary), the `pstack-model-*` subagents, `poteto-agent`, and
  `comment-sicko`.
- The generated `model: <provider>/<model>#<variant>` frontmatter is parsed into
  the agent's model with its variant, which is the mechanism the routing depends
  on.
- The orchestrator agent carries `orchestratorPrompt` as its system prompt, and
  `poteto-agent` carries the delegate role's model.
- The role→agent model map is written with the user's chosen models only.

## Findings

- **Routing holds structurally.** OpenCode turns the generated per-agent model
  into the agent's resolved `providerID`/`id`/`variant`, so one agent per
  `(model, variant)` reproduces pstack's per-role routing.
- **A real model run is required** to verify skill loading, live routing, and
  panels. The available ClinePass credential cannot serve it, and no other
  provider is configured.

## Install path

`@giljae/opencode-pstack@0.0.1` was installed with `opencode plugin add`.
OpenCode added it to the global config, installed the package (with all 58
vendored skills) into `~/.cache/opencode/npm/…`, and loaded `src/index.ts`
(server log: `loading plugin id=@giljae/opencode-pstack`). Agents generated from
the installed bundle were discovered by `debug agents` with the right model
(`pstack`, `pstack-model-provider-a-model-b`, `poteto-agent`, `comment-sicko`).
The install was then removed and the config restored.

## Limits

- Items 1 and 3-7 stay unverified until a model is run.
- The npm install path is verified; a live model run is not.
