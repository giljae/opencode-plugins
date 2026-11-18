# @giljae/opencode-postgres-skills

An **unofficial port** of
[microsoft/postgres-skills](https://github.com/microsoft/postgres-skills) for
[OpenCode](https://opencode.ai).

Published on npm:
[`@giljae/opencode-postgres-skills`](https://www.npmjs.com/package/@giljae/opencode-postgres-skills).
This package is not affiliated with Microsoft and is not endorsed by Microsoft.
The content under `vendor/postgres-skills` is reproduced unchanged from upstream
(MIT); see `NOTICE`.

## What is postgres-skills?

It teaches your agent how to work with PostgreSQL well, and gives it a live
**database tool** to look before it speaks. Instead of pasting schema and query
plans into the prompt by hand, the agent can inspect the selected database and
ground its answer in what is actually there.

It is three skills plus a local PostgreSQL MCP server:

| Skill | What it covers |
|-------|----------------|
| `postgresql-best-practices` | Connect, query, tables, indexes, JSONB, partitioning, row-level security, full-text search, pooling, replication, backup, Entra auth, and Azure Database for PostgreSQL. |
| `pg-graph` | Apache AGE on PostgreSQL: derive an ontology, build a graph, and query it with openCypher or natural language. |
| `migrate-oracle-app` | Assess and convert an Oracle-backed application to PostgreSQL. Needs Oracle, Java, and Maven tooling for real use. |

## What this plugin adds

- The three skills above, available to the agent automatically.
- A local **`postgres-mcp`** server, registered by the plugin, so you edit no
  configuration. It is enabled by default and starts a local process in each
  session.

The MCP server is the separate npm package `@microsoft/postgres-mcp`, pinned as
a dependency of this plugin and launched from the local install. **It needs no
network at runtime**, so the plugin works in air-gapped environments. (Reaching
a remote database is still a network operation.)

## Before you start

- OpenCode V2 (this was built and checked against OpenCode 2.0.11).
- **Node 22** or newer — the MCP server and the skills' scripts require it.

## Install

**1. Add the plugin.**

```sh
opencode plugin add @giljae/opencode-postgres-skills
```

**2. Start a new session.**

The three skills and the `postgres-mcp` server are available right away. There
is nothing else to configure.

## Everyday use

Just describe what you want; the agent picks the right skill, or name one:

- "Why is this query slow?" → it inspects the plan with the MCP server.
- "Add row-level security for tenant isolation."
- "Design a pgvector index for hybrid search."
- "Convert this Oracle schema" → the `migrate-oracle-app` skill.

## Upstream

The vendored content tracks the `version` field of `plugin/plugin.json` on
`microsoft/postgres-skills`'s `main` branch. The current bundle is **0.3.0**. A
scheduled workflow re-syncs and republishes when upstream bumps that version.

## Verification status

What was checked on a real OpenCode is recorded in the source repository at
`docs/verification/opencode-postgres-skills-spike.md`. In short: the plugin
loads, the MCP server connects with 13 tools, and the npm install path is
verified. Skill loading, the exposed MCP tool names, and script execution are
not yet verified. Treat anything not recorded there as unverified.

## License

Apache-2.0 for this adapter; the vendored content is MIT. See
[`LICENSE`](LICENSE), [`NOTICE`](NOTICE), and
`vendor/postgres-skills/LICENSE`.
