import { listSkills } from "./content.ts";
import type { CommandHost } from "./host.ts";

/** The seven `/egm-*` commands, each named after the skill it loads. */
export const EGM_COMMANDS = [
  "egm-bootstrap",
  "egm-brainstorm",
  "egm-draft",
  "egm-drift-report",
  "egm-resolve",
  "egm-review",
  "egm-review-loop",
] as const;

/**
 * Register the `/egm-*` commands. Each forwards the user's raw text to the
 * orchestrator through `session.prompt`; the text is never shell-evaluated.
 */
export async function registerCommands(
  host: CommandHost,
  bundleDir: string,
  agentId: string,
): Promise<number> {
  const skillIds = new Set(listSkills(bundleDir).map((skill) => skill.id));
  const missing = EGM_COMMANDS.filter((id) => !skillIds.has(id));
  if (missing.length > 0) {
    throw new Error(`Missing skills for commands: ${missing.join(", ")}`);
  }

  await host.command.transform((editor) => {
    for (const id of EGM_COMMANDS) {
      editor.add({
        name: id,
        description: `Run the ${id} skill with the EGM orchestrator`,
        execute: async ({ sessionID, prompt, delivery }) => {
          await host.session.prompt({
            ...prompt,
            sessionID,
            agentID: agentId,
            delivery,
            text: `Load and follow the ${id} skill.\n\nUser request: ${prompt.text}`,
          });
        },
      });
    }
  });
  return EGM_COMMANDS.length;
}
