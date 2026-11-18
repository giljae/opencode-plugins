import { existsSync } from "node:fs";

import { describe, expect, test } from "vitest";

import type { McpHost, McpLocalConfig } from "../src/host.ts";
import { MCP_SERVER_NAME, registerMcp, resolveMcpEntry } from "../src/mcp.ts";

describe("resolveMcpEntry", () => {
  test("resolves the installed postgres-mcp binary", () => {
    const entry = resolveMcpEntry();
    expect(entry).toContain("bin/postgres-mcp.js");
    expect(existsSync(entry)).toBe(true);
  });
});

function fakeHost(): { host: McpHost; set: [string, McpLocalConfig][] } {
  const set: [string, McpLocalConfig][] = [];
  const host: McpHost = {
    mcp: {
      transform: async (cb) => {
        cb({
          list: () => [],
          get: () => undefined,
          set: (name, config) => set.push([name, config]),
          remove: () => {},
        });
      },
    },
  };
  return { host, set };
}

describe("registerMcp", () => {
  test("registers the local postgres-mcp server, enabled", async () => {
    const { host, set } = fakeHost();

    await registerMcp(host);

    expect(set).toHaveLength(1);
    const [name, config] = set[0] as [string, McpLocalConfig];
    expect(name).toBe(MCP_SERVER_NAME);
    expect(config.type).toBe("local");
    expect(config.command[0]).toBe(process.execPath);
    expect(config.command).toContain(resolveMcpEntry());
    expect(config.command).toContain("run");
    expect(config.command).toContain("--no-telemetry");
    expect(config.environment?.POSTGRES_MCP_QUERY_TIMEOUT_MS).toBe("540000");
    expect(config.disabled).toBeUndefined();
  });
});
