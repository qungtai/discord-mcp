import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";

export const deleteGuildScheduledEventException = defineTool({
  name: "discord_delete_guild_scheduled_event_exception",
  description: "Delete an exception for a recurring guild scheduled event",
  operationIds: ["delete_guild_scheduled_event_exception"],
  toolset: "events",
  scope: { guild: "guild_id" },
  permissions: ["ManageEvents"],
  effect: "destructive",
  idempotent: true,
  input: z.object({
    guild_id: snowflake,
    guild_scheduled_event_id: snowflake,
    exception_id: snowflake,
  }),
  output: z.object({
    deleted: z.literal(true),
    guild_id: snowflake,
    guild_scheduled_event_id: snowflake,
    exception_id: snowflake,
  }),
  execute: async ({ guild_id, guild_scheduled_event_id, exception_id }, { discord }) => {
    await discord({
      method: "DELETE",
      route: `/guilds/${guild_id}/scheduled-events/${guild_scheduled_event_id}/exceptions/${exception_id}`,
    });
    return {
      deleted: true as const,
      guild_id,
      guild_scheduled_event_id,
      exception_id,
    };
  },
});
