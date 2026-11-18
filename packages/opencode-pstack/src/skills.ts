import { listSkills } from "./content.ts";
import type { SkillHost } from "./host.ts";

/**
 * Register every vendored pstack skill. Keeps the directory-form `path` so the
 * agent can read a skill's `references/`, `playbooks/`, and `scripts/`. Passes
 * `autoinvoke` through, because pstack's skills are explicitly invoked.
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
        autoinvoke: skill.autoinvoke,
      });
    }
  });
  return skills.length;
}
