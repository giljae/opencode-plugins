# OpenCode postgres-skills spike

Date: 2026-11-18
Environment: OpenCode 2.0.11 (macOS, Node 24.20.0), `@microsoft/postgres-mcp`
0.3.0, plugin loaded from `.opencode/plugins/postgres` (a re-export of the
package's `src/index.ts`). No model call succeeded: the ClinePass free-tier
models were unavailable or rate-limited during the run.

## Results

| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1 | `ctx.mcp.transform` + `set` starts the local server (enabled) | **pass** | Server log: `mcp connected server=postgres-mcp tools=13`. |
| 2 | Dependency resolves and the server runs with no network | **partial** | In-repo, `resolveMcpEntry()` resolves the pinned dependency and the server launched with no network. The packaged (npm-installed) layout was not exercised. |
| 3 | Tool names match what the skills call | **partial** | The server's own `tools/list` returns 13 tools named `postgres_mcp_*`. OpenCode's exposed (namespaced) names were not observed without a model. |
| 4 | The three skills load and expose `references/`/`scripts/` | **unverified** | Needs a model session to load a skill. |
| 5 | A skill script runs under the default agent's shell permission | **unverified** | Needs a model session. |
| 6 | The server starts with no database configured | **pass** | It starts in file-based configuration mode and connects. |

## Findings

- **`process.execPath` is the wrong runtime.** Under OpenCode it is the OpenCode
  (Bun) binary, so launching it with the Node launcher produced
  `mcp connect failed server=postgres-mcp status.error="Connection closed"`.
  Changing the command to `["node", <entry>, "run", "--no-telemetry"]` connected
  successfully. The package fixes this in `src/mcp.ts`.
- **The MCP server is a Rust binary behind a Node launcher**
  (`bin/postgres-mcp.js`, shebang `#!/usr/bin/env node`), so a Node runtime is
  required — consistent with the plugin's Node >= 22 requirement.

## Limits

- No model was available, so skill loading, OpenCode's exposed tool names, and
  script execution are unverified.
- The plugin was loaded from the repository, not from an npm-installed package;
  the packaged install path stays unverified until this is published.
