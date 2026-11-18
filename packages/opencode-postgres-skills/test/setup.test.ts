import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, test } from "vitest";

import type { McpLocalConfig, SkillDefinition } from "../src/host.ts";
import { runSetup, type Host } from "../src/setup.ts";

const realBundle = fileURLToPath(new URL("../vendor/postgres-skills/", import.meta.url));
const dirs: string[] = [];

afterEach(() => {
  while (dirs.length > 0) {
    rmSync(dirs.pop() as string, { recursive: true, force: true });
  }
});

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "pg-setup-"));
  dirs.push(dir);
  return dir;
}

function fakeHost(): {
  host: Host;
  skills: SkillDefinition[];
  servers: [string, McpLocalConfig][];
} {
  const skills: SkillDefinition[] = [];
  const servers: [string, McpLocalConfig][] = [];
  const host = {
    skill: {
      transform: async (cb: (editor: { add(skill: SkillDefinition): void }) => void) => {
        cb({ add: (skill) => skills.push(skill) });
      },
    },
    mcp: {
      transform: async (
        cb: (editor: {
          list(): [];
          get(): undefined;
          set(name: string, config: McpLocalConfig): void;
          remove(): void;
        }) => void,
      ) => {
        cb({
          list: () => [],
          get: () => undefined,
          set: (name, config) => servers.push([name, config]),
          remove: () => {},
        });
      },
    },
  } as Host;
  return { host, skills, servers };
}

describe("runSetup", () => {
  test("registers the three skills and one local MCP server", async () => {
    const { host, skills, servers } = fakeHost();

    const result = await runSetup(host, realBundle);

    expect(result).toEqual({ skills: 3, mcp: 1 });
    expect(skills.map((skill) => skill.id)).toEqual([
      "migrate-oracle-app",
      "pg-graph",
      "postgresql-best-practices",
    ]);
    expect(skills.every((skill) => skill.path.startsWith(realBundle))).toBe(true);
    expect(servers.map(([name]) => name)).toEqual(["postgres-mcp"]);
  });

  test("throws instead of registering nothing when the bundle manifest is missing", async () => {
    const { host, skills, servers } = fakeHost();
    await expect(runSetup(host, fixture())).rejects.toThrow(/UPSTREAM\.json/);
    expect(skills).toEqual([]);
    expect(servers).toEqual([]);
  });
});
