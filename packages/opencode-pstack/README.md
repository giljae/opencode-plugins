# @giljae/opencode-pstack

An **unofficial port** of [pstack](https://github.com/cursor/plugins/tree/main/pstack),
Lauren Tan's agent workflow stack, for [OpenCode](https://opencode.ai).

Published on npm:
[`@giljae/opencode-pstack`](https://www.npmjs.com/package/@giljae/opencode-pstack).
This package is not affiliated with Cursor or the author and is not endorsed by
either. The content under `vendor/pstack` is reproduced unchanged from upstream
(MIT); see `NOTICE`.

## What is pstack?

Most of the time an AI coding agent does what you ask and stops. pstack is a set
of **workflows** that make it behave like a careful engineer instead: it plans
before it writes, delegates the work to separate subagents, checks the result,
and only then calls it done.

You use it by running a workflow, for example:

```
/pstack-poteto-mode add a retry to the upload client and prove it works
```

pstack picks a playbook for that request (feature, bug fix, refactor, perf,
investigation, …), runs the right steps, and applies strict rules about tests,
verification, and clean prose. The point is **higher-quality output, not more
code**.

The other half of pstack is **model routing**: different steps are better on
different models — a strong model to write code, a fast one for mechanical
edits, and several different models for a review panel. You decide which of
*your* models plays which role (see setup below).

## What this plugin adds

| | |
|---|---|
| **58 skills** | pstack's workflows, each available as a `/pstack-<skill>` command. |
| **2 agents** | `poteto-agent` (the delegate that does the work) and `comment-sicko` (the comment hater). |
| **Model routing** | A `pstack` orchestrator agent that dispatches the model you chose for each role. |

## Before you start

- OpenCode V2 (this was built and checked against OpenCode 2.0.11).
- **Node 22** or newer.
- At least one model provider configured in OpenCode — the plugin uses whatever
  you already have. Nothing is assumed or hardcoded.

## Install

```sh
opencode plugin add @giljae/opencode-pstack
```

Then start a new session.

## First-time setup (about two minutes)

pstack needs to know which of your models to use for each role. That choice is
yours, and it stays in a file you own.

**1. Run the setup command.**

```
/pstack-setup
```

It lists the models configured in your OpenCode and creates
`.opencode/pstack-models.md` with one line per role, ready to fill in.

**2. Open `.opencode/pstack-models.md` and put a model on each line.**

Use the models from the list it just showed you. For example:

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

A role with several models, separated by commas, is a **panel**: pstack runs one
subagent per model and compares them. Different vendors on a panel give a better
review.

**3. Run it again.**

```
/pstack-setup
```

Now that every role has a model, it writes the agents it needs:
a `pstack` orchestrator, one `pstack-model-*` subagent per model you named, and
the two pstack agents. Run `/pstack-setup` again any time to change a choice.

## Everyday use

1. Pick the `pstack` agent.
2. Run a workflow for the thing you want:

```
/pstack-poteto-mode   <describe the task>
```

Day to day, `/pstack-poteto-mode` is usually all you need — it pulls in the other
skills by itself. When you want a specific one, run it directly:

```
/pstack-tdd            when you want a failing test first
/pstack-architect      when you want a design pass
/pstack-unslop         when the prose needs cleaning up
```

Every one of the 58 skills follows the same pattern: `/pstack-<skill name>`.

## Which model for which role?

- **`code, prose, judgment`** — your strongest model. This writes code, plans,
  and makes judgment calls.
- **`swarm workers`** — a fast, cheap model. Used for mechanical edits and to
  run verification.
- **`bug-fix`, `perf-issue`, `hillclimb`, `feature, refactoring`** — the model
  for that kind of work. Usually your strong model.
- **panel roles** (`arena runners`, `interrogate reviewers`, `arena
  cross-judge pool`) — a list, ideally of different vendors, so the reviewers
  disagree usefully.

You do not have to get this perfect. Change it later by editing the file and
running `/pstack-setup` again.

## How the model routing works

OpenCode chooses a model per **agent**, not per subagent call. So this port
generates one agent per `(model, variant)` — for example
`pstack-model-glm-5-3` or `pstack-model-deepseek-v4-flash` — and the `pstack`
orchestrator dispatches the agent that matches the role. Effort levels map to
the model's OpenCode `#variant` where the provider exposes one.

## Limits worth knowing

- pstack's Cursor-only features (`automations`, `bugbot`, `.cursor` settings)
  are not available here; the orchestrator notes the skip and moves on.
- A role uses its agent's fixed model — there is no switching models mid-step.
- The `statechart` skill needs Java and the TLA+ tools; the scripts ship with
  the plugin, the tools are yours.
- Skill loading and live routing were not exercised on a real model in this
  build. See the verification note below.

## Upstream

The vendored content tracks the `version` field of `pstack/plugin.json` on the
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
