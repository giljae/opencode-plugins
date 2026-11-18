/** pstack's roles, as named by its `setup-pstack` skill. */
export const ROLES = [
  "code, prose, judgment",
  "bug-fix",
  "perf-issue",
  "hillclimb",
  "feature, refactoring",
  "swarm workers",
  "arena runners",
  "arena cross-judge pool",
  "interrogate reviewers",
] as const;

export interface RoleModel {
  provider: string;
  model: string;
  variant?: string;
}

/** A role maps to one model, or to a list for panel roles. */
export type RoleModelMap = Record<string, RoleModel | RoleModel[]>;

function sanitize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The OpenCode subagent id for a chosen model. */
export function modelAgentId(model: RoleModel): string {
  const base = `pstack-model-${sanitize(model.provider)}-${sanitize(model.model)}`;
  return model.variant ? `${base}-${sanitize(model.variant)}` : base;
}

export function formatModelRef(model: RoleModel): string {
  return `${model.provider}/${model.model}${model.variant ? `#${model.variant}` : ""}`;
}

export function parseModelRef(ref: string): RoleModel {
  const slash = ref.indexOf("/");
  if (slash <= 0 || slash === ref.length - 1) {
    throw new Error(`Invalid model ref: ${ref}`);
  }
  const provider = ref.slice(0, slash);
  const rest = ref.slice(slash + 1);
  const hash = rest.indexOf("#");
  if (hash === -1) {
    return { provider, model: rest };
  }
  const model = rest.slice(0, hash);
  const variant = rest.slice(hash + 1);
  if (!model) {
    throw new Error(`Invalid model ref: ${ref}`);
  }
  return variant ? { provider, model, variant } : { provider, model };
}

export function renderModelMap(map: RoleModelMap): string {
  const lines = [
    "# pstack model map — written by /pstack-setup",
    "# role: provider/model#variant, comma-separated for panel roles",
  ];
  for (const role of ROLES) {
    const value = map[role];
    if (!value) continue;
    const refs = (Array.isArray(value) ? value : [value]).map(formatModelRef).join(", ");
    if (refs.length > 0) {
      lines.push(`${role}: ${refs}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function parseModelMap(text: string): RoleModelMap {
  const map: RoleModelMap = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf(":");
    if (separator === -1) continue;
    const role = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!role || !value) continue;
    const refs = value
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map(parseModelRef);
    if (refs.length === 1) {
      map[role] = refs[0] as RoleModel;
    } else if (refs.length > 1) {
      map[role] = refs;
    }
  }
  return map;
}

/** Every distinct model in the map, one entry per generated agent. */
export function distinctModels(map: RoleModelMap): RoleModel[] {
  const seen = new Map<string, RoleModel>();
  for (const value of Object.values(map)) {
    for (const model of Array.isArray(value) ? value : [value]) {
      seen.set(modelAgentId(model), model);
    }
  }
  return [...seen.values()].sort((a, b) => {
    const left = modelAgentId(a);
    const right = modelAgentId(b);
    return left < right ? -1 : left > right ? 1 : 0;
  });
}
