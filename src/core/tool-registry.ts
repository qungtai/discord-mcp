import type { z } from "zod";
import type { DiscordRest } from "../adapters/discord-rest/discord-rest.js";
import type { PAttachmentService } from "../adapters/files/attachment-service.js";

export type Toolset = "core" | "messages";
export type CredentialProfile = "bot" | "webhook" | "oauth_user" | "app_owner";
export type ResourceScope =
  | { kind: "channel" | "guild"; param: string }
  | { kind: "none" | "message_reference" };
export type Effect = "read" | "write" | "destructive" | "local_write";
export interface ToolContext {
  rest: DiscordRest;
  files: Pick<PAttachmentService, "upload" | "download">;
  signal: AbortSignal;
  progress: (value: number) => void;
  log: (message: string) => void;
  correlationId: string;
}
export interface ToolSpec<I extends z.AnyZodObject, O extends z.AnyZodObject> {
  name: `discord_${string}`;
  description: string;
  operation_ids: readonly string[];
  toolset: Toolset;
  credential: CredentialProfile;
  scope: ResourceScope;
  effect: Effect;
  idempotent: boolean;
  input: I;
  output: O;
  execute(input: z.infer<I>, context: ToolContext): Promise<z.infer<O>>;
  preview?(input: z.infer<I>, context: ToolContext): Promise<Record<string, unknown>>;
}
export interface ToolDescriptor {
  name: string;
  description: string;
  operation_ids: readonly string[];
  toolset: Toolset;
  credential: CredentialProfile;
  scope: ResourceScope;
  effect: Effect;
  idempotent: boolean;
  input: z.AnyZodObject;
  output: z.AnyZodObject;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
  handler(input: unknown, context: ToolContext): Promise<Record<string, unknown>>;
}
export function defineTool<I extends z.AnyZodObject, O extends z.AnyZodObject>(
  spec: ToolSpec<I, O>,
): ToolDescriptor {
  if (!/^discord_[a-z0-9]+(?:_[a-z0-9]+)+$/.test(spec.name))
    throw new Error(`Invalid tool name: ${spec.name}`);
  return {
    ...spec,
    annotations: {
      readOnlyHint: spec.effect === "read",
      destructiveHint: spec.effect === "destructive",
      idempotentHint: spec.idempotent,
      openWorldHint: true,
    },
    handler: (input, context) => spec.execute(input as z.infer<I>, context),
  };
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
