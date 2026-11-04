import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { exceptionOverrideInput, guildScheduledEventException } from "./schemas.js";

export const createGuildScheduledEventException = defineTool({
  name: "discord_create_guild_scheduled_event_exception",
  description:
    "Create an exception for a specific occurrence of a recurring guild scheduled event to cancel it or reschedule its time. Returns the created exception record. To update an existing exception later, use discord_update_guild_scheduled_event_exception; to remove it, use discord_delete_guild_scheduled_event_exception.",
  operationIds: ["create_guild_scheduled_event_exception"],
  toolset: "events",
  scope: { guild: "guild_id" },
  permissions: ["ManageEvents"],
  effect: "write",
  idempotent: false,
  input: z.object({
    guild_id: snowflake.describe("ID of the guild"),
    guild_scheduled_event_id: snowflake.describe("ID of the recurring scheduled event"),
    original_scheduled_start_time: z.iso
      .datetime({ offset: true })
      .describe(
        "Original start time of the recurring occurrence to override: ISO 8601 date and time with seconds, for example 2026-11-05T18:00:00Z",
      ),
    ...exceptionOverrideInput,
  }),
  output: z.object({
    guild_scheduled_event_exception: guildScheduledEventException,
  }),
  execute: async ({ guild_id, guild_scheduled_event_id, ...body }, { discord }) => ({
    guild_scheduled_event_exception: await discord<z.infer<typeof guildScheduledEventException>>({
      method: "POST",
      route: `/guilds/${guild_id}/scheduled-events/${guild_scheduled_event_id}/exceptions`,
      body,
    }),
  }),
});
