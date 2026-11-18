// Minimal structural view of the OpenCode V2 plugin context. We declare only
// what we call, so tests can supply fakes and the host owns the rest.

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  path: string;
  content: string;
  /** Whether the skill is advertised to the model. */
  autoinvoke?: boolean;
}

export interface SkillEditor {
  add(skill: SkillDefinition): void;
}

export interface SkillHost {
  skill: {
    transform(callback: (editor: SkillEditor) => void): Promise<unknown>;
  };
}

export interface CommandInvocation {
  sessionID: string;
  prompt: { text: string } & Record<string, unknown>;
  delivery: "steer" | "queue";
}

export interface CommandDefinition {
  name: string;
  description: string;
  execute(input: CommandInvocation): Promise<void> | void;
}

export interface CommandEditor {
  add(command: CommandDefinition): void;
}

export interface CommandHost {
  command: {
    transform(callback: (editor: CommandEditor) => void): Promise<unknown>;
  };
  session: {
    prompt(input: Record<string, unknown>): Promise<unknown>;
  };
}

export interface ModelInfo {
  provider: string;
  id: string;
  variants?: string[];
}

export interface ModelHost {
  model: {
    list(): Promise<ModelInfo[]>;
  };
}
