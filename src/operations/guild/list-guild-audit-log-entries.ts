import { type RESTGetAPIAuditLogResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { sanitizeWebhook, snowflake } from "../schemas.js";
import { auditLog, guildIds } from "./schemas.js";

export const listGuildAuditLogEntries = defineTool({
  name: "discord_list_guild_audit_log_entries",
  description:
    "List and filter audit log entries for moderation, settings, and role changes in a guild. Supports filtering by user_id, target_id, or action_type, with chronological pagination using before and after cursors. Use next_before to page backwards to older entries and next_after for newer entries. Returns audit log entries, users, integrations, and webhooks.",
  operationIds: ["list_guild_audit_log_entries"],
  toolset: "guild",
  scope: { guild: "guild_id" },
  permissions: ["ViewAuditLog"],
  effect: "read",
  idempotent: true,
  input: z.object({
    ...guildIds,
    user_id: snowflake
      .optional()
      .describe("Filter audit log entries by the user ID who performed the action"),
    target_id: snowflake
      .optional()
      .describe("Filter audit log entries by the target resource ID (user, channel, role, etc.)"),
    action_type: z
      .number()
      .int()
      .optional()
      .describe(
        "Filter by integer audit log action type (e.g. 1 for GUILD_UPDATE, 20 for CHANNEL_CREATE, 30 for ROLE_CREATE, 72 for BOT_ADD)",
      ),
    before: snowflake
      .optional()
      .describe("Filter for entries before this audit log entry ID for paging older items"),
    after: snowflake
      .optional()
      .describe("Filter for entries after this audit log entry ID for paging newer items"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Number of entries to return (1-100, defaults to 50)"),
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
      audit_log: {
        ...res,
        webhooks: res.webhooks?.map(sanitizeWebhook),
      },
      next_before: entries.at(-1)?.id ?? null,
      next_after: entries.at(0)?.id ?? null,
    };
  },
});
