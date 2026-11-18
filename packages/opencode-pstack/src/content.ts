import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface UpstreamManifest {
  repo: string;
  ref: string;
  commit: string;
  version: string;
  fetchedAt: string;
  files: Record<string, string>;
}

export interface VendoredSkill {
  id: string;
  dir: string;
  skillPath: string;
  name: string;
  description: string;
  body: string;
  /** False when the skill sets `disable-model-invocation` (pstack's default). */
  autoinvoke: boolean;
}

export interface VendoredAgent {
  id: string;
  file: string;
  name: string;
  description: string;
  body: string;
  /** The Cursor model slug some agents declare; the adapter replaces it. */
  model?: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const FIELD = /^([A-Za-z0-9_.-]+):\s*(.*)$/;

export function parseFrontmatter(markdown: string): {
  data: Record<string, string>;
  body: string;
} {
  const normalized = markdown.replace(/^\uFEFF/, "");
  const match = FRONTMATTER.exec(normalized);
  if (!match) {
    return { data: {}, body: normalized };
  }
  const data: Record<string, string> = {};
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    const field = FIELD.exec(line);
    if (field?.[1] !== undefined) {
      data[field[1]] = (field[2] ?? "").trim();
    }
  }
  return { data, body: normalized.slice(match[0].length) };
}

export function listSkills(bundleDir: string): VendoredSkill[] {
  const skillsDir = join(bundleDir, "skills");
  if (!existsSync(skillsDir)) {
    return [];
  }
  const skills: VendoredSkill[] = [];
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(skillsDir, entry.name);
    const skillPath = join(dir, "SKILL.md");
    if (!existsSync(skillPath)) continue;
    const { data, body } = parseFrontmatter(readFileSync(skillPath, "utf8"));
    skills.push({
      id: entry.name,
      dir,
      skillPath,
      name: data.name ?? entry.name,
      description: data.description ?? "",
      body,
      autoinvoke: data["disable-model-invocation"] !== "true",
    });
  }
  return skills.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function listAgents(bundleDir: string): VendoredAgent[] {
  const agentsDir = join(bundleDir, "agents");
  if (!existsSync(agentsDir)) {
    return [];
  }
  const agents: VendoredAgent[] = [];
  for (const entry of readdirSync(agentsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const file = join(agentsDir, entry.name);
    const { data, body } = parseFrontmatter(readFileSync(file, "utf8"));
    const id = data.name ?? entry.name.replace(/\.md$/, "");
    agents.push({
      id,
      file,
      name: id,
      description: data.description ?? "",
      body,
      model: data.model,
    });
  }
  return agents.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function readUpstreamManifest(bundleDir: string): UpstreamManifest {
  const path = join(bundleDir, "UPSTREAM.json");
  if (!existsSync(path)) {
    throw new Error(`Missing upstream manifest: ${path}`);
  }
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<UpstreamManifest>;
  if (
    typeof parsed.commit !== "string" ||
    parsed.commit.length === 0 ||
    typeof parsed.files !== "object" ||
    parsed.files === null
  ) {
    throw new Error(`Malformed upstream manifest: ${path}`);
  }
  return parsed as UpstreamManifest;
}
