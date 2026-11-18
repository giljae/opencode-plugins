import { listSkills } from "./content.ts";
import type { SkillHost } from "./host.ts";

/**
 * Register every vendored skill. Keeps the directory-form `path` so OpenCode
 * exposes the neighboring `references/` file list to the agent.
 */
export async function registerSkills(host: SkillHost, bundleDir: string): Promise<number> {
  const skills = listSkills(bundleDir);
  await host.skill.transform((editor) => {
    for (const skill of skills) {
      editor.add({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        path: skill.skillPath,
        content: skill.body,
      });
    }
  });
  return skills.length;
}
