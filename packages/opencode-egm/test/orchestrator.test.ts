import { describe, expect, test } from "vitest";

import { orchestratorPrompt } from "../src/orchestrator.ts";
import { REVIEWER_IDS } from "../src/permissions.ts";

const BUNDLE = "/opt/egm/vendor/egm";
const prompt = orchestratorPrompt(BUNDLE, REVIEWER_IDS);

describe("orchestratorPrompt", () => {
  test("names the bundle root and the V2 subagent tool", () => {
    expect(prompt).toContain(BUNDLE);
    expect(prompt).toContain("subagent");
  });

  test("names every reviewer id", () => {
    for (const id of REVIEWER_IDS) {
      expect(prompt).toContain(id);
    }
  });

  test("keeps the human approval gate and drops V1 task wording", () => {
    expect(prompt).toMatch(/approval gate/i);
    expect(prompt.toLowerCase()).not.toMatch(/\btasks?\b/);
  });
});
