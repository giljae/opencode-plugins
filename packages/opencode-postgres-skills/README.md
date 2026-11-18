# @giljae/opencode-postgres-skills

**PostgreSQL help that looks at your database before it answers.**

An **unofficial port** of
[microsoft/postgres-skills](https://github.com/microsoft/postgres-skills) for
[OpenCode](https://opencode.ai).

Published on npm:
[`@giljae/opencode-postgres-skills`](https://www.npmjs.com/package/@giljae/opencode-postgres-skills).
This package is not affiliated with Microsoft and is not endorsed by Microsoft.

---

## What it does for you

Usually you copy schema, settings, and query plans into the prompt so the
assistant can answer. That is slow and easy to get wrong.

This plugin gives your agent two things instead: **PostgreSQL knowledge** and a
**live database tool**. It can inspect the selected database, look at the actual
plan, and ground its advice in what is really there — then tell you what to
change.

## What is included

Three skills, plus a local PostgreSQL MCP server:

| Skill | What it covers |
|-------|----------------|
| `postgresql-best-practices` | Connect, query, tables, indexes, JSONB, partitioning, row-level security, full-text search, pooling, replication, backup, Entra auth, and Azure Database for PostgreSQL. |
| `pg-graph` | Apache AGE on PostgreSQL: derive an ontology, build a graph, and query it with openCypher or natural language. |
| `migrate-oracle-app` | Assess and convert an Oracle-backed application to PostgreSQL. Needs Oracle, Java, and Maven tooling for real use. |

The skills use a local **`postgres-mcp`** server to run queries and inspect
schema. The plugin registers that server for you, so you edit no configuration.

## Requirements

- OpenCode V2 (built and checked against OpenCode 2.0.11).
- **Node 22** or newer — the MCP server and the skills' scripts require it.

## Get started

1. Install the plugin:
   ```sh
   opencode plugin add @giljae/opencode-postgres-skills
   ```
2. Start a new session.

That is the whole setup. The three skills and the `postgres-mcp` server are
available immediately.

## How to use it

Just describe what you want in plain language. The agent picks the right skill.

- **Diagnose a slow query**
  > "This query is slow. Look at the plan and tell me why."
- **Choose an index or partitioning**
  > "We read this table by tenant and date. What indexing or partitioning should we use?"
- **Add tenant isolation**
  > "Design row-level security so each tenant only sees its own rows."
- **Build search and AI features**
  > "Design a pgvector index and a hybrid retrieval query."
- **Move off Oracle**
  > "Assess this Oracle-backed app for a Postgres migration."
  > (This uses `migrate-oracle-app`; see the requirements in its skill.)

## The local MCP server

- It is enabled by default and starts a local process in each session.
- It launches from the plugin's own install, using
  `@microsoft/postgres-mcp`, so **it needs no network at runtime** and works in
  air-gapped environments. (Reaching a remote database is still a network call.)
- Nothing is hardcoded to a provider or a database; you point it at whatever
  database you want to work with.

## Tips

- Say **which database or connection** you mean, if you have more than one.
- For a remote or cloud database, expect a normal network connection and the
  usual credentials to be required.
- If a task is large (like a full Oracle migration), the skill will tell you
  what it needs before it starts.

## Troubleshooting

- **The skills do not appear.** Confirm `opencode plugin add
  @giljae/opencode-postgres-skills` succeeded and start a new session.
- **`postgres-mcp` does not connect.** It needs `node` (Node 22+) on your PATH.
  Check `node --version`.
- **A tool call fails with a connection error.** That is the database, not the
  plugin — check the connection details and that the database is reachable.
- **`migrate-oracle-app` stops early.** It needs Oracle, Java, and Maven
  available. Install those, or use it only for the assessment step.

## How updates work

The bundled content tracks the `version` field of `plugin/plugin.json` on the
`microsoft/postgres-skills` `main` branch. The current bundle is **0.3.0**. A
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
