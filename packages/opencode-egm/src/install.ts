import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { AgentFile } from "./agents.ts";

/**
 * Write generated agent markdown into `targetDir`, creating it when missing.
 * Existing files are overwritten so re-running the install updates them.
 */
export function installAgents(files: readonly AgentFile[], targetDir: string): string[] {
  mkdirSync(targetDir, { recursive: true });
  const written: string[] = [];
  for (const file of files) {
    const path = join(targetDir, file.name);
    writeFileSync(path, file.content);
    written.push(path);
  }
  return written;
}
