import { type RESTDeleteAPIGuildScheduledEventResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

export const deleteGuildScheduledEvent = defineTool({
  name: "discord_delete_guild_scheduled_event",
  description: "Delete a guild scheduled event",
  operationIds: ["delete_guild_scheduled_event"],
  toolset: "events",
  scope: { guild: "guild_id" },
  permissions: ["ManageEvents"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    guild_id: snowflake,
    guild_scheduled_event_id: snowflake,
    reason,
  }),
  output: z.object({
    deleted: z.literal(true),
    guild_id: snowflake,
    guild_scheduled_event_id: snowflake,
  }),
  execute: async ({ reason: auditReason, ...ids }, { discord }) => {
    await discord<RESTDeleteAPIGuildScheduledEventResult>({
      method: "DELETE",
      route: Routes.guildScheduledEvent(ids.guild_id, ids.guild_scheduled_event_id),
      reason: auditReason,
    });
    return {
      deleted: true as const,
      ...ids,
    };
  },
});
