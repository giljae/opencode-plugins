import { describe, expect, test } from "vitest";

import {
  REVIEWER_IDS,
  orchestratorPermissions,
  resolveEffect,
  reviewerPermissions,
} from "../src/permissions.ts";

const BUNDLE = "/opt/egm/vendor/egm";

describe("REVIEWER_IDS", () => {
  test("lists eight unique reviewers", () => {
    expect(REVIEWER_IDS).toHaveLength(8);
    expect(new Set(REVIEWER_IDS).size).toBe(8);
    for (const id of REVIEWER_IDS) {
      expect(id).toMatch(/^egm-[a-z-]+$/);
    }
  });
});

describe("reviewerPermissions", () => {
  const rules = reviewerPermissions(BUNDLE);
  const effect = (action: string, resource: string) => resolveEffect(rules, action, resource);

  test("reads ordinary files but denies secrets", () => {
    expect(effect("read", "src/index.ts")).toBe("allow");
    expect(effect("read", ".env")).toBe("deny");
    expect(effect("read", "config/.env.local")).toBe("deny");
    expect(effect("read", ".env.example")).toBe("allow");
  });

  test("denies grep because it bypasses per-file read rules", () => {
    expect(effect("grep", "secret")).toBe("deny");
  });

  test("denies every mutating or delegating action", () => {
    for (const action of ["edit", "shell", "subagent", "skill", "webfetch", "websearch"]) {
      expect(effect(action, "*")).toBe("deny");
    }
  });

  test("allows glob and reads inside the installed bundle", () => {
    expect(effect("glob", "**/*.md")).toBe("allow");
    expect(effect("read", `${BUNDLE}/agents/zoom_out.md`)).toBe("allow");
  });
});

describe("orchestratorPermissions", () => {
  const rules = orchestratorPermissions(BUNDLE, REVIEWER_IDS);
  const effect = (action: string, resource: string) => resolveEffect(rules, action, resource);

  test("allows only egm skills", () => {
    expect(effect("skill", "egm-review")).toBe("allow");
    expect(effect("skill", "other-skill")).toBe("deny");
  });

  test("allows only the registered reviewer subagents", () => {
    expect(effect("subagent", REVIEWER_IDS[0] as string)).toBe("allow");
    expect(effect("subagent", "egm-review")).toBe("deny");
    expect(effect("subagent", "build")).toBe("deny");
  });

  test("asks before writes, shell, and env reads", () => {
    expect(effect("edit", "src/index.ts")).toBe("ask");
    expect(effect("shell", "git status")).toBe("ask");
    expect(effect("read", ".env")).toBe("ask");
  });
});

describe("resolveEffect", () => {
  test("uses the last matching rule", () => {
    const rules = [
      { action: "*", resource: "*", effect: "deny" as const },
      { action: "read", resource: "*.env.example", effect: "allow" as const },
    ];
    expect(resolveEffect(rules, "read", ".env.example")).toBe("allow");
    expect(resolveEffect(rules, "read", ".env")).toBe("deny");
  });

  test("returns ask when nothing matches", () => {
    expect(resolveEffect([], "read", "x")).toBe("ask");
  });
});
