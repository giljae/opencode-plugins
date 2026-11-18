import { fileURLToPath } from "node:url";

import { readUpstreamManifest } from "./content.ts";
import type { McpHost, SkillHost } from "./host.ts";
import { registerMcp } from "./mcp.ts";
import { registerSkills } from "./skills.ts";

export type Host = SkillHost & McpHost;

export interface SetupResult {
  skills: number;
  mcp: number;
}

/** The vendored bundle shipped inside this package. */
export function defaultBundleDir(): string {
  return fileURLToPath(new URL("../vendor/postgres-skills/", import.meta.url));
}

/**
 * Register the skills and the local MCP server. Agents and commands are not
 * needed: OpenCode registers both of those from the plugin directly.
 */
export async function runSetup(host: Host, bundleDir: string): Promise<SetupResult> {
  readUpstreamManifest(bundleDir);
  const skills = await registerSkills(host, bundleDir);
  await registerMcp(host);
  return { skills, mcp: 1 };
}
