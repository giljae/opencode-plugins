import { listAgents } from "./content.ts";
import { orchestratorPrompt } from "./orchestrator.ts";
import {
  REVIEWER_IDS,
  orchestratorPermissions,
  reviewerPermissions,
  type Permission,
} from "./permissions.ts";

const ORCHESTRATOR_COLOR = "#1B6EF3";
const REVIEWER_COLOR = "#E86E00";

export interface AgentFile {
  name: string;
  content: string;
}

function yamlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function frontmatter(fields: {
  description: string;
  mode: "primary" | "subagent";
  color: string;
  permissions: readonly Permission[];
}): string {
  const lines = [
    "---",
    `description: ${yamlString(fields.description)}`,
    `mode: ${fields.mode}`,
    `color: ${yamlString(fields.color)}`,
    "permissions:",
  ];
  for (const permission of fields.permissions) {
    lines.push(
      `  - action: ${yamlString(permission.action)}`,
      `    resource: ${yamlString(permission.resource)}`,
      `    effect: ${permission.effect}`,
    );
  }
  lines.push("---");
  return lines.join("\n");
}

/**
 * Render the nine agent markdown files (one primary orchestrator, eight
 * read-only reviewers) from the vendored personas. Throws when a required
 * persona is missing rather than emitting a partial set.
 */
export function buildAgentFiles(bundleDir: string): AgentFile[] {
  const personas = new Map(listAgents(bundleDir).map((agent) => [agent.id, agent]));
  const missing = REVIEWER_IDS.filter((id) => !personas.has(id));
  if (missing.length > 0) {
    throw new Error(`Missing reviewer personas: ${missing.join(", ")}`);
  }

  const files: AgentFile[] = [
    {
      name: "egm.md",
      content: `${frontmatter({
        description: "EGM orchestrator: design with context, review with fresh eyes.",
        mode: "primary",
        color: ORCHESTRATOR_COLOR,
        permissions: orchestratorPermissions(bundleDir, REVIEWER_IDS),
      })}\n${orchestratorPrompt(bundleDir, REVIEWER_IDS)}\n`,
    },
    ...REVIEWER_IDS.map((id): AgentFile => {
      const persona = personas.get(id);
      return {
        name: `${id}.md`,
        content: `${frontmatter({
          description: persona?.description ?? `EGM ${id} reviewer`,
          mode: "subagent",
          color: REVIEWER_COLOR,
          permissions: reviewerPermissions(bundleDir),
        })}\n${persona?.body ?? ""}\n`,
      };
    }),
  ];

  return files.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
