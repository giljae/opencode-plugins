import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { AgentFile } from "./agents.ts";

/** Write generated agent markdown into `targetDir`, overwriting existing files. */
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

/** Write the role→agent model map the orchestrator reads. */
export function writeModelMap(mapPath: string, content: string): void {
  mkdirSync(dirname(mapPath), { recursive: true });
  writeFileSync(mapPath, content);
}
