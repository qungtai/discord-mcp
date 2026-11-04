import { type RESTGetAPIGuildThreadsResult, Routes } from "discord-api-types/v10";
import { z } from "zod/v4";
import { defineTool } from "../../core/tool-registry.js";
import { snowflake } from "../schemas.js";
import { threadList } from "./schemas.js";

export const listActiveGuildThreads = defineTool({
  name: "discord_list_active_guild_threads",
  description:
    "List every active (unarchived) thread in a guild, public and private, newest ID first. Returns threads and the bot's thread member entry for each one it has joined. To find archived threads use discord_list_public_archived_threads or discord_list_private_archived_threads.",
  operationIds: ["get_active_guild_threads"],
  toolset: "threads",
  scope: { guild: "guild_id" },
  permissions: [],
  effect: "read",
  idempotent: true,
  input: z.object({
    guild_id: snowflake.describe("ID of the guild to list active threads from"),
  }),
  output: threadList,
  execute: async ({ guild_id }, { discord }) =>
    discord<RESTGetAPIGuildThreadsResult>({
      method: "GET",
      route: Routes.guildActiveThreads(guild_id),
    }),
});
