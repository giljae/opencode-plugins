# @giljae/opencode-pstack

**Make your coding agent work like a careful engineer, not a fast typist.**

An **unofficial port** of [pstack](https://github.com/cursor/plugins/tree/main/pstack),
Lauren Tan's agent workflow stack, for [OpenCode](https://opencode.ai).

Published on npm:
[`@giljae/opencode-pstack`](https://www.npmjs.com/package/@giljae/opencode-pstack).
This package is not affiliated with Cursor or the author and is not endorsed by
either. The content under `vendor/pstack` is reproduced unchanged from upstream
(MIT); see `NOTICE`.

---

## What it does for you

You ask for a change. The agent writes code and stops. You then discover it
skipped a test, missed an edge case, or buried the logic in cleverness.

pstack changes the shape of that loop. It runs a **workflow**: it plans before it
writes, delegates the work to separate subagents, verifies the result, and keeps
the code and the prose clean. The goal is **less code, higher quality**, not
more output.

You start a task with one command:

```
/pstack-poteto-mode add a retry to the upload client and prove it works
```

## What is pstack?

pstack is a stack of 58 workflows (skills) that an orchestrator runs for you. It
picks a playbook for your request — feature, bug fix, refactor, perf,
investigation — and does the right steps: design, build, verify, ship.

The other half is **model routing**: a strong model to write code, a fast one
for mechanical edits, and a panel of different models to review. You choose
which of *your* models plays each role.

## What you get

| | |
|---|---|
| **58 skills** | pstack's workflows, each available as a `/pstack-<skill>` command. |
| **2 agents** | `poteto-agent` (the delegate that does the work) and `comment-sicko` (the comment hater). |
| **Model routing** | A `pstack` orchestrator agent that dispatches the model you chose for each role. |

## Requirements

- OpenCode V2 (built and checked against OpenCode 2.0.11).
- **Node 22** or newer.
- At least one model provider configured in OpenCode — the plugin uses the
  models **configured in your own OpenCode**, whatever providers you use.
  Nothing is assumed or hardcoded.

## Get started

**1. Install the plugin.**

```sh
opencode plugin add @giljae/opencode-pstack
```

**2. Choose your models.** In a new session, run:

```
/pstack-setup
```

It lists the models configured in your OpenCode and creates
`.opencode/pstack-models.md` with one line per role. Open that file and put a
model on each line, for example:

```
code, prose, judgment: glm-5.3
bug-fix: deepseek-v4-flash
perf-issue: deepseek-v4-flash
hillclimb: deepseek-v4-flash
feature, refactoring: glm-5.3
swarm workers: deepseek-v4-flash
arena runners: glm-5.3, qwen3.7-plus
arena cross-judge pool: qwen3.7-plus
interrogate reviewers: glm-5.3, qwen3.7-plus
```

A role with a comma-separated list is a **panel**: pstack runs one subagent per
model and compares them. Different vendors on a panel disagree usefully.

**3. Apply it.** Run `/pstack-setup` again. It writes a `pstack` orchestrator,
one `pstack-model-*` subagent per model you named, and the two pstack agents.

## How to run a task

1. Select the `pstack` agent.
2. Run:

```
/pstack-poteto-mode   <describe what you want>
```

`/pstack-poteto-mode` is usually all you need; it pulls in the other skills
itself. To run one directly:

```
/pstack-tdd            write a failing test first
/pstack-architect      do a design pass
/pstack-unslop         clean up the prose
```

Every skill follows the same pattern: `/pstack-<skill name>`.

## How to change your models later

Open `.opencode/pstack-models.md`, edit the line you want, and run
`/pstack-setup` again. Your existing choices are kept; only what you changed is
updated.

## Which model for which role?

- **`code, prose, judgment`** — your strongest model. Writes code, plans, and
  makes judgment calls.
- **`swarm workers`** — a fast, cheap model. Mechanical edits and verification.
- **`bug-fix`, `perf-issue`, `hillclimb`, `feature, refactoring`** — the model
  for that kind of work, usually your strong model.
- **panel roles** (`arena runners`, `interrogate reviewers`, `arena cross-judge
  pool`) — a list, ideally of different vendors.

You cannot get this wrong permanently — change it any time.

## How the model routing works

OpenCode picks a model per **agent**, not per subagent call. So this port
generates one agent per `(model, variant)` — for example `pstack-model-glm-5-3`
or `pstack-model-deepseek-v4-flash` — and the `pstack` orchestrator dispatches
the agent that matches the role. Effort levels map to the model's OpenCode
`#variant` where the provider exposes one.

## Troubleshooting

- **No models are listed by `/pstack-setup`.** Configure a provider in OpenCode
  first (`opencode auth login`) and confirm with `opencode models`.
- **A role still says it has no model.** Fill in that line in
  `.opencode/pstack-models.md` and run `/pstack-setup` again. An unset role is
  reported, never silently defaulted.
- **`pstack-setup` generated no agents.** Every role must have a model before it
  can build the agents; check for a message naming the missing roles.
- **A step mentions Cursor-only features.** `automations`, `bugbot`, and
  `.cursor` settings do not exist here; the orchestrator notes the skip and
  continues.
- **The `statechart` skill fails.** It needs Java and the TLA+ tools; install
  them, or skip that skill.

## Limits worth knowing

- A role uses its agent's fixed model — there is no switching models mid-step.
- Skill loading and live routing were not exercised on a real model in this
  build; see the verification note below.

## How updates work

The bundled content tracks the `version` field of `pstack/plugin.json` on the
`cursor/plugins` `main` branch. The current bundle is **0.15.43**. A scheduled
workflow re-syncs and republishes when upstream bumps that version.

## Verification status

What was checked on a real OpenCode is recorded in the source repository at
`docs/verification/opencode-pstack-spike.md`. In short: the generated agents are
discovered and their model/variant is parsed correctly; skill loading and live
routing are not yet verified. Treat anything not recorded there as unverified.

## License

Apache-2.0 for this adapter; the vendored content is MIT. See
[`LICENSE`](LICENSE), [`NOTICE`](NOTICE), and `vendor/pstack/LICENSE.upstream`.
