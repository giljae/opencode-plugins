import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { buildAgentFiles } from "../src/agents.ts";
import { REVIEWER_IDS } from "../src/permissions.ts";

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

describe("buildAgentFiles", () => {
  test("emits the primary orchestrator and the eight read-only reviewers", () => {
    const bundle = fixture(REVIEWER_IDS, ["egm-synthesizer", "egm-bootstrap-orchestrator"]);
    const files = buildAgentFiles(bundle);

    expect(files).toHaveLength(9);
    expect(files.map((file) => file.name).sort()).toEqual(
      [...REVIEWER_IDS.map((id) => `${id}.md`), "egm.md"].sort(),
    );

    const orchestrator = files.find((file) => file.name === "egm.md");
    expect(orchestrator?.content).toContain("mode: primary");
    expect(orchestrator?.content).toContain(bundle);
    expect(orchestrator?.content).toContain('resource: "egm-*"');
    expect(orchestrator?.content).toContain("subagent");

    const reviewer = files.find((file) => file.name === "egm-zoom-out.md");
    expect(reviewer?.content).toContain("mode: subagent");
    expect(reviewer?.content).toContain('action: "*"');
    expect(reviewer?.content).toContain("effect: deny");
    expect(reviewer?.content).toContain("body of egm-zoom-out");
  });

  test("throws instead of emitting a partial set when a persona is missing", () => {
    const bundle = fixture(REVIEWER_IDS.slice(0, 7));
    expect(() => buildAgentFiles(bundle)).toThrow(/Missing reviewer personas/);
  });
});
