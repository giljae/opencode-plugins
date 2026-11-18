import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, test } from "vitest";

import type {
  CommandDefinition,
  CommandHost,
  ModelHost,
  ModelInfo,
  SkillDefinition,
  SkillHost,
} from "../src/host.ts";
import { runSetup, type Host } from "../src/setup.ts";

const realBundle = fileURLToPath(new URL("../vendor/pstack/", import.meta.url));
const dirs: string[] = [];

afterEach(() => {
  while (dirs.length > 0) {
    rmSync(dirs.pop() as string, { recursive: true, force: true });
  }
});

function fakeHost(): {
  host: Host;
  skills: SkillDefinition[];
  commands: CommandDefinition[];
} {
  const skills: SkillDefinition[] = [];
  const commands: CommandDefinition[] = [];
  const host = {
    skill: {
      transform: async (cb: (editor: { add(skill: SkillDefinition): void }) => void) => {
        cb({ add: (skill) => skills.push(skill) });
      },
    },
    command: {
      transform: async (cb: (editor: { add(command: CommandDefinition): void }) => void) => {
        cb({ add: (command) => commands.push(command) });
      },
    },
    session: { prompt: async () => {} },
    model: { list: async (): Promise<ModelInfo[]> => [] },
  } as Host & SkillHost & CommandHost & ModelHost;
  return { host, skills, commands };
}

describe("runSetup", () => {
  test("registers 58 skills, the skill commands, and pstack-setup", async () => {
    const { host, skills, commands } = fakeHost();
    const dir = mkdtempSync(join(tmpdir(), "pstack-setup-"));
    dirs.push(dir);

    const result = await runSetup(host, {
      bundleDir: realBundle,
      agentId: "pstack",
      targetDir: join(dir, ".opencode", "agents"),
      mapPath: join(dir, ".opencode", "pstack-models.md"),
    });

    expect(result).toEqual({ skills: 58, commands: 58 });
    expect(skills).toHaveLength(58);
    expect(commands.map((command) => command.name)).toEqual(
      expect.arrayContaining(["pstack-poteto-mode", "pstack-setup"]),
    );
  });

  test("throws instead of registering nothing when the bundle manifest is missing", async () => {
    const { host, skills } = fakeHost();
    const dir = mkdtempSync(join(tmpdir(), "pstack-setup-"));
    dirs.push(dir);
    await expect(
      runSetup(host, {
        bundleDir: dir,
        agentId: "pstack",
        targetDir: join(dir, "agents"),
        mapPath: join(dir, "map.md"),
      }),
    ).rejects.toThrow(/UPSTREAM\.json/);
    expect(skills).toEqual([]);
  });
});
