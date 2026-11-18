import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { registerAgents } from "../src/agents.ts";
import type { AgentDefinition, AgentHost } from "../src/host.ts";
import { REVIEWER_IDS, orchestratorPermissions, reviewerPermissions } from "../src/permissions.ts";

const BUNDLE = "/opt/egm/vendor/egm";
const dirs: string[] = [];

function fixture(reviewerIds: readonly string[], extraIds: string[] = []): string {
  const base = mkdtempSync(join(tmpdir(), "agents-"));
  dirs.push(base);
  const agentsDir = join(base, "agents");
  mkdirSync(agentsDir, { recursive: true });
  for (const id of [...reviewerIds, ...extraIds]) {
    const file = join(agentsDir, `${id.replace(/^egm-/, "").replace(/-/g, "_")}.md`);
    writeFileSync(file, `---\nname: ${id}\ndescription: persona ${id}\n---\nbody of ${id}`);
  }
  return base;
}

afterEach(() => {
  while (dirs.length > 0) {
    rmSync(dirs.pop() as string, { recursive: true, force: true });
  }
});

function fakeHost(): { host: AgentHost; added: AgentDefinition[] } {
  const added: AgentDefinition[] = [];
  const host: AgentHost = {
    agent: {
      transform: async (cb) => {
        cb({ add: (agent) => added.push(agent) });
      },
    },
  };
  return { host, added };
}

describe("registerAgents", () => {
  test("registers one primary orchestrator and the eight reviewers", async () => {
    const bundle = fixture(REVIEWER_IDS, ["egm-synthesizer", "egm-bootstrap-orchestrator"]);
    const { host, added } = fakeHost();

    const count = await registerAgents(host, bundle);

    expect(count).toBe(9);
    expect(added).toHaveLength(9);
    const primary = added.find((a) => a.id === "egm");
    expect(primary?.mode).toBe("primary");
    expect(primary?.permissions).toEqual(orchestratorPermissions(bundle, REVIEWER_IDS));
    expect(primary?.system).toContain(bundle);

    const reviewers = added.filter((a) => a.id !== "egm");
    expect(reviewers.map((a) => a.id).sort()).toEqual([...REVIEWER_IDS].sort());
    for (const reviewer of reviewers) {
      expect(reviewer.mode).toBe("subagent");
      expect(reviewer.system).toBe(`body of ${reviewer.id}`);
      expect(reviewer.permissions).toEqual(reviewerPermissions(bundle));
    }
  });

  test("throws instead of registering a partial set when a persona is missing", async () => {
    const bundle = fixture(REVIEWER_IDS.slice(0, 7));
    const { host, added } = fakeHost();
    await expect(registerAgents(host, bundle)).rejects.toThrow(/Missing reviewer personas/);
    expect(added).toEqual([]);
  });
});
