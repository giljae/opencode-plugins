# @giljae/opencode-egm

Unofficial OpenCode V2 plugin distribution of
[Elephant-Goldfish Model](https://github.com/google/elephant-goldfish-model)
(EGM). It installs EGM's design-and-review workflow — an orchestrator agent,
eight read-only reviewer subagents, seven skills, and seven `/egm-*` commands —
into OpenCode.

This is an **unofficial port**. It is not affiliated with, endorsed by, or
supported by Google.

## Install

```sh
opencode plugin add @giljae/opencode-egm
```

Then select the `egm` agent and use an `/egm-*` command, for example
`/egm-review path/to/design.md`.

The vendored upstream content is reproduced unchanged; only the OpenCode V2
adapter code is ours. See `NOTICE` and `vendor/egm/UPSTREAM.json` for the exact
upstream revision.

## Status

Workflow and isolation verification is recorded in
`docs/verification/opencode-v2-spike.md` in the source repository. Anything not
recorded there is unverified.
