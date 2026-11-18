import { listAgents } from "./content.ts";
import {
  distinctModels,
  formatModelRef,
  modelAgentId,
  type RoleModel,
  type RoleModelMap,
} from "./models.ts";

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
  model?: RoleModel;
}): string {
  const lines = [
    "---",
    `description: ${yamlString(fields.description)}`,
    `mode: ${fields.mode}`,
  ];
  if (fields.model) {
    lines.push(`model: ${formatModelRef(fields.model)}`);
  }
  lines.push("---");
  return lines.join("\n");
}

/**
 * The orchestrator's system prompt. It names the model map and the dispatch
 * mechanism; it never names a model, because the agent configs own the models.
 */
export function orchestratorPrompt(bundleDir: string, mapPath: string): string {
  return `You are the pstack orchestrator for OpenCode.

pstack bundle root: ${bundleDir}
Model map: ${mapPath}

When a pstack skill names a model or a role, dispatch the matching OpenCode
subagent with the \`subagent\` tool, using the agent id recorded in the model map.
Never pass a model name to a tool: OpenCode selects the model from the agent's
own configuration.

- A role that maps to a list is a panel. Dispatch one subagent per entry.
- Subagents run in the background. Wait for each to report before you synthesize.
- Verification runs on the \`swarm workers\` model's agent.
- Resolve a skill's \`references/\`, \`playbooks/\`, and \`scripts/\` against that
  skill's own directory.
- Cursor-only steps (automations, bugbot, .cursor settings) are unavailable.
  Note the skip in one line and continue.
- Keep pstack's approval and verification gates. Read a delegate's own skill
  before dispatching it when the skill says so.`;
}

export interface BuildAgentFilesOptions {
  mapPath: string;
  /** Role whose model the poteto-agent delegate uses. */
  delegateRole?: string;
}

function firstModel(value: RoleModel | RoleModel[] | undefined): RoleModel | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Render the agent files for a chosen role→model map: one subagent per distinct
 * model, the `pstack` orchestrator, and the two upstream agents.
 */
export function buildAgentFiles(
  bundleDir: string,
  map: RoleModelMap,
  options: BuildAgentFilesOptions,
): AgentFile[] {
  const files: AgentFile[] = [];

  for (const model of distinctModels(map)) {
    files.push({
      name: `${modelAgentId(model)}.md`,
      content: `${frontmatter({
        description: `pstack delegate on ${formatModelRef(model)}`,
        mode: "subagent",
        model,
      })}\nA pstack model-routed delegate. Read the skill your parent names, do the work in the background, and report back to your parent.\n`,
    });
  }

  files.push({
    name: "pstack.md",
    content: `${frontmatter({ description: "pstack orchestrator", mode: "primary" })}\n${orchestratorPrompt(bundleDir, options.mapPath)}\n`,
  });

  const delegate = options.delegateRole ? firstModel(map[options.delegateRole]) : undefined;
  for (const agent of listAgents(bundleDir)) {
    const model = agent.id === "poteto-agent" ? delegate : undefined;
    files.push({
      name: `${agent.id}.md`,
      content: `${frontmatter({ description: agent.description, mode: "subagent", model })}\n${agent.body}\n`,
    });
  }

  return files.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
