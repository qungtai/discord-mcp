import { type RESTGetAPIGuildScheduledEventResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { guildScheduledEvent } from "./schemas.js";

export const getGuildScheduledEvent = defineTool({
  name: "discord_get_guild_scheduled_event",
  description:
    "Fetch details for a single scheduled event in a guild by ID, with optional subscriber count. Use it when you already know the event ID; to list all scheduled events for the guild, use discord_list_guild_scheduled_events. To modify the event, use discord_update_guild_scheduled_event.",
  operationIds: ["get_guild_scheduled_event"],
  toolset: "events",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    guild_id: snowflake.describe("ID of the guild"),
    guild_scheduled_event_id: snowflake.describe("ID of the scheduled event to fetch"),
    with_user_count: z
      .boolean()
      .optional()
      .describe("Whether to include the number of users subscribed to the event in the response"),
  }),
  output: z.object({
    guild_scheduled_event: guildScheduledEvent,
  }),
  execute: async ({ guild_id, guild_scheduled_event_id, ...query }, { discord }) => ({
    guild_scheduled_event: await discord<RESTGetAPIGuildScheduledEventResult>({
      method: "GET",
      route: Routes.guildScheduledEvent(guild_id, guild_scheduled_event_id),
      query,
    }),
  }),
});
