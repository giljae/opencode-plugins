# @giljae/opencode-pstack

An **unofficial port** of [pstack](https://github.com/cursor/plugins/tree/main/pstack),
Lauren Tan's rigorous agent workflow stack, for [OpenCode](https://opencode.ai).

pstack gives you a set of opinionated workflows — design, build, verify, ship —
run through deliberate subagents, with the model routed per role. Use
`/pstack-poteto-mode` to start a task and let pstack pick its playbook.

This package is not affiliated with Cursor or the author and is not endorsed by
either. The skill, agent, and doc content under `vendor/pstack` is reproduced
unchanged from upstream (MIT); see `NOTICE`.

Published on npm:
[`@giljae/opencode-pstack`](https://www.npmjs.com/package/@giljae/opencode-pstack).

## Requirements

- OpenCode V2. Verified against **OpenCode 2.0.11**.
- **Node 22** or newer.
- At least one model provider configured in OpenCode (any provider).

## Install

```sh
opencode plugin add @giljae/opencode-pstack
```

Start a new session. pstack's 58 skills are registered, each as a
`/pstack-<skill>` command.

## Configure your models

pstack routes each role to a model. **It uses the models already configured in
your own OpenCode — whatever providers you use; nothing is assumed or
hardcoded.** Run:

```
/pstack-setup
```

It lists the models configured in your OpenCode, writes a role map to
`.opencode/pstack-models.md`, and asks you to fill it in. Fill in a model per
role (for example `glm-5.3`, `deepseek-v4-flash`, `qwen3.7-plus`, or any model
you have), then run `/pstack-setup` again. It generates:

- a `pstack` orchestrator agent,
- one `pstack-model-<provider>-<model>[-variant]` subagent per distinct model,
- the upstream `poteto-agent` and `comment-sicko` agents.

## Use

```
/pstack-poteto-mode   start a task in pstack's style
/pstack-<skill>       run any pstack skill, e.g. /pstack-tdd
```

Model routing: when a skill names a role or model, the `pstack` orchestrator
dispatches the matching `pstack-model-*` subagent, whose OpenCode config carries
the model. A role mapped to a list is a panel: one subagent per entry.

## How routing maps to OpenCode

OpenCode selects a model per **agent**, not per subagent call. So this port
generates one agent per `(model, variant)` and routes by agent id. That
reproduces pstack's per-role routing and its multi-model panels. Effort levels
map to the model's OpenCode `#variant` where the provider exposes one.

## Limits

- No per-call model or effort switching; each role uses its agent's fixed model.
- Cursor-only features (`automations`, `bugbot`, `.cursor` settings) are not
  available; the orchestrator notes the skip and continues.
- `statechart` (TLA+/Java) needs its own toolchain; the scripts ship, the tools
  are yours.
- Model routing and skills were not exercised on a live model in this build; see
  the verification note.

## Upstream

The vendored content tracks the `version` field of `pstack/plugin.json` on
`cursor/plugins`'s `main` branch. The current bundle is **0.15.43**. A scheduled
workflow re-syncs and republishes when upstream bumps that version.

## Verification status

What was checked on a real OpenCode is recorded in the source repository at
`docs/verification/opencode-pstack-spike.md`. Offline checks confirmed the
generated agents are discovered and their model/variant is parsed. Skill
loading, live routing, and panels are not yet verified (no usable model during
the build). Treat anything not recorded there as unverified.

## License

Apache-2.0 for this adapter; the vendored content is MIT. See
[`LICENSE`](LICENSE), [`NOTICE`](NOTICE), and `vendor/pstack/LICENSE.upstream`.
