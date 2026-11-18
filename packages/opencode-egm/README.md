# @giljae/opencode-egm

**Design with an elephant. Review with a goldfish.**

An **unofficial port** of [Elephant-Goldfish Model](https://github.com/google/elephant-goldfish-model)
(EGM) for [OpenCode](https://opencode.ai).

Published on npm:
[`@giljae/opencode-egm`](https://www.npmjs.com/package/@giljae/opencode-egm).
This package is not affiliated with Google and is not endorsed by Google.

---

## What it does for you

You have a design, a plan, or a README. Before you build on it, you want a
second opinion — but a generic assistant tends to agree with you, because it
just read everything you wrote.

EGM fixes that. It sends your document to eight independent reviewers who
**never see your conversation**. They only read the document and the files it
points at, so they notice the assumptions, gaps, and contradictions you have
stopped seeing. You stay in charge: you decide what to change, and you approve
the document.

## What is EGM?

Two roles, working together:

- **The Elephant** remembers everything and writes the draft. This is the agent
  you talk to.
- **The Goldfish** remembers nothing. Each reviewer is a fresh reader who sees
  only the document.

The name says it: the Elephant holds context, the Goldfish starts clean. The
fresh pair of eyes is the whole point.

## What you get

| | |
|---|---|
| **`egm` agent** | The orchestrator you select. |
| **8 reviewer subagents** | Read-only Goldfish: comprehension, structural, style, design, zoom-out, and more. |
| **7 commands** | `/egm-brainstorm`, `/egm-draft`, `/egm-review`, `/egm-review-loop`, `/egm-resolve`, `/egm-bootstrap`, `/egm-drift-report`. |

## Requirements

- OpenCode V2 (built and checked against OpenCode 2.0.11).
- Node 20 or newer.

## Get started

1. Install the plugin:
   ```sh
   opencode plugin add @giljae/opencode-egm
   ```
2. In a session, install the agents (OpenCode plugins cannot add agents):
   ```
   /egm-install-agents
   ```
3. Start a new session and select the `egm` agent.

You are ready. The next section shows the two things you will do most.

## How to review an existing document

You have a design doc, a plan, or a README and want it scrutinized:

```
/egm-review path/to/design.md
```

The orchestrator loads the review skill, reads the document, dispatches the
Goldfish reviewers into fresh sessions, and writes a report with their findings.
You then decide what to act on.

## How to develop an idea

You have a rough idea and want it sharpened before writing code:

```
/egm-brainstorm "an idea to explore"
/egm-draft path/to/concepts_brief.md
```

`brainstorm` turns the idea into a concepts brief; `draft` turns the brief into a
design specification that the reviewers can then critique.

## All the commands

| Command | What it is for |
|---------|----------------|
| `/egm-brainstorm` | Explore an idea and produce a concepts brief. |
| `/egm-draft` | Turn a concepts brief into a design specification. |
| `/egm-review` | Review an existing document against the code and standards. |
| `/egm-review-loop` | Run a reviewer loop with your own choice of reviewers and standards. |
| `/egm-resolve` | Reconcile findings and resolve conflicts between reviewers. |
| `/egm-bootstrap` | Document an existing codebase. |
| `/egm-drift-report` | Report where the code has drifted from its design. |

## Tips

- **Paste review text as a normal message, not as a command argument.** OpenCode
  evaluates shell markers in slash-command arguments before permissions apply.
- **Answer the questions.** The orchestrator asks one question at a time and
  waits. It will not treat silence or elapsed time as approval.
- **Re-run `/egm-install-agents` after updating the plugin**, so the agent files
  point at the new location.

## Troubleshooting

- **`/egm-install-agents` is not offered.** The plugin is not loaded in this
  project. Check that `opencode plugin add @giljae/opencode-egm` succeeded and
  start a new session.
- **The `egm` agent is missing.** Run `/egm-install-agents` once; it writes the
  agents into `.opencode/agents/` for the current project.
- **A reviewer says it cannot read a file.** Pass absolute paths, and keep the
  target and the standards inside the project or in the plugin bundle.
- **A reviewer seems to quote a `task` tool.** That is old V1 wording from an
  older bundle; update to the current plugin version.

## How updates work

The bundled content tracks the latest
[release tag](https://github.com/google/elephant-goldfish-model/releases) of
`google/elephant-goldfish-model`. The current bundle is **v0.1.1**. A scheduled
workflow re-syncs and republishes when upstream cuts a new release, so you get
upstream's improvements without doing anything.

## Verification status

What was checked on a real OpenCode is recorded in the source repository at
`docs/verification/opencode-v2-spike.md`. In short: the plugin loads, the
reviewers are discovered and read-only, and a real `/egm-review` run loaded the
skill, dispatched the reviewers, and wrote its reports. Treat anything not
recorded there as unverified.

## License

Apache-2.0. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).
