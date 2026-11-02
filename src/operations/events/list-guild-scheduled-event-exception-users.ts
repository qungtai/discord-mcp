import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import {
  type APIGuildScheduledEventUserData,
  guildScheduledEventUser,
} from "./mem-events-schemas.js";

export const listGuildScheduledEventExceptionUsers = defineTool({
  name: "discord_list_guild_scheduled_event_exception_users",
  description:
    "Get a list of users subscribed to a specific recurrence exception of a guild scheduled event. Page with after=next_after",
  operationIds: ["list_guild_scheduled_event_exception_users"],
  toolset: "events",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    guild_id: snowflake,
    guild_scheduled_event_id: snowflake,
    guild_scheduled_event_exception_id: snowflake,
    limit: z.number().int().min(1).max(100).optional(),
    with_member: z.boolean().optional(),
    before: snowflake.optional(),
    after: snowflake.optional(),
  }),
  output: z.object({
    users: z.array(guildScheduledEventUser),
    next_before: snowflake.nullable(),
    next_after: snowflake.nullable(),
  }),
  execute: async (
    { guild_id, guild_scheduled_event_id, guild_scheduled_event_exception_id, ...query },
    { discord },
  ) => {
    const users = await discord<APIGuildScheduledEventUserData[]>({
      method: "GET",
      route: `/guilds/${guild_id}/scheduled-events/${guild_scheduled_event_id}/${guild_scheduled_event_exception_id}/users`,
      query,
    });
    return {
      users,
      next_before: users.at(-1)?.user?.id ?? null,
      next_after: users[0]?.user?.id ?? null,
    };
  },
});
