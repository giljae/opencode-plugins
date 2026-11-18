import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { commandName, registerCommands } from "../src/commands.ts";
import type { CommandDefinition, CommandHost } from "../src/host.ts";

const bundle = fileURLToPath(new URL("../vendor/pstack", import.meta.url));

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

describe("commandName", () => {
  test("prefixes the skill id", () => {
    expect(commandName("poteto-mode")).toBe("pstack-poteto-mode");
  });
});

describe("registerCommands", () => {
  test("registers one pstack-<skill> command per vendored skill", async () => {
    const { host, added } = fakeHost();

    const count = await registerCommands(host, bundle, "pstack");

    expect(count).toBe(58);
    expect(added).toHaveLength(58);
    expect(added.map((command) => command.name)).toEqual(
      expect.arrayContaining(["pstack-poteto-mode", "pstack-tdd"]),
    );
  });

  test("executing a command forwards to the orchestrator with the skill id", async () => {
    const { host, added, prompts } = fakeHost();
    await registerCommands(host, bundle, "pstack");

    const command = added.find((entry) => entry.name === "pstack-poteto-mode");
    await command?.execute({ sessionID: "s1", prompt: { text: "do a thing" }, delivery: "queue" });

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatchObject({ sessionID: "s1", agentID: "pstack", delivery: "queue" });
    expect(prompts[0]?.text).toContain("poteto-mode");
    expect(prompts[0]?.text).toContain("do a thing");
  });
});
