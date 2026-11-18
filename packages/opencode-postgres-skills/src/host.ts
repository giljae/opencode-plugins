// Minimal structural view of the OpenCode V2 plugin context. We declare only
// what we call, so tests can supply fakes and the host owns the rest.

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  path: string;
  content: string;
}

export interface SkillEditor {
  add(skill: SkillDefinition): void;
}

export interface SkillHost {
  skill: {
    transform(callback: (editor: SkillEditor) => void): Promise<unknown>;
  };
}

export interface TimeoutConfig {
  startup?: number;
  catalog?: number;
  execution?: number;
}

export interface McpLocalConfig {
  type: "local";
  command: string[];
  cwd?: string;
  environment?: Record<string, string>;
  disabled?: boolean;
  timeout?: TimeoutConfig;
}

export interface McpEditor {
  list(): readonly [string, McpLocalConfig][];
  get(name: string): McpLocalConfig | undefined;
  set(name: string, config: McpLocalConfig): void;
  remove(name: string): void;
}

export interface McpHost {
  mcp: {
    transform(callback: (editor: McpEditor) => void): Promise<unknown>;
  };
}
