# @giljae/opencode-egm

An **unofficial port** of
[Elephant-Goldfish Model](https://github.com/google/elephant-goldfish-model)
(EGM) for OpenCode. It adds EGM's design-and-review workflow: an `egm`
orchestrator, eight read-only Goldfish reviewers, seven skills, and seven
`/egm-*` commands.

This package is not affiliated with Google, and is not endorsed by Google. EGM
is an independent project; the skill, persona, and standard content under
`vendor/egm` is reproduced unchanged from the revision recorded in
`vendor/egm/UPSTREAM.json`.

## Requirements

- OpenCode V2. Verified against **OpenCode 2.0.11** with `@opencode/plugin`
  2.0.11 (macOS). See `docs/verification/opencode-v2-spike.md` in the source
  repository for what is verified and what is not.
- Node 20 or newer.

## Install

```sh
opencode plugin add @giljae/opencode-egm
```

OpenCode V2 plugins can register skills and commands but **cannot add agents**,
so the agents are installed as files. In a session, run:

```
/egm-install-agents
```

This writes `egm.md` and the eight `egm-<reviewer>.md` files into
`.opencode/agents/` in the current project. Re-run it after a plugin update.

## Use

Select the `egm` agent, then run a command with a target:

```
/egm-review path/to/design.md
/egm-brainstorm "an idea to explore"
/egm-draft path/to/concepts_brief.md
```

Use an ordinary message for review text rather than a slash-command argument.

## Upstream

The vendored content tracks the latest
[release tag](https://github.com/google/elephant-goldfish-model/releases) of
`google/elephant-goldfish-model`. The current bundle is **v0.1.1**. A scheduled
workflow re-syncs and republishes when upstream cuts a new release.

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
