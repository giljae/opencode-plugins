import { describe, expect, test } from "vitest";

import {
  ROLES,
  distinctModels,
  formatModelRef,
  modelAgentId,
  parseModelMap,
  parseModelRef,
  renderModelMap,
  type RoleModelMap,
} from "../src/models.ts";

describe("modelAgentId", () => {
  test("sanitizes provider, model, and variant", () => {
    expect(modelAgentId({ provider: "openai", model: "gpt-6.2", variant: "high" })).toBe(
      "pstack-model-openai-gpt-6-2-high",
    );
    expect(modelAgentId({ provider: "vendor-x", model: "model/y" })).toBe(
      "pstack-model-vendor-x-model-y",
    );
  });
});

describe("model refs", () => {
  test("format and parse round-trip", () => {
    const model = { provider: "provider-a", model: "model-b", variant: "high" };
    expect(parseModelRef(formatModelRef(model))).toEqual(model);
    expect(parseModelRef("provider-a/model-b")).toEqual({ provider: "provider-a", model: "model-b" });
    expect(() => parseModelRef("nope")).toThrow(/model ref/i);
  });
});

describe("model map", () => {
  test("renders and parses, including list (panel) roles", () => {
    const map: RoleModelMap = {
      "code, prose, judgment": { provider: "provider-a", model: "model-b", variant: "high" },
      "arena runners": [
        { provider: "provider-a", model: "model-b" },
        { provider: "provider-c", model: "model-d" },
      ],
    };
    const text = renderModelMap(map);
    expect(text).toContain("provider-a/model-b#high");
    expect(parseModelMap(text)).toEqual(map);
  });

  test("lists distinct models across roles, deduplicated", () => {
    const map: RoleModelMap = {
      r1: { provider: "p", model: "m", variant: "high" },
      r2: [
        { provider: "p", model: "m", variant: "high" },
        { provider: "p", model: "m" },
      ],
    };
    expect(distinctModels(map).map(modelAgentId)).toEqual([
      "pstack-model-p-m",
      "pstack-model-p-m-high",
    ]);
  });

  test("ROLES name pstack's roles", () => {
    expect(ROLES).toContain("swarm workers");
    expect(ROLES).toContain("arena runners");
    expect(ROLES).toContain("code, prose, judgment");
  });
});
