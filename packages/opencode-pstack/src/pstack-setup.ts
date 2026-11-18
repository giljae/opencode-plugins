import { existsSync, readFileSync } from "node:fs";

import { buildAgentFiles } from "./agents.ts";
import type { CommandHost, ModelHost, ModelInfo } from "./host.ts";
import { installAgents, writeModelMap } from "./install.ts";
import { ROLES, parseModelMap, renderModelMap, type RoleModelMap } from "./models.ts";

export const SETUP_COMMAND = "pstack-setup";

/** The message shown when roles are still unchosen: only the user's models. */
export function planSetup(models: readonly ModelInfo[], mapPath: string): string {
  const list = models
    .map(
      (model) =>
        `- ${model.provider}/${model.id}${model.variants?.length ? ` (variants: ${model.variants.join(", ")})` : ""}`,
    )
    .join("\n");
  const roles = ROLES.map((role) => `${role}: `).join("\n");
  return `Choose a model for each pstack role from the models configured in your OpenCode:

${list || "(no models found — configure a provider first)"}

Write your choices to ${mapPath}, then run /${SETUP_COMMAND} again. Format:

${roles}`;
}

/** A blank map with one line per role, for the user to fill in. */
export function renderTemplate(): string {
  const lines = [
    "# pstack model map — written by /pstack-setup",
    "# fill each role with provider/model#variant, comma-separated for panel roles",
  ];
  for (const role of ROLES) {
    lines.push(`${role}: `);
  }
  return `${lines.join("\n")}\n`;
}

export function missingRoles(map: RoleModelMap): string[] {
  return ROLES.filter((role) => !map[role]);
}

export interface ApplyOptions {
  bundleDir: string;
  targetDir: string;
  mapPath: string;
  delegateRole?: string;
}

/** Write the agents and the map. Refuses an incomplete map; never defaults. */
export function applySetup(map: RoleModelMap, options: ApplyOptions): string[] {
  const missing = missingRoles(map);
  if (missing.length > 0) {
    throw new Error(`No model chosen for: ${missing.join(", ")}`);
  }
  const files = buildAgentFiles(options.bundleDir, map, {
    mapPath: options.mapPath,
    delegateRole: options.delegateRole ?? "code, prose, judgment",
  });
  const written = installAgents(files, options.targetDir);
  writeModelMap(options.mapPath, renderModelMap(map));
  return written;
}

/**
 * Register `/pstack-setup`. Its first run writes a template listing the user's
 * own models; a later run applies the filled map.
 */
export async function registerSetupCommand(
  host: CommandHost & ModelHost,
  options: { bundleDir: string; targetDir: string; mapPath: string },
): Promise<void> {
  await host.command.transform((editor) => {
    editor.add({
      name: SETUP_COMMAND,
      description: "Choose the OpenCode models pstack uses per role and write its agents",
      execute: async ({ sessionID, prompt, delivery }) => {
        const models = await host.model.list();
        const existing: RoleModelMap = existsSync(options.mapPath)
          ? parseModelMap(readFileSync(options.mapPath, "utf8"))
          : {};
        const chosen: RoleModelMap = { ...existing };
        if (prompt.text.trim().length > 0) {
          Object.assign(chosen, parseModelMap(prompt.text));
        }
        if (missingRoles(chosen).length === 0) {
          const written = applySetup(chosen, options);
          await host.session.prompt({
            ...prompt,
            sessionID,
            delivery,
            text: `Wrote ${written.length} pstack agent files and updated ${options.mapPath}.`,
          });
        } else {
          writeModelMap(options.mapPath, renderTemplate());
          await host.session.prompt({
            ...prompt,
            sessionID,
            delivery,
            text: planSetup(models, options.mapPath),
          });
        }
      },
    });
  });
}
