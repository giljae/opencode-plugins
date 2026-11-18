export type Effect = "allow" | "deny" | "ask";

export interface Permission {
  action: string;
  resource: string;
  effect: Effect;
}

/** Canonical reviewer ids; the frontmatter names of the eight read-only personas. */
export const REVIEWER_IDS = [
  "egm-codebase-details",
  "egm-comprehension",
  "egm-design-critic",
  "egm-implementation-readiness",
  "egm-inventive-catalyst",
  "egm-structural",
  "egm-style",
  "egm-zoom-out",
] as const;

const CASE_INSENSITIVE = process.platform === "win32";

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, CASE_INSENSITIVE ? "i" : "");
}

function matches(pattern: string, value: string): boolean {
  return globToRegExp(pattern).test(value);
}

/**
 * OpenCode's rule semantics: rules combine in order and the last match wins;
 * when no rule matches, the result is `ask`.
 */
export function resolveEffect(
  rules: readonly Permission[],
  action: string,
  resource: string,
): Effect {
  let result: Effect = "ask";
  for (const rule of rules) {
    if (matches(rule.action, action) && matches(rule.resource, resource)) {
      result = rule.effect;
    }
  }
  return result;
}

/** Read-only reviewer: deny everything, then allow reads and globs, deny grep. */
export function reviewerPermissions(bundleDir: string): Permission[] {
  return [
    { action: "*", resource: "*", effect: "deny" },
    { action: "read", resource: "*", effect: "allow" },
    { action: "read", resource: "*.env", effect: "deny" },
    { action: "read", resource: "*.env.*", effect: "deny" },
    { action: "read", resource: "*.env.example", effect: "allow" },
    { action: "read", resource: `${bundleDir}/*`, effect: "allow" },
    { action: "glob", resource: "*", effect: "allow" },
    { action: "grep", resource: "*", effect: "deny" },
  ];
}

/** Orchestrator: read the project, load egm skills, dispatch only the reviewers. */
export function orchestratorPermissions(
  bundleDir: string,
  reviewerIds: readonly string[],
): Permission[] {
  return [
    { action: "read", resource: "*", effect: "allow" },
    { action: "read", resource: "*.env", effect: "ask" },
    { action: "read", resource: "*.env.*", effect: "ask" },
    { action: "read", resource: `${bundleDir}/*`, effect: "allow" },
    { action: "glob", resource: "*", effect: "allow" },
    { action: "grep", resource: "*", effect: "allow" },
    { action: "skill", resource: "*", effect: "deny" },
    { action: "skill", resource: "egm-*", effect: "allow" },
    { action: "subagent", resource: "*", effect: "deny" },
    ...reviewerIds.map(
      (id): Permission => ({ action: "subagent", resource: id, effect: "allow" }),
    ),
    { action: "edit", resource: "*", effect: "ask" },
    { action: "shell", resource: "*", effect: "ask" },
  ];
}
