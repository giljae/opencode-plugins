// Minimal structural view of the OpenCode V2 plugin context. We declare only
// what we call, so tests can supply fakes and the host owns the rest.
//
// Note: OpenCode V2 plugins cannot add agents (`AgentEditor` has no `add`), so
// agents are delivered as markdown files rather than registered here.

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
