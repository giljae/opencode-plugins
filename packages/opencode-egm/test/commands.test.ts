import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { EGM_COMMANDS, registerCommands } from "../src/commands.ts";
import type { CommandDefinition, CommandHost } from "../src/host.ts";

const dirs: string[] = [];

function fixture(skillIds: readonly string[]): string {
  const base = mkdtempSync(join(tmpdir(), "commands-"));
  dirs.push(base);
  for (const id of skillIds) {
    const dir = join(base, "skills", id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), `---\nname: ${id}\ndescription: ${id}\n---\nbody`);
  }
  return base;
}

afterEach(() => {
  while (dirs.length > 0) {
    rmSync(dirs.pop() as string, { recursive: true, force: true });
  }
});

function fakeHost(): {
  host: CommandHost;
  added: CommandDefinition[];
  prompts: Record<string, unknown>[];
} {
  const added: CommandDefinition[] = [];
  const prompts: Record<string, unknown>[] = [];
  const host: CommandHost = {
    command: {
      transform: async (cb) => {
        cb({ add: (command) => added.push(command) });
      },
    },
    session: {
      prompt: async (input) => {
        prompts.push(input);
      },
    },
  };
  return { host, added, prompts };
}

describe("registerCommands", () => {
  test("registers the seven egm commands", async () => {
    const bundle = fixture(EGM_COMMANDS);
    const { host, added } = fakeHost();

    const count = await registerCommands(host, bundle, "egm");

    expect(count).toBe(7);
    expect(added.map((c) => c.name)).toEqual([...EGM_COMMANDS]);
    for (const command of added) {
      expect(command.description.length).toBeGreaterThan(0);
    }
  });

  test("passes the user's text to the orchestrator unchanged, with no shell evaluation", async () => {
    const bundle = fixture(EGM_COMMANDS);
    const { host, added, prompts } = fakeHost();
    await registerCommands(host, bundle, "egm");

    const command = added.find((c) => c.name === "egm-review");
    const userText = "review `$(whoami)` and ../secrets/.env";
    await command?.execute({ sessionID: "s1", prompt: { text: userText }, delivery: "queue" });

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatchObject({ sessionID: "s1", agentID: "egm", delivery: "queue" });
    expect(prompts[0]?.text).toBe(
      `Load and follow the egm-review skill.\n\nUser request: ${userText}`,
    );
  });

  test("throws when a command's skill is missing", async () => {
    const bundle = fixture(EGM_COMMANDS.slice(0, 6));
    const { host, added } = fakeHost();
    await expect(registerCommands(host, bundle, "egm")).rejects.toThrow(/Missing skills/);
    expect(added).toEqual([]);
  });
});
