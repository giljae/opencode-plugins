# @giljae/opencode-egm

An **unofficial port** of
[Elephant-Goldfish Model](https://github.com/google/elephant-goldfish-model)
(EGM) for [OpenCode](https://opencode.ai). It brings EGM's design-and-review
workflow into OpenCode: develop an idea with full context, then review it with
reviewers that have never seen the conversation.

This package is not affiliated with Google and is not endorsed by Google. The
skill, persona, and standard content under `vendor/egm` is reproduced unchanged
from the upstream revision recorded in `vendor/egm/UPSTREAM.json`.

## What is EGM?

EGM splits a design review into two roles:

- **The Elephant** holds the project context and drafts the specification. It
  is the agent you talk to.
- **The Goldfish** are independent reviewers that start with no memory of your
  conversation. Because they only see the document and the files it points at,
  they catch unstated assumptions, missing context, and blind spots that the
  author has stopped noticing.

You make the architectural trade-offs and approve the specification before
anything is implemented.

## What this plugin adds

| Kind | Count | Names |
|------|-------|-------|
| Primary agent | 1 | `egm` — the orchestrator you select |
| Reviewer subagents | 8 | `egm-codebase-details`, `egm-comprehension`, `egm-design`, `egm-implementation-readiness`, `egm-inventive-catalyst`, `egm-structural`, `egm-style`, `egm-zoom-out` |
| Skills | 7 | `egm-bootstrap`, `egm-brainstorm`, `egm-draft`, `egm-review`, `egm-review-loop`, `egm-resolve`, `egm-drift-report` |
| Commands | 7 | `/egm-bootstrap`, `/egm-brainstorm`, `/egm-draft`, `/egm-review`, `/egm-review-loop`, `/egm-resolve`, `/egm-drift-report` |

Each reviewer is strictly read-only: it can read and search files, but cannot
edit, run shell commands, or delegate further. `grep` is denied for reviewers
because it bypasses OpenCode's per-file read rules, which would otherwise expose
`.env` files.

## Requirements

- OpenCode V2. Verified against **OpenCode 2.0.11** with `@opencode/plugin`
  2.0.11 on macOS. A newer V2 host should work but is untested.
- Node 20 or newer.

## Install

```sh
opencode plugin add @giljae/opencode-egm
```

OpenCode V2 plugins can register skills and commands but **cannot add agents**.
So the agents are installed separately. In an OpenCode session, run:

```
/egm-install-agents
```

That writes `egm.md` and the eight `egm-<reviewer>.md` files into
`.opencode/agents/` in the current project. Re-run it after a plugin update so
the agent files pick up the new bundle path.

## Quick start

1. Install as above, then start a new session.
2. Select the `egm` agent.
3. Review an existing document:

   ```
   /egm-review path/to/design.md
   ```

   Or develop an idea first:

   ```
   /egm-brainstorm "a feature idea to explore"
   /egm-draft path/to/concepts_brief.md
   ```

For review text, use an ordinary message rather than a slash-command argument.
OpenCode evaluates shell markers in slash-command arguments before permissions
apply, so pasting untrusted text there is unsafe.

## Commands

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

When you pick the `egm` agent and run a command, the orchestrator:

1. Loads the matching skill and reads the target document.
2. Dispatches the relevant Goldfish reviewers as **fresh subagent sessions**,
   passing only absolute paths to the persona, the target, and the required
   standards — never the conversation history.
3. Waits for each reviewer to finish and synthesize the findings itself.
4. Keeps every human approval gate: it asks one question at a time and waits
   for your answer.

It stops rather than guesses when delegation is unavailable or a required read
is missing. Missing tools and elapsed time are never treated as approval.

The orchestrator's permission rules allow it to read, search, load `egm-*`
skills, and dispatch only the eight reviewers; edits and shell commands ask
first. Reviewer sessions get the bundle-scoped external-directory allowance so
they can read the standards shipped in this package.

## Upstream tracking

The vendored content tracks the latest
[release tag](https://github.com/google/elephant-goldfish-model/releases) of
`google/elephant-goldfish-model`. The current bundle is **v0.1.1**. A scheduled
GitHub Actions workflow re-syncs and republishes this package when upstream
cuts a new release, so you get upstream's improvements without any manual work.

## Verification status

What has been checked on a real OpenCode is recorded in the source repository at
`docs/verification/opencode-v2-spike.md`. In short:

- Verified: the plugin loads and registers all 7 skills and 7 commands; the nine
  agents are discovered; a real `egm-review` run loaded the skill, dispatched
  the reviewer subagents, and wrote its stage reports; bundled files were read
  without a prompt.
- Not yet verified: installation through `opencode plugin add` on a clean
  machine, and `/egm-install-agents` in the TUI (headless `run` does not invoke
  slash commands).

Treat anything not recorded there as unverified.

## License

Apache-2.0. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).
