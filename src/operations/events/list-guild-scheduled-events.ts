import { type RESTGetAPIGuildScheduledEventsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { guildScheduledEvent } from "./schemas.js";

export const listGuildScheduledEvents = defineTool({
  name: "discord_list_guild_scheduled_events",
  description:
    "List all scheduled events for a guild, with optional subscriber counts. Returns an array of scheduled event objects. To fetch full details for one specific event, use discord_get_guild_scheduled_event. To create a new event, use discord_create_guild_scheduled_event.",
  operationIds: ["list_guild_scheduled_events"],
  toolset: "events",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    guild_id: snowflake.describe("ID of the guild"),
    with_user_count: z
      .boolean()
      .optional()
      .describe("Whether to include the number of users subscribed to each event"),
  }),
  output: z.object({
    guild_scheduled_events: z.array(guildScheduledEvent),
  }),
  execute: async ({ guild_id, ...query }, { discord }) => ({
    guild_scheduled_events: await discord<RESTGetAPIGuildScheduledEventsResult>({
      method: "GET",
      route: Routes.guildScheduledEvents(guild_id),
      query,
    }),
  }),
});
