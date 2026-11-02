import { type RESTGetAPIAuditLogResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { auditLog, guildIds } from "./guild-settings-schemas.js";

export const listGuildAuditLogEntries = defineTool({
  name: "discord_list_guild_audit_log_entries",
  description: "List audit log entries for a guild",
  operationIds: ["list_guild_audit_log_entries"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: ["ViewAuditLog"],
  effect: "read",
  idempotent: true,
  input: z.object({
    ...guildIds,
    user_id: snowflake.optional().describe("Filter by user who made the changes"),
    target_id: snowflake.optional().describe("Filter by target entity ID"),
    action_type: z.number().int().optional().describe("Filter by audit log event type"),
    before: snowflake.optional().describe("Filter for entries before this ID"),
    after: snowflake.optional().describe("Filter for entries after this ID"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Number of entries to return (1-100)"),
  }),
  output: z.object({
    audit_log: auditLog,
    next_before: snowflake.nullable(),
    next_after: snowflake.nullable(),
  }),
  execute: async ({ guild_id, ...query }, { discord }) => {
    const res = await discord<RESTGetAPIAuditLogResult>({
      method: "GET",
      route: Routes.guildAuditLog(guild_id),
      query,
    });
    const entries = res.audit_log_entries ?? [];
    return {
      audit_log: res,
      next_before: entries.at(-1)?.id ?? null,
      next_after: entries.at(0)?.id ?? null,
    };
  },
});
