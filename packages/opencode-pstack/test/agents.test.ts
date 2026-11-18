import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { buildAgentFiles, orchestratorPrompt } from "../src/agents.ts";
import { installAgents, writeModelMap } from "../src/install.ts";
import type { RoleModelMap } from "../src/models.ts";

const dirs: string[] = [];

function fixtureBundle(): string {
  const dir = mkdtempSync(join(tmpdir(), "pstack-agents-"));
  dirs.push(dir);
  mkdirSync(join(dir, "agents"), { recursive: true });
  writeFileSync(
    join(dir, "agents", "poteto-agent.md"),
    "---\nname: poteto-agent\ndescription: delegate\nmodel: vendor/some-slug\n---\ndelegate body",
  );
  writeFileSync(
    join(dir, "agents", "comment-sicko.md"),
    "---\nname: comment-sicko\ndescription: comment hater\n---\ncomment body",
  );
  return dir;
}

afterEach(() => {
  while (dirs.length > 0) {
    rmSync(dirs.pop() as string, { recursive: true, force: true });
  }
});

const map: RoleModelMap = {
  "code, prose, judgment": { provider: "provider-a", model: "model-b", variant: "high" },
  "swarm workers": { provider: "provider-a", model: "model-b", variant: "high" },
  "arena runners": [
    { provider: "provider-a", model: "model-b" },
    { provider: "provider-c", model: "model-d" },
  ],
};

describe("orchestratorPrompt", () => {
  test("points at the map and hardcodes no model", () => {
    const prompt = orchestratorPrompt("/bundle", ".opencode/pstack-models.md");
    expect(prompt).toContain(".opencode/pstack-models.md");
    expect(prompt).toContain("subagent");
    expect(prompt).not.toContain("provider-a/model-b");
  });
});

describe("buildAgentFiles", () => {
  test("builds one subagent per distinct model, the orchestrator, and the upstream agents", () => {
    const bundle = fixtureBundle();

    const files = buildAgentFiles(bundle, map, {
      mapPath: ".opencode/pstack-models.md",
      delegateRole: "code, prose, judgment",
    });

    const names = files.map((file) => file.name);
    expect(names).toContain("pstack.md");
    expect(names).toContain("pstack-model-provider-a-model-b-high.md");
    expect(names).toContain("pstack-model-provider-a-model-b.md");
    expect(names).toContain("pstack-model-provider-c-model-d.md");
    expect(names).toContain("poteto-agent.md");
    expect(names).toContain("comment-sicko.md");

    const modelAgent = files.find(
      (file) => file.name === "pstack-model-provider-a-model-b-high.md",
    );
    expect(modelAgent?.content).toContain("mode: subagent");
    expect(modelAgent?.content).toContain("model: provider-a/model-b#high");

    const orchestrator = files.find((file) => file.name === "pstack.md");
    expect(orchestrator?.content).toContain("mode: primary");
    expect(orchestrator?.content).toContain(".opencode/pstack-models.md");
    expect(orchestrator?.content).not.toContain("provider-a/model-b");

    const poteto = files.find((file) => file.name === "poteto-agent.md");
    expect(poteto?.content).toContain("model: provider-a/model-b#high");
    expect(poteto?.content).toContain("delegate body");

    const sicko = files.find((file) => file.name === "comment-sicko.md");
    expect(sicko?.content).toContain("comment body");
    expect(sicko?.content).not.toContain("vendor/some-slug");
  });
});

describe("install", () => {
  test("writes agent files and the model map", () => {
    const dir = mkdtempSync(join(tmpdir(), "pstack-install-"));
    dirs.push(dir);
    const target = join(dir, ".opencode", "agents");
    const written = installAgents([{ name: "pstack.md", content: "x" }], target);
    expect(written).toEqual([join(target, "pstack.md")]);
    const mapPath = join(dir, ".opencode", "pstack-models.md");
    writeModelMap(mapPath, "map");
    expect(readFileSync(mapPath, "utf8")).toBe("map");
  });
});
