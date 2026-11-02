import { type RESTGetAPIGuildScheduledEventResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { guildScheduledEvent } from "./mem-events-schemas.js";

export const getGuildScheduledEvent = defineTool({
  name: "discord_get_guild_scheduled_event",
  description: "Get a guild scheduled event by ID",
  operationIds: ["get_guild_scheduled_event"],
  toolset: "events",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    guild_id: snowflake,
    guild_scheduled_event_id: snowflake,
    with_user_count: z.boolean().optional(),
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
