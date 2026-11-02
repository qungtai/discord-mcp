import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { z } from "zod";
import type { DiscordRest } from "../adapters/discord-rest/discord-rest.js";
import type { PAttachmentService } from "../adapters/files/attachment-service.js";

export type Toolset = "core" | "messages";
export type CredentialProfile = "bot" | "webhook" | "oauth_user" | "app_owner";
export type ResourceScope =
  | { kind: "channel" | "guild"; param: string }
  | { kind: "none" | "message_reference" };
export type Effect = "read" | "write" | "destructive" | "local_write";
export type LogLevel = "debug" | "info" | "warning" | "error";
export interface ToolContext {
  rest: DiscordRest;
  files: Pick<PAttachmentService, "upload" | "download">;
  signal: AbortSignal;
  progress: (progress: number, total?: number) => Promise<void>;
  log: (level: LogLevel, message: string) => Promise<void>;
  correlation_id: string;
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
  execute(input: z.infer<I>, context: ToolContext): Promise<z.input<O>>;
}
export interface ToolDescriptor extends Omit<ToolSpec<z.AnyZodObject, z.AnyZodObject>, "name"> {
  name: string;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
}
const descriptors = new WeakSet<object>();
export function defineTool<I extends z.AnyZodObject, O extends z.AnyZodObject>(
  spec: ToolSpec<I, O>,
): ToolDescriptor {
  if (!/^discord_[a-z0-9]+(?:_[a-z0-9]+)+$/.test(spec.name))
    throw new Error(`Invalid tool name: ${spec.name}`);
  const tool: ToolDescriptor = {
    ...(spec as unknown as ToolSpec<z.AnyZodObject, z.AnyZodObject>),
    annotations: {
      readOnlyHint: spec.effect === "read",
      destructiveHint: spec.effect === "destructive",
      idempotentHint: spec.idempotent,
      openWorldHint: spec.effect !== "local_write",
    },
  };
  descriptors.add(tool);
  return tool;
}
export class PToolRegistry {
  private readonly tools = new Map<string, ToolDescriptor>();
  static async load(
    dir = fileURLToPath(new URL("../operations/", import.meta.url)),
  ): Promise<PToolRegistry> {
    const registry = new PToolRegistry();
    const files = (await readdir(dir, { recursive: true }))
      .filter((file) => /\.[jt]s$/.test(file) && !file.endsWith(".d.ts"))
      .sort();
    for (const file of files)
      for (const value of Object.values(await import(pathToFileURL(join(dir, file)).href)))
        if (typeof value === "object" && value !== null && descriptors.has(value))
          registry.register(value as ToolDescriptor);
    return registry;
  }
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
