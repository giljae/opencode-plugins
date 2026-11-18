import { createRequire } from "node:module";

import type { McpHost, McpLocalConfig } from "./host.ts";

export const MCP_SERVER_NAME = "postgres-mcp";

const require = createRequire(import.meta.url);

/**
 * Absolute path to the installed `@microsoft/postgres-mcp` entry point. The
 * package is a pinned dependency, so this resolves to a local file and the
 * server never needs the network.
 */
export function resolveMcpEntry(): string {
  return require.resolve("@microsoft/postgres-mcp/bin/postgres-mcp.js");
}

export function mcpServerConfig(): McpLocalConfig {
  return {
    type: "local",
    // Use `node` from PATH, not `process.execPath`: under OpenCode that is the
    // OpenCode (Bun) binary, which cannot run this Node launcher.
    command: ["node", resolveMcpEntry(), "run", "--no-telemetry"],
    environment: { POSTGRES_MCP_QUERY_TIMEOUT_MS: "540000" },
    timeout: { startup: 90000 },
  };
}

/** Register the local Postgres MCP server, enabled. */
export async function registerMcp(host: McpHost): Promise<void> {
  await host.mcp.transform((editor) => {
    editor.set(MCP_SERVER_NAME, mcpServerConfig());
  });
}
