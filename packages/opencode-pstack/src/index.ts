import { join } from "node:path";

import { Plugin } from "@opencode/plugin";

import { defaultBundleDir, runSetup, type Host } from "./setup.ts";

export default Plugin.define({
  id: "pstack",
  async setup(ctx) {
    // Our Host is the structural subset we call; the real context carries
    // branded schema types, so cast at this single boundary.
    const host = ctx as unknown as Host;
    const project = ctx.location.directory;
    await runSetup(host, {
      bundleDir: defaultBundleDir(),
      agentId: "pstack",
      targetDir: join(project, ".opencode", "agents"),
      mapPath: join(project, ".opencode", "pstack-models.md"),
    });
  },
});
