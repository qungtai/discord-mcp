import { Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { type APIGuildScheduledEventData, guildScheduledEvent } from "./mem-events-schemas.js";

export const listGuildScheduledEvents = defineTool({
  name: "discord_list_guild_scheduled_events",
  description: "List scheduled events for a guild",
  operationIds: ["list_guild_scheduled_events"],
  toolset: "events",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    guild_id: snowflake,
    with_user_count: z.boolean().optional(),
  }),
  output: z.object({
    guild_scheduled_events: z.array(guildScheduledEvent),
  }),
  execute: async ({ guild_id, ...query }, { discord }) => {
    const events = await discord<APIGuildScheduledEventData[]>({
      method: "GET",
      route: Routes.guildScheduledEvents(guild_id),
      query,
    });
    return { guild_scheduled_events: events };
  },
});
