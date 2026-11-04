import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";

const countOutput = z.object({
  guild_scheduled_event_count: z.number().int(),
  guild_scheduled_event_exception_counts: z.record(z.string(), z.number().int()),
});

export const countGuildScheduledEventUsers = defineTool({
  name: "discord_count_guild_scheduled_event_users",
  description:
    "Get total interested user counts for a guild scheduled event and its recurrence exceptions. Returns overall event count and an exception counts map keyed by exception ID. To list individual subscribed users instead, use discord_list_guild_scheduled_event_users.",
  operationIds: ["count_guild_scheduled_event_users"],
  toolset: "events",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    guild_id: snowflake.describe("ID of the guild"),
    guild_scheduled_event_id: snowflake.describe("ID of the scheduled event"),
    guild_scheduled_event_exception_ids: z
      .array(snowflake)
      .max(10)
      .optional()
      .describe("Array of up to 10 event exception IDs to fetch counts for"),
  }),
  output: countOutput,
  execute: async (
    { guild_id, guild_scheduled_event_id, guild_scheduled_event_exception_ids },
    { discord },
  ) =>
    discord<z.infer<typeof countOutput>>({
      method: "GET",
      route: `/guilds/${guild_id}/scheduled-events/${guild_scheduled_event_id}/users/counts`,
      // OpenAPI query arrays are style form with explode, so Discord expects one key per ID.
      query: { guild_scheduled_event_exception_ids },
    }),
});
