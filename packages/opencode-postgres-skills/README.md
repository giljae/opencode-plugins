# @giljae/opencode-postgres-skills

An **unofficial port** of
[microsoft/postgres-skills](https://github.com/microsoft/postgres-skills) for
[OpenCode](https://opencode.ai). It gives your agent PostgreSQL guidance, Apache
AGE graph workflows, Oracle application migration, and a **local PostgreSQL MCP
server** for inspecting and querying databases.

This package is not affiliated with Microsoft and is not endorsed by Microsoft.
The skill, reference, script, and document content under `vendor/postgres-skills`
is reproduced unchanged from upstream (MIT); see `NOTICE`.

Published on npm:
[`@giljae/opencode-postgres-skills`](https://www.npmjs.com/package/@giljae/opencode-postgres-skills).

## What you get

Three skills, offered to the agent automatically:

| Skill | What it covers |
|-------|----------------|
| `postgresql-best-practices` | Connect, query, tables, indexes, JSONB, partitioning, row-level security, full-text search, pooling, replication, backup, Entra auth, and Azure Database for PostgreSQL. |
| `pg-graph` | Apache AGE on PostgreSQL: derive an ontology, build a graph, and query it with openCypher or natural language. |
| `migrate-oracle-app` | Assess and convert an Oracle-backed application to PostgreSQL. Needs Oracle, Java, and Maven tooling for real use. |

Plus a **local `postgres-mcp` server**. The plugin registers it through the
OpenCode MCP API, so you edit no configuration. It is enabled by default and
starts a local process in each session, which the skills use to inspect the live
database.

The MCP server is the separate npm package `@microsoft/postgres-mcp`, pinned as
a dependency of this plugin and launched from the local install with
`node …/bin/postgres-mcp.js`. **It needs no network at runtime**, so the plugin
works in air-gapped environments. (Connecting to a remote database is still a
network operation.)

## Requirements

- OpenCode V2. Verified against **OpenCode 2.0.11**. A newer V2 host should work
  but is untested.
- **Node 22** or newer. The MCP server and the skills' scripts require it.

## Install

```sh
opencode plugin add @giljae/opencode-postgres-skills
```

`opencode plugin add` fetches the package from the npm registry and adds it to
your OpenCode configuration. Start a new session and the three skills and the
`postgres-mcp` server are available.

## Upstream

The vendored content tracks the `version` field of `plugin/plugin.json` on
`microsoft/postgres-skills`'s `main` branch. The current bundle is **0.3.0**. A
scheduled workflow re-syncs and republishes when upstream bumps that version.

## Verification status

What has been checked on a real OpenCode is recorded in the source repository at
`docs/verification/opencode-postgres-skills-spike.md`. In short: the plugin
loads and registers the skills, and the MCP server connects with 13 tools.
Skill loading, OpenCode's exposed MCP tool names, and script execution are not
yet verified. Treat anything not recorded there as unverified.

## License

Apache-2.0 for this adapter; the vendored content is MIT. See
[`LICENSE`](LICENSE), [`NOTICE`](NOTICE), and
`vendor/postgres-skills/LICENSE`.
