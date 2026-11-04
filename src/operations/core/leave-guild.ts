import { type RESTDeleteAPICurrentUserGuildResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";

export const leaveGuild = defineTool({
  name: "discord_leave_guild",
  description:
    "Remove the authenticated bot from a guild by server ID. The bot ceases to be a member immediately and requires a new invite URL with bot scopes to rejoin. Use this when the bot is instructed to depart a server; to kick or remove another guild member instead use discord_delete_guild_member. Returns deleted: true and the guild ID.",
  operationIds: ["leave_guild"],
  toolset: "core",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "destructive",
  // The bot leaves the server and requires a new invite to return.
  approval: true,
  idempotent: true,
  input: z.object({
    guild_id: snowflake.describe("ID of the guild to leave"),
  }),
  output: z.object({
    deleted: z.literal(true),
    guild_id: snowflake,
  }),
  execute: async ({ guild_id }, { discord }) => {
    await discord<RESTDeleteAPICurrentUserGuildResult>({
      method: "DELETE",
      route: Routes.userGuild(guild_id),
    });
    return {
      deleted: true as const,
      guild_id,
    };
  },
});
