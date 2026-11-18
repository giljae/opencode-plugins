import { listAgents } from "./content.ts";
import type { AgentDefinition, AgentHost } from "./host.ts";
import { orchestratorPrompt } from "./orchestrator.ts";
import {
  REVIEWER_IDS,
  orchestratorPermissions,
  reviewerPermissions,
} from "./permissions.ts";

const ORCHESTRATOR_COLOR = "#1B6EF3";
const REVIEWER_COLOR = "#E86E00";

/**
 * Register the primary `egm` orchestrator and the eight read-only reviewer
 * subagents. Throws when a required persona is missing rather than registering
 * a partial set.
 */
export async function registerAgents(host: AgentHost, bundleDir: string): Promise<number> {
  const personas = new Map(listAgents(bundleDir).map((agent) => [agent.id, agent]));
  const missing = REVIEWER_IDS.filter((id) => !personas.has(id));
  if (missing.length > 0) {
    throw new Error(`Missing reviewer personas: ${missing.join(", ")}`);
  }

  const definitions: AgentDefinition[] = [
    {
      id: "egm",
      description: "EGM orchestrator: design with context, review with fresh eyes.",
      mode: "primary",
      system: orchestratorPrompt(bundleDir, REVIEWER_IDS),
      permissions: orchestratorPermissions(bundleDir, REVIEWER_IDS),
      color: ORCHESTRATOR_COLOR,
    },
    ...REVIEWER_IDS.map((id): AgentDefinition => {
      const persona = personas.get(id);
      return {
        id,
        description: persona?.description ?? `EGM ${id} reviewer`,
        mode: "subagent",
        system: persona?.body ?? "",
        permissions: reviewerPermissions(bundleDir),
        color: REVIEWER_COLOR,
      };
    }),
  ];

  await host.agent.transform((editor) => {
    for (const definition of definitions) {
      editor.add(definition);
    }
  });
  return definitions.length;
}
