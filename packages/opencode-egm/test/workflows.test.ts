import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";
import { parse } from "yaml";

const root = fileURLToPath(new URL("../../..", import.meta.url));

interface Workflow {
  on?: Record<string, { inputs?: Record<string, unknown> }>;
  jobs?: Record<string, { steps?: { run?: string; uses?: string; if?: string }[] }>;
}

const sync = parse(
  readFileSync(join(root, ".github/workflows/upstream-sync.yml"), "utf8"),
) as Workflow;

const steps = sync.jobs?.sync?.steps ?? [];
const runs = steps.map((step) => step.run ?? "").join("\n");

describe("upstream-sync.yml (shared by every plugin)", () => {
  test("runs on a schedule and on demand with the expected inputs", () => {
    expect(sync.on).toHaveProperty("schedule");
    expect(sync.on).toHaveProperty("workflow_dispatch");
    const inputs = sync.on?.workflow_dispatch?.inputs ?? {};
    expect(Object.keys(inputs)).toEqual(
      expect.arrayContaining(["verify_token", "test_publish", "package_filter"]),
    );
  });

  test("discovers every plugin package and iterates them", () => {
    expect(runs).toContain("scripts/upstream-status.mjs");
    expect(runs).toMatch(/for dir in/);
    expect(runs).toContain("npm test");
    expect(runs).toContain("npm publish");
    expect(runs).toContain("NPM_TOKEN");
  });

  test("publishes before pushing the commit, and hard-codes no package name", () => {
    const publishIndex = steps.findIndex((step) => (step.run ?? "").includes("npm publish"));
    const pushIndex = steps.findIndex((step) => (step.run ?? "").includes("git push"));
    expect(publishIndex).toBeGreaterThanOrEqual(0);
    expect(pushIndex).toBeGreaterThan(publishIndex);
    expect(JSON.stringify(sync)).not.toContain("@giljae/opencode-egm");
    expect(JSON.stringify(sync)).not.toContain("@giljae/opencode-postgres-skills");
  });

  test("uses Node 22 (the postgres package requires it)", () => {
    expect(JSON.stringify(sync)).toContain('"node-version":22');
  });
});

describe("ci.yml", () => {
  const ci = parse(
    readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"),
  ) as Workflow;

  test("runs on pull requests and pushes, and installs, typechecks, and tests", () => {
    expect(ci.on).toHaveProperty("pull_request");
    expect(ci.on).toHaveProperty("push");
    const ciRuns = (ci.jobs?.test?.steps ?? []).map((step) => step.run ?? "").join("\n");
    expect(ciRuns).toContain("npm ci");
    expect(ciRuns).toContain("npm run typecheck");
    expect(ciRuns).toContain("npm test");
  });

  test("uses Node 22", () => {
    expect(JSON.stringify(ci)).toContain('"node-version":22');
  });
});
