import { type RESTGetAPIAuditLogResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { sanitizeWebhook, snowflake } from "../schemas.js";
import { auditLog, guildIds } from "./schemas.js";

export const listGuildAuditLogEntries = defineTool({
  name: "discord_list_guild_audit_log_entries",
  description:
    "List audit log entries for a guild. Without a cursor, or with before, entries come newest first; with after they come oldest first. Filter by user_id (who acted), target_id (what was changed) or action_type, and return 1 to 100 entries per call (default 50). To page to older entries pass before=next_before from a newest-first page. next_before is the lowest ID on a newest-first page and the highest ID on an after page, so after an after page continue with after=next_before. Returns audit_log_entries plus the related users, integrations, webhooks, threads and scheduled events.",
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
        "Filter by audit log action type integer (for example 1 GUILD_UPDATE, 10 CHANNEL_CREATE, 20 MEMBER_KICK, 28 BOT_ADD, 30 ROLE_CREATE)",
      ),
    before: snowflake
      .optional()
      .describe(
        "Return entries with an ID lower than this audit log entry ID, newest first. Use next_before from the previous page",
      ),
    after: snowflake
      .optional()
      .describe(
        "Return entries with an ID higher than this audit log entry ID. Use 0 to start from the oldest entries",
      ),
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
