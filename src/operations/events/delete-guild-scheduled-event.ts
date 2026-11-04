import { type RESTDeleteAPIGuildScheduledEventResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { reason, snowflake } from "../schemas.js";

export const deleteGuildScheduledEvent = defineTool({
  name: "discord_delete_guild_scheduled_event",
  description:
    "Permanently delete a scheduled event from a guild. To cancel a scheduled event that has not started without deleting it, use discord_update_guild_scheduled_event with status=4 (Canceled); to end an active event use status=3 (Completed). To cancel a single occurrence of a recurring series, use discord_create_guild_scheduled_event_exception with is_canceled=true.",
  operationIds: ["delete_guild_scheduled_event"],
  toolset: "events",
  scope: { guild: "guild_id" },
  permissions: ["ManageEvents"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    guild_id: snowflake.describe("ID of the guild"),
    guild_scheduled_event_id: snowflake.describe("ID of the scheduled event to delete"),
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
