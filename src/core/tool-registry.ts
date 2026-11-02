import type { z } from "zod";

export interface ToolDescriptor {
  name: string;
  toolset: string;
  description: string;
  input: z.AnyZodObject;
  output: z.AnyZodObject;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
  mutating: boolean;
  handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

export function defineTool(tool: ToolDescriptor): ToolDescriptor {
  return tool;
}

export class PToolRegistry {
  private readonly tools = new Map<string, ToolDescriptor>();
  register(tool: ToolDescriptor): void {
    if (this.tools.has(tool.name)) throw new Error(`Duplicate tool: ${tool.name}`);
    this.tools.set(tool.name, tool);
  }
  get(name: string): ToolDescriptor | undefined {
    return this.tools.get(name);
  }
  list(): ToolDescriptor[] {
    return [...this.tools.values()];
  }
}
