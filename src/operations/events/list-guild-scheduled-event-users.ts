import { type RESTGetAPIGuildScheduledEventUsersResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { guildScheduledEventUser, userListQuery, userPagingCursors } from "./schemas.js";

export const listGuildScheduledEventUsers = defineTool({
  name: "discord_list_guild_scheduled_event_users",
  description:
    "Get a list of users subscribed to a guild scheduled event, ordered by user ID ascending. Page with after=next_after",
  operationIds: ["list_guild_scheduled_event_users"],
  toolset: "events",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    guild_id: snowflake,
    guild_scheduled_event_id: snowflake,
    ...userListQuery,
  }),
  output: z.object({
    users: z.array(guildScheduledEventUser),
    next_after: snowflake.nullable(),
  }),
  execute: async ({ guild_id, guild_scheduled_event_id, ...query }, { discord }) => {
    const users = await discord<RESTGetAPIGuildScheduledEventUsersResult>({
      method: "GET",
      route: Routes.guildScheduledEventUsers(guild_id, guild_scheduled_event_id),
      query,
    });
    return userPagingCursors(users);
  },
});
