import type { RESTGetAPIGuildScheduledEventUsersResult } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { guildScheduledEventUser, userListQuery, userPagingCursors } from "./schemas.js";

export const listGuildScheduledEventExceptionUsers = defineTool({
  name: "discord_list_guild_scheduled_event_exception_users",
  description:
    "List users subscribed to a specific recurrence exception of a guild scheduled event, ordered by user ID ascending. Returns an array of user subscription objects. Page with after=next_after. To list subscribers of the parent scheduled event, use discord_list_guild_scheduled_event_users.",
  operationIds: ["list_guild_scheduled_event_exception_users"],
  toolset: "events",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    guild_id: snowflake.describe("ID of the guild"),
    guild_scheduled_event_id: snowflake.describe("ID of the scheduled event"),
    guild_scheduled_event_exception_id: snowflake.describe(
      "ID of the event exception to list subscribed users for",
    ),
    ...userListQuery,
  }),
  output: z.object({
    users: z.array(guildScheduledEventUser),
    next_after: snowflake.nullable(),
  }),
  execute: async (
    { guild_id, guild_scheduled_event_id, guild_scheduled_event_exception_id, ...query },
    { discord },
  ) => {
    const users = await discord<RESTGetAPIGuildScheduledEventUsersResult>({
      method: "GET",
      route: `/guilds/${guild_id}/scheduled-events/${guild_scheduled_event_id}/${guild_scheduled_event_exception_id}/users`,
      query,
    });
    return userPagingCursors(users);
  },
});
