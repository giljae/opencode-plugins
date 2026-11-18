# @giljae/opencode-egm

An **unofficial port** of [Elephant-Goldfish Model](https://github.com/google/elephant-goldfish-model)
(EGM) for [OpenCode](https://opencode.ai).

Published on npm:
[`@giljae/opencode-egm`](https://www.npmjs.com/package/@giljae/opencode-egm).
This package is not affiliated with Google and is not endorsed by Google. The
content under `vendor/egm` is reproduced unchanged from upstream; see `NOTICE`.

## What is EGM?

EGM splits a design review into two roles:

- **The Elephant** holds your project context and writes the draft. It is the
  agent you talk to.
- **The Goldfish** are reviewers that have never seen your conversation. They
  read only the document and the files it points at, so they notice the
  assumptions and gaps you have stopped seeing.

The name is the point: the Elephant remembers everything, the Goldfish remembers
nothing — and the second pair of eyes is what catches the mistake. **You** make
the design decisions and approve the document.

## What this plugin adds

| | |
|---|---|
| **`egm` agent** | The orchestrator you select. |
| **8 reviewer subagents** | Read-only Goldfish (comprehension, structural, style, design, zoom-out, …). |
| **7 skills** | `egm-brainstorm`, `egm-draft`, `egm-review`, `egm-review-loop`, `egm-resolve`, `egm-bootstrap`, `egm-drift-report`. |
| **7 commands** | `/egm-brainstorm`, `/egm-draft`, `/egm-review`, `/egm-review-loop`, `/egm-resolve`, `/egm-bootstrap`, `/egm-drift-report`. |

## Before you start

- OpenCode V2 (this was built and checked against OpenCode 2.0.11).
- Node 20 or newer.

## Install

**1. Add the plugin.**

```sh
opencode plugin add @giljae/opencode-egm
```

**2. Install the agents.**

OpenCode plugins cannot add agents, so in a session run:

```
/egm-install-agents
```

This writes `egm.md` and the eight `egm-<reviewer>.md` files into
`.opencode/agents/` in the current project. Re-run it after a plugin update.

## Everyday use

1. Select the `egm` agent.
2. Run a command with a target:

```
/egm-review path/to/design.md
/egm-brainstorm "an idea to explore"
/egm-draft path/to/concepts_brief.md
```

The orchestrator loads the matching skill, dispatches the Goldfish reviewers as
fresh subagent sessions, and writes the report itself. Use an ordinary message
for review text rather than a slash-command argument.

## The seven commands

| Command | What it does |
|---------|--------------|
| `/egm-brainstorm` | Explore an idea and produce a concepts brief. |
| `/egm-draft` | Turn a concepts brief into a design specification. |
| `/egm-review` | Review an existing document against the code and standards. |
| `/egm-review-loop` | Run a configurable reviewer loop with your own standards. |
| `/egm-resolve` | Reconcile findings and resolve conflicts. |
| `/egm-bootstrap` | Document an existing codebase. |
| `/egm-drift-report` | Report where code has drifted from its design. |

## How it works

When you run a command, the orchestrator loads the skill, reads the target, and
dispatches the relevant reviewers as **fresh subagent sessions**, passing only
absolute paths — never the conversation. Each reviewer is strictly read-only:
it can read and search files, but cannot edit, run shell commands, or delegate.
`grep` is denied for reviewers because it bypasses OpenCode's per-file read
rules. The orchestrator keeps pstack-style approval gates and stops rather than
guesses when a required read or a reviewer result is missing.

## Upstream

The vendored content tracks the latest
[release tag](https://github.com/google/elephant-goldfish-model/releases) of
`google/elephant-goldfish-model`. The current bundle is **v0.1.1**. A scheduled
workflow re-syncs and republishes when upstream cuts a new release.

## Verification status

What was checked on a real OpenCode is recorded in the source repository at
`docs/verification/opencode-v2-spike.md`. In short: the plugin loads, the
reviewers are discovered and read-only, and a real `egm-review` run loaded the
skill, dispatched the reviewers, and wrote its reports. Treat anything not
recorded there as unverified.

## License

Apache-2.0. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).
