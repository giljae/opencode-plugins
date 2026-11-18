import { listSkills } from "./content.ts";
import type { CommandHost } from "./host.ts";

/** The slash command name for a skill, prefixed to avoid collisions. */
export function commandName(skillId: string): string {
  return `pstack-${skillId}`;
}

/**
 * Register a `pstack-<skill>` command for every vendored skill. Each command
 * forwards the user's raw text to the orchestrator, which loads the skill.
 */
export async function registerCommands(
  host: CommandHost,
  bundleDir: string,
  agentId: string,
): Promise<number> {
  const skills = listSkills(bundleDir);
  await host.command.transform((editor) => {
    for (const skill of skills) {
      editor.add({
        name: commandName(skill.id),
        description: `Run pstack's ${skill.id} skill`,
        execute: async ({ sessionID, prompt, delivery }) => {
          await host.session.prompt({
            ...prompt,
            sessionID,
            agentID: agentId,
            delivery,
            text: `Load and follow the pstack skill \`${skill.id}\`.\n\nUser request: ${prompt.text}`,
          });
        },
      });
    }
  });
  return skills.length;
}
