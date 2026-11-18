import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";
import { parse } from "yaml";

const root = fileURLToPath(new URL("../../..", import.meta.url));

interface Workflow {
  on?: Record<string, unknown>;
  jobs?: Record<string, { steps?: { run?: string; uses?: string; if?: string }[] }>;
}

function workflow(name: string): Workflow {
  return parse(readFileSync(join(root, ".github/workflows", name), "utf8")) as Workflow;
}

function allRuns(value: unknown): string {
  return JSON.stringify(value);
}

describe("ci.yml", () => {
  const ci = workflow("ci.yml");

  test("runs on pull requests and pushes to main", () => {
    expect(ci.on).toHaveProperty("pull_request");
    expect(ci.on).toHaveProperty("push");
  });

  test("installs, typechecks, and tests", () => {
    const runs = Object.values(ci.jobs ?? {}).flatMap((job) =>
      (job.steps ?? []).map((step) => step.run ?? ""),
    );
    const joined = runs.join("\n");
    expect(joined).toContain("npm ci");
    expect(joined).toContain("npm run typecheck");
    expect(joined).toContain("npm test");
    expect(allRuns(ci)).toContain("actions/checkout");
    expect(allRuns(ci)).toContain("actions/setup-node");
  });
});

describe("upstream-sync.yml", () => {
  const sync = workflow("upstream-sync.yml");

  test("runs on a schedule and on demand", () => {
    expect(sync.on).toHaveProperty("schedule");
    expect(sync.on).toHaveProperty("workflow_dispatch");
  });

  test("syncs the latest upstream tag and tests before publishing", () => {
    const joined = allRuns(sync);
    expect(joined).toContain("releases/latest");
    expect(joined).toContain("scripts/sync-upstream.mjs");
    expect(joined).toContain("npm test");
    expect(joined).toContain("npm publish");
  });

  test("publishes with a token and never republishes a version", () => {
    const joined = allRuns(sync);
    expect(joined).toContain("NPM_TOKEN");
    expect(joined).toMatch(/npm view|already exists|endswith|republish/i);
  });

  test("publishes before pushing the commit so a failed publish is retried", () => {
    const steps = sync.jobs?.sync?.steps ?? [];
    const publishIndex = steps.findIndex((step) => (step.run ?? "").includes("npm publish"));
    const pushIndex = steps.findIndex((step) => (step.run ?? "").includes("git push"));
    expect(publishIndex).toBeGreaterThanOrEqual(0);
    expect(pushIndex).toBeGreaterThanOrEqual(0);
    expect(publishIndex).toBeLessThan(pushIndex);
  });
});
