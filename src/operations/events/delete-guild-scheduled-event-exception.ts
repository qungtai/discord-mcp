import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";

export const deleteGuildScheduledEventException = defineTool({
  name: "discord_delete_guild_scheduled_event_exception",
  description:
    "Delete an exception for a recurring guild scheduled event, restoring that occurrence to the parent event's standard recurrence rule. To create an exception instead, use discord_create_guild_scheduled_event_exception. To modify it, use discord_update_guild_scheduled_event_exception.",
  operationIds: ["delete_guild_scheduled_event_exception"],
  toolset: "events",
  scope: { guild: "guild_id" },
  permissions: ["ManageEvents"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    guild_id: snowflake.describe("ID of the guild"),
    guild_scheduled_event_id: snowflake.describe("ID of the scheduled event"),
    exception_id: snowflake.describe("ID of the event exception to remove"),
  }),
  output: z.object({
    deleted: z.literal(true),
    guild_id: snowflake,
    guild_scheduled_event_id: snowflake,
    exception_id: snowflake,
  }),
  execute: async (ids, { discord }) => {
    await discord({
      method: "DELETE",
      route: `/guilds/${ids.guild_id}/scheduled-events/${ids.guild_scheduled_event_id}/exceptions/${ids.exception_id}`,
    });
    return {
      deleted: true as const,
      ...ids,
    };
  },
});
