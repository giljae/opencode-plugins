import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, test } from "vitest";

import { EGM_COMMANDS } from "../src/commands.ts";
import type {
  CommandDefinition,
  CommandHost,
  SkillDefinition,
  SkillHost,
} from "../src/host.ts";
import { INSTALL_COMMAND, runSetup } from "../src/setup.ts";
import { REVIEWER_IDS } from "../src/permissions.ts";

const realBundle = fileURLToPath(new URL("../vendor/egm/", import.meta.url));
const dirs: string[] = [];

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "setup-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length > 0) {
    rmSync(dirs.pop() as string, { recursive: true, force: true });
  }
});

type Host = SkillHost & CommandHost;

function fakeHost(): {
  host: Host;
  skills: SkillDefinition[];
  commands: CommandDefinition[];
  prompts: Record<string, unknown>[];
} {
  const skills: SkillDefinition[] = [];
  const commands: CommandDefinition[] = [];
  const prompts: Record<string, unknown>[] = [];
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
    session: {
      prompt: async (input: Record<string, unknown>) => {
        prompts.push(input);
      },
    },
  } as Host;
  return { host, skills, commands, prompts };
}

describe("runSetup", () => {
  test("registers seven skills, the seven skill commands, and the install command", async () => {
    const { host, skills, commands } = fakeHost();

    const result = await runSetup(host, realBundle, join(fixture(), ".opencode", "agents"));

    expect(result).toEqual({ skills: 7, commands: 7 });
    expect(skills).toHaveLength(7);
    expect(commands.map((command) => command.name)).toEqual([...EGM_COMMANDS, INSTALL_COMMAND]);
  });

  test("the install command writes the nine agent files into the target directory", async () => {
    const target = join(fixture(), ".opencode", "agents");
    const { host, commands } = fakeHost();
    await runSetup(host, realBundle, target);

    const install = commands.find((command) => command.name === INSTALL_COMMAND);
    expect(install).toBeDefined();
    await install?.execute({ sessionID: "s1", prompt: { text: "" }, delivery: "queue" });

    expect(readdirSync(target).sort()).toEqual(
      ["egm.md", ...REVIEWER_IDS.map((id) => `${id}.md`)].sort(),
    );
  });

  test("throws instead of registering nothing when the bundle manifest is missing", async () => {
    const { host, skills } = fakeHost();
    await expect(
      runSetup(host, fixture(), join(fixture(), "agents")),
    ).rejects.toThrow(/UPSTREAM\.json/);
    expect(skills).toEqual([]);
  });
});
