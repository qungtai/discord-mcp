import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";

const countOutput = z.object({
  guild_scheduled_event_count: z.number().int(),
  guild_scheduled_event_exception_counts: z.record(z.string(), z.number().int()),
});

export const countGuildScheduledEventUsers = defineTool({
  name: "discord_count_guild_scheduled_event_users",
  description: "Get user counts for a guild scheduled event and its exceptions",
  operationIds: ["count_guild_scheduled_event_users"],
  toolset: "events",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    guild_id: snowflake,
    guild_scheduled_event_id: snowflake,
    guild_scheduled_event_exception_ids: z.array(snowflake).max(10).optional(),
  }),
  output: countOutput,
  // Note on guild_scheduled_event_exception_ids encoding:
  // Discord's OpenAPI spec models guild_scheduled_event_exception_ids as an array of snowflakes in the query string.
  // Standard Discord query array parameters use repeated keys (?key=1&key=2).
  // However, the DiscordRequestInit query type and toQuery serializer in src/adapters/discord-rest/discord-rest.ts:63
  // accept Record<string, string | number | boolean | undefined> and do not support arrays.
  // Joining IDs with commas passes a single string to satisfy the adapter's type contract until core supports repeated query keys.
  execute: async (
    { guild_id, guild_scheduled_event_id, guild_scheduled_event_exception_ids },
    { discord },
  ) =>
    discord<z.infer<typeof countOutput>>({
      method: "GET",
      route: `/guilds/${guild_id}/scheduled-events/${guild_scheduled_event_id}/users/counts`,
      query: {
        guild_scheduled_event_exception_ids: guild_scheduled_event_exception_ids?.join(","),
      },
    }),
});
