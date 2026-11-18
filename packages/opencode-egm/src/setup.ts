import { fileURLToPath } from "node:url";

import { buildAgentFiles } from "./agents.ts";
import { registerCommands } from "./commands.ts";
import { readUpstreamManifest } from "./content.ts";
import type { CommandHost, SkillHost } from "./host.ts";
import { installAgents } from "./install.ts";
import { registerSkills } from "./skills.ts";

/** The command that writes the agent files into the project's agent directory. */
export const INSTALL_COMMAND = "egm-install-agents";

export type Host = SkillHost & CommandHost;

export interface SetupResult {
  skills: number;
  commands: number;
}

/** The vendored bundle shipped inside this package. */
export function defaultBundleDir(): string {
  return fileURLToPath(new URL("../vendor/egm/", import.meta.url));
}

export async function registerInstallCommand(
  host: CommandHost,
  options: { bundleDir: string; targetDir: string },
): Promise<void> {
  await host.command.transform((editor) => {
    editor.add({
      name: INSTALL_COMMAND,
      description: "Write the EGM orchestrator and reviewer agents into the project's agents directory",
      execute: async ({ sessionID, prompt, delivery }) => {
        const written = installAgents(buildAgentFiles(options.bundleDir), options.targetDir);
        const list = written.map((path) => `- ${path}`).join("\n");
        await host.session.prompt({
          ...prompt,
          sessionID,
          delivery,
          text: `Installed ${written.length} EGM agents into ${options.targetDir}:\n${list}`,
        });
      },
    });
  });
}

/**
 * Register everything the plugin owns: the seven skills, the seven skill
 * commands, and the agent-install command. Agents themselves are files, since
 * OpenCode V2 plugins cannot add agents.
 */
export async function runSetup(
  host: Host,
  bundleDir: string,
  targetDir: string,
): Promise<SetupResult> {
  readUpstreamManifest(bundleDir);
  const skills = await registerSkills(host, bundleDir);
  const commands = await registerCommands(host, bundleDir, "egm");
  await registerInstallCommand(host, { bundleDir, targetDir });
  return { skills, commands };
}
