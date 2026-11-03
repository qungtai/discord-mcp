import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { PermissionFlagsBits } from "discord-api-types/v10";
import type { z } from "zod/v4";
import type { DiscordRequest, ScopeKind, ToolFiles } from "./ports.js";

// Every PRD toolset is listed up front so toolset work never edits this line.
export const TOOLSETS = [
  "core",
  "messages",
  "reactions",
  "threads",
  "channels",
  "webhooks",
  "guild",
  "members",
  "roles",
  "moderation",
  "events",
  "invites",
  "expressions",
  "voice",
  "commands",
  "monetization",
  "oauth_user",
  "social_sdk",
  "utility",
  "realtime",
] as const;
export const DEFAULT_TOOLSETS: readonly Toolset[] = ["core", "messages"];
export type Toolset = (typeof TOOLSETS)[number];
export type CredentialProfile = "bot" | "webhook" | "oauth_user" | "app_owner";
export type Permission = keyof typeof PermissionFlagsBits;
export type Effect = "read" | "write" | "destructive" | "local_write";
export type LogLevel = "debug" | "info" | "warning" | "error";
type Key<I extends z.ZodObject> = keyof z.infer<I> & string;
export type ResourceScope<K extends string = string> =
  | "none"
  | Partial<Record<ScopeKind, K | readonly K[]>>;
export interface ToolContext {
  discord: DiscordRequest;
  files: ToolFiles;
  signal: AbortSignal;
  progress: (progress: number, total?: number) => Promise<void>;
  log: (level: LogLevel, message: string) => Promise<void>;
  correlationId: string;
  // Listing tools drop guilds outside DISCORD_MCP_ALLOWED_GUILDS with this.
  allowsGuild: (guildId: string) => boolean;
}
export interface ToolSpec<I extends z.ZodObject, O extends z.ZodObject> {
  name: `discord_${string}`;
  description: string;
  operationIds: readonly string[];
  toolset: Toolset;
  credential?: CredentialProfile;
  scope: ResourceScope<Key<I>>;
  permissions: readonly Permission[];
  // Drives the MCP annotations and read-only mode.
  effect: Effect;
  // Server-side approval gate; defaults to effect === "destructive".
  approval?: boolean;
  idempotent: boolean;
  input: I;
  output: O;
  execute(input: z.infer<I>, context: ToolContext): Promise<z.input<O>>;
}
export interface ToolDescriptor
  extends Omit<ToolSpec<z.ZodObject, z.ZodObject>, "name" | "scope" | "credential" | "approval"> {
  name: string;
  scope: ResourceScope;
  credential: CredentialProfile;
  approval: boolean;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
}
const descriptors = new WeakSet<object>();
export function defineTool<I extends z.ZodObject, O extends z.ZodObject>(
  spec: ToolSpec<I, O>,
): ToolDescriptor {
  if (!/^discord_[a-z0-9]+(?:_[a-z0-9]+)+$/.test(spec.name))
    throw new Error(`Invalid tool name: ${spec.name}`);
  const tool: ToolDescriptor = {
    ...spec,
    credential: spec.credential ?? "bot",
    approval: spec.approval ?? spec.effect === "destructive",
    input: spec.input.strict(),
    annotations: {
      readOnlyHint: spec.effect === "read",
      destructiveHint: spec.effect === "destructive",
      idempotentHint: spec.idempotent,
      openWorldHint: true,
    },
  };
  descriptors.add(tool);
  return tool;
}
export function scopeIds(tool: ToolDescriptor, input: Record<string, unknown>) {
  const byKind: Partial<Record<ScopeKind, string[]>> = {};
  // Audit every target ID, scoped or not, so member, role and moderation writes name their targets.
  const resources: Record<string, string> = {};
  for (const [key, value] of Object.entries(input))
    if (/(^|_)ids?$|^code$/.test(key) && (typeof value === "string" || Array.isArray(value)))
      resources[key] = String(value);
  if (tool.scope === "none") return { byKind, resources };
  for (const [kind, keys] of Object.entries(tool.scope) as [ScopeKind, string | string[]][])
    for (const key of typeof keys === "string" ? [keys] : keys) {
      const value = input[key];
      // null clears the field, so there is no resource to check.
      if (value === undefined || value === null) continue;
      const values = typeof value === "string" ? [value] : value;
      // Fail closed: a scope key that is not a string or string[] would escape the allowlist.
      if (!Array.isArray(values) || values.some((v) => typeof v !== "string"))
        throw new Error(`Scope key ${key} of ${tool.name} must be a string or string[]`);
      byKind[kind] = [...(byKind[kind] ?? []), ...(values as string[])];
    }
  return { byKind, resources };
}
export class PToolRegistry {
  private readonly tools = new Map<string, ToolDescriptor>();
  static async load(
    dir = fileURLToPath(new URL("../operations/", import.meta.url)),
  ): Promise<PToolRegistry> {
    const registry = new PToolRegistry();
    const files = (await readdir(dir, { recursive: true })).filter(
      (file) => /\.[jt]s$/.test(file) && !file.endsWith(".d.ts"),
    );
    for (const file of files)
      for (const value of Object.values(await import(pathToFileURL(join(dir, file)).href)))
        if (typeof value === "object" && value !== null && descriptors.has(value))
          registry.register(value as ToolDescriptor);
    if (!registry.tools.size) throw new Error(`No tools found in ${dir}`);
    return registry;
  }
  register(tool: ToolDescriptor): void {
    const existing = this.tools.get(tool.name);
    if (existing === tool) return;
    if (existing) throw new Error(`Duplicate tool: ${tool.name}`);
    this.tools.set(tool.name, tool);
  }
  get(name: string): ToolDescriptor | undefined {
    return this.tools.get(name);
  }
  list(): ToolDescriptor[] {
    return [...this.tools.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}
